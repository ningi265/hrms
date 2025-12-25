const mongoose = require('mongoose');
const Requisition = require("../../models/requisition");
const ApprovalWorkflow = require("../../models/approvalWorkflow"); 
const User = require("../../models/user");
const Department = require("../../models/departments");

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const nodemailer = require('nodemailer');

const createGmailTransporter = () => {
  const gmailUser = process.env.GMAIL_USER || 'brianmtonga592@gmail.com';
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD || 'fmcznqzyywlscpgs';
  
  if (!gmailUser || !gmailAppPassword) {
    console.warn('⚠️ Gmail credentials not found. Email notifications disabled.');
    return null;
  }
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailAppPassword
    }
  });
};

// ============================================
// HELPER FUNCTIONS
// ============================================

// New function to handle auto-approval after vendor selection
exports.handleAutoApprovalAfterVendorSelection = async (requisitionId, actualPrice) => {
    try {
        const requisition = await Requisition.findById(requisitionId)
            .populate('workflow');
        
        if (!requisition) {
            throw new Error('Requisition not found');
        }

        // Check if workflow has auto-approval threshold
        if (requisition.workflow && requisition.workflow.autoApproveBelow) {
            if (actualPrice <= requisition.workflow.autoApproveBelow) {
                console.log(`✅ AUTO-APPROVING: Actual price ${actualPrice} <= ${requisition.workflow.autoApproveBelow}`);
                
                // Skip all remaining approval steps
                requisition.status = "auto-approved";
                requisition.autoApproved = true;
                requisition.autoApproveReason = `Auto-approved: Actual price ${actualPrice} below ${requisition.workflow.autoApproveBelow} threshold`;
                requisition.actualPrice = actualPrice;
                requisition.approvedAt = new Date();
                requisition.currentApprovalStep = null;
                
                // Add to history
                requisition.addHistory(
                    "auto_approved",
                    { _id: null, firstName: "System", lastName: "" },
                    `Auto-approved after vendor selection. Price: ${actualPrice}`
                );
                
                // Add to timeline
                requisition.addToTimeline(
                    requisition.approvalSteps ? requisition.approvalSteps.length + 1 : 1,
                    "auto_approved",
                    { _id: null, firstName: "System", lastName: "" },
                    null,
                    "Vendor Selection",
                    { actualPrice, threshold: requisition.workflow.autoApproveBelow }
                );
                
                await requisition.save();
                
                return {
                    success: true,
                    autoApproved: true,
                    message: `Requisition auto-approved: Price ${actualPrice} below threshold ${requisition.workflow.autoApproveBelow}`
                };
            } else {
                console.log(`⏳ No auto-approval: Actual price ${actualPrice} > ${requisition.workflow.autoApproveBelow}`);
                
                // Continue with normal approval process
                requisition.actualPrice = actualPrice;
                await requisition.save();
                
                return {
                    success: true,
                    autoApproved: false,
                    message: `Continuing with approval workflow: Price ${actualPrice} above threshold ${requisition.workflow.autoApproveBelow}`
                };
            }
        }
        
        return {
            success: true,
            autoApproved: false,
            message: "No auto-approval threshold configured for this workflow"
        };
        
    } catch (error) {
        console.error('Error handling auto-approval after vendor selection:', error);
        throw error;
    }
};


// Helper function to assign workflow to requisition
const assignWorkflowToRequisition = async (requisition) => {
    try {
        console.log('🔍 [WORKFLOW DEBUG] Starting workflow assignment:');
        console.log('   Requisition ID:', requisition._id);
        console.log('   Company:', requisition.company);
        console.log('   Department:', requisition.department);
        console.log('   Department (type):', typeof requisition.department);
        console.log('   Estimated Cost:', requisition.estimatedCost);
        console.log('   Category:', requisition.category);

        // Check if model method exists
        if (typeof ApprovalWorkflow.findApplicableWorkflow !== 'function') {
            console.error('❌ findApplicableWorkflow is not a function!');
            return requisition;
        }

        // Find applicable workflow
        console.log('🔄 Calling findApplicableWorkflow...');
        const workflow = await ApprovalWorkflow.findApplicableWorkflow(
            requisition,
            requisition.company
        );

        if (workflow) {
            console.log(`✅ Found workflow: ${workflow.name} (ID: ${workflow._id})`);
            console.log('   Workflow details:', {
                autoApproveBelow: workflow.autoApproveBelow,
                applyToAll: workflow.applyToAll,
                departments: workflow.departments,
                minAmount: workflow.minAmount,
                maxAmount: workflow.maxAmount
            });
            
            requisition.workflow = workflow._id;
            requisition.workflowInstanceId = `${workflow.code}-${Date.now()}`;
            
            // Set SLA dates
            if (workflow.slaHours) {
                requisition.slaStartDate = new Date();
                requisition.slaDueDate = new Date(Date.now() + workflow.slaHours * 60 * 60 * 1000);
            }

            // REMOVED: Auto-approval check during requisition creation
            // Auto-approval will now be handled later when actual price is known
            
            // Initialize workflow steps (always go through normal approval process)
            console.log(`🔄 Initializing workflow steps for: ${workflow.name}`);
            await initializeWorkflowSteps(requisition, workflow);
            requisition.status = "in-review";
        } else {
            console.warn(`⚠️ No workflow found for requisition: ${requisition._id}`);
            
            // Debug: List all available workflows
            console.log('🔍 Checking all available workflows...');
            const allWorkflows = await ApprovalWorkflow.find({
                company: requisition.company,
                isActive: true,
                isDraft: false
            });
            
            console.log(`📋 Found ${allWorkflows.length} active, published workflows:`);
            allWorkflows.forEach((wf, i) => {
                console.log(`   ${i+1}. ${wf.name} (ID: ${wf._id})`);
                console.log(`      applyToAll: ${wf.applyToAll}`);
                console.log(`      departments: ${wf.departments ? wf.departments.length : 0} departments`);
                console.log(`      minAmount: ${wf.minAmount}, maxAmount: ${wf.maxAmount}`);
                console.log(`      autoApproveBelow: ${wf.autoApproveBelow}`);
                console.log(`      categories: ${wf.categories ? wf.categories.join(', ') : 'none'}`);
            });
        }

        return requisition;
    } catch (error) {
        console.error("❌ Error assigning workflow:", error);
        console.error(error.stack);
        throw error;
    }
};

// Helper function to initialize workflow steps
const initializeWorkflowSteps = async (requisition, workflow) => {
    const startNode = workflow.nodes.find(node => node.type === 'start');
    if (!startNode) {
        throw new Error('Workflow must have a start node');
    }

    // Find next node after start
    const connection = workflow.connections.find(conn => conn.from === startNode.id);
    if (!connection) {
        throw new Error('Start node must have a connection');
    }

    const firstNode = workflow.nodes.find(node => node.id === connection.to);
    if (!firstNode) {
        throw new Error('Invalid workflow: Could not find first node');
    }

    // Initialize current approval step
    requisition.currentApprovalStep = {
        nodeId: firstNode.id,
        nodeName: firstNode.name,
        nodeType: firstNode.type,
        status: "pending",
        startedAt: new Date(),
        approvers: firstNode.approvers ? firstNode.approvers.map(approver => ({
            userId: approver.userId,
            name: approver.name,
            email: approver.email,
            status: "pending"
        })) : [],
        minApprovalsRequired: firstNode.minApprovals || 1,
        approvalsReceived: 0,
        rejectionsReceived: 0
    };

    // Set timeout if configured
    if (firstNode.timeoutHours) {
        const timeoutAt = new Date();
        timeoutAt.setHours(timeoutAt.getHours() + firstNode.timeoutHours);
        requisition.currentApprovalStep.timeoutAt = timeoutAt;
    }

    // Add to timeline
    requisition.addToTimeline(
        1,
        "workflow_started",
        { _id: requisition.employee, firstName: "System", lastName: "" },
        firstNode.id,
        firstNode.name,
        { workflowName: workflow.name }
    );
};

// Helper function to check and process step completion
const checkAndProcessStepCompletion = async (requisition) => {
    const step = requisition.currentApprovalStep;
    
    if (!step) return;

    // Check if step requirements are met
    const approvalsMet = step.approvalsReceived >= step.minApprovalsRequired;
    const rejectionsReceived = step.rejectionsReceived > 0;
    const allResponded = step.approvers.every(a => 
        a.status === "approved" || a.status === "rejected" || a.status === "delegated"
    );

    if (rejectionsReceived) {
        // Step rejected
        step.status = "completed";
        step.completedAt = new Date();
        step.outcome = "rejected";
        
        // Save step to approvalSteps
        if (!requisition.approvalSteps) requisition.approvalSteps = [];
        requisition.approvalSteps.push({
            ...step.toObject(),
            stepNumber: requisition.approvalSteps.length + 1
        });
        
        // Update requisition status
        requisition.status = "rejected";
        requisition.rejectedAt = new Date();
        
        // Add to history
        requisition.addHistory(
            "step_rejected",
            { _id: null, firstName: "System", lastName: "" },
            `Step rejected: ${step.nodeName}`
        );
        
        return;
    }

    if (approvalsMet || (allResponded && step.approvalsReceived > 0)) {
        // Step completed successfully
        step.status = "completed";
        step.completedAt = new Date();
        step.outcome = "approved";
        
        // Save step to approvalSteps
        if (!requisition.approvalSteps) requisition.approvalSteps = [];
        requisition.approvalSteps.push({
            ...step.toObject(),
            stepNumber: requisition.approvalSteps.length + 1
        });

        // Get next step from workflow
        await processNextWorkflowStep(requisition);
    }
};

// Helper function to process next workflow step
const processNextWorkflowStep = async (requisition) => {
  try {
    const workflow = await ApprovalWorkflow.findById(requisition.workflow);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const currentStep = requisition.currentApprovalStep;
    
    // Find connection from current node
    const connection = workflow.connections.find(conn => conn.from === currentStep.nodeId);
    if (!connection) {
      // No more steps - requisition is fully approved
      requisition.status = "approved";
      requisition.approvedAt = new Date();
      requisition.currentApprovalStep = null;
      
      requisition.addHistory(
        "fully_approved",
        { _id: null, firstName: "System", lastName: "" },
        "All workflow steps completed"
      );
      
      // Add to timeline
      requisition.addToTimeline(
        requisition.approvalSteps ? requisition.approvalSteps.length + 1 : 1,
        "workflow_completed",
        { _id: null, firstName: "System", lastName: "" },
        null,
        "Workflow Completed",
        { status: "approved" }
      );
      
      return;
    }

    // Find next node
    const nextNode = workflow.nodes.find(node => node.id === connection.to);
    if (!nextNode) {
      throw new Error('Next node not found in workflow');
    }

    // Handle different node types
    if (nextNode.type === "condition") {
      // Evaluate condition
      const conditionMet = workflow.evaluateConditions(nextNode.conditions, requisition);
      const nextNodeId = conditionMet ? nextNode.trueBranch : nextNode.falseBranch;
      const actualNextNode = workflow.nodes.find(node => node.id === nextNodeId);
      
      if (actualNextNode) {
        await initializeNextStep(requisition, actualNextNode, workflow);
      } else {
        // No valid next node - end workflow
        requisition.status = "approved";
        requisition.approvedAt = new Date();
        requisition.currentApprovalStep = null;
      }
    } else if (nextNode.type === "end") {
      // End of workflow
      requisition.status = "approved";
      requisition.approvedAt = new Date();
      requisition.currentApprovalStep = null;
    } else {
      // Regular node (approval, parallel, notification)
      await initializeNextStep(requisition, nextNode, workflow);
    }

    await requisition.save();
    
  } catch (error) {
    console.error('Error processing next workflow step:', error);
    throw error;
  }
};

// Helper function to initialize next step
const initializeNextStep = async (requisition, node, workflow) => {
    requisition.currentApprovalStep = {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        status: "pending",
        startedAt: new Date(),
        approvers: node.approvers ? node.approvers.map(approver => ({
            userId: approver.userId,
            name: approver.name,
            email: approver.email,
            status: "pending"
        })) : [],
        minApprovalsRequired: node.minApprovals || 1,
        approvalsReceived: 0,
        rejectionsReceived: 0
    };

    // Set timeout if configured
    if (node.timeoutHours) {
        const timeoutAt = new Date();
        timeoutAt.setHours(timeoutAt.getHours() + node.timeoutHours);
        requisition.currentApprovalStep.timeoutAt = timeoutAt;
    }

    // Add to timeline
    requisition.addToTimeline(
        requisition.approvalSteps ? requisition.approvalSteps.length + 2 : 1,
        "step_started",
        { _id: null, firstName: "System", lastName: "" },
        node.id,
        node.name,
        { stepType: node.type }
    );

    // Send notifications for new step
    if (node.type === "approval" || node.type === "parallel") {
        await sendApprovalNotifications(requisition);
    }
};

// Helper function to handle delegation
const handleDelegation = async (requisition, approverId, delegateToId, comments, res) => {
    try {
        // Check if delegation is allowed
        const approverIndex = requisition.currentApprovalStep.approvers
            .findIndex(a => a.userId && a.userId.equals(approverId));

        if (approverIndex === -1) {
            return res.status(400).json({
                success: false,
                message: "Approver not found"
            });
        }

        // Find delegate user
        const delegateUser = await User.findById(delegateToId);
        if (!delegateUser) {
            return res.status(404).json({
                success: false,
                message: "Delegate user not found"
            });
        }

        // Update approver status
        requisition.currentApprovalStep.approvers[approverIndex].status = "delegated";
        requisition.currentApprovalStep.approvers[approverIndex].delegatedTo = delegateUser._id;
        requisition.currentApprovalStep.approvers[approverIndex].comments = comments;

        // Add delegate as new approver
        requisition.currentApprovalStep.approvers.push({
            userId: delegateUser._id,
            name: `${delegateUser.firstName} ${delegateUser.lastName}`,
            email: delegateUser.email,
            status: "pending",
            isDelegated: true,
            delegatedFrom: approverId
        });

        // Add to history
        requisition.addHistory(
            "delegated",
            req.user,
            `Delegated approval to ${delegateUser.firstName} ${delegateUser.lastName}`,
            { delegateTo: delegateUser._id, comments }
        );

        await requisition.save();

        // Send notification to delegate
        await sendDelegationNotification(requisition, req.user, delegateUser);

        res.status(200).json({
            success: true,
            message: "Approval delegated successfully",
            data: {
                delegatedTo: {
                    id: delegateUser._id,
                    name: `${delegateUser.firstName} ${delegateUser.lastName}`,
                    email: delegateUser.email
                }
            }
        });

    } catch (error) {
        console.error('Error handling delegation:', error);
        res.status(500).json({
            success: false,
            message: "Error processing delegation",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Helper function to send approval notifications
const sendApprovalNotifications = async (requisition) => {
    try {
        const step = requisition.currentApprovalStep;
        if (!step || !step.approvers) return;

        const pendingApprovers = step.approvers.filter(a => a.status === "pending");
        
        for (const approver of pendingApprovers) {
            console.log(`Sending approval notification to: ${approver.email}`);
        }
    } catch (error) {
        console.error('Error sending approval notifications:', error);
    }
};

// Helper function to send requisition notification
async function sendRequisitionNotification({ requisitionId, action, actor }) {
    try {
        console.log(`Notification: Requisition ${requisitionId} ${action} by ${actor}`);
    } catch (error) {
        console.error("Error sending requisition notification:", error);
    }
}

// Helper function to send delegation notification
const sendDelegationNotification = async (requisition, delegator, delegate) => {
    try {
        console.log(`Delegation notification: ${delegator.firstName} delegated approval to ${delegate.firstName}`);
    } catch (error) {
        console.error('Error sending delegation notification:', error);
    }
};

// ============================================
// CONTROLLER FUNCTIONS
// ============================================

// Submit a new requisition (Employee)
exports.createRequisition = async (req, res) => {
    console.log("Creating requisition with body:", req.body);
    try {
        // Check authentication
        if (!req.user || !req.user._id) {
            return res.status(401).json({ 
                success: false,
                message: "Unauthorized: User not authenticated" 
            });
        }

        // Get requesting user with company info
        const requestingUser = await User.findById(req.user._id)
            .select('company isEnterpriseAdmin role departments');
        
        if (!requestingUser) {
            return res.status(404).json({ 
                success: false,
                message: "User not found" 
            });
        }

        // Define allowed roles
        const allowedRoles = [
            "employee", "procurement_officer", "IT/Technical",
            "Executive (CEO, CFO, etc.)", "Management",
            "Human Resources", "Accounting/Finance", 
            "Sales/Marketing", "Enterprise(CEO, CFO, etc.)","Software Engineer",
            "Senior Software Engineer", 
            "Lead Engineer",
            "Product Manager",
            "Senior Product Manager",
            "Data Scientist",
            "Data Analyst",
            "UI/UX Designer",
            "Senior Designer",
            "DevOps Engineer",
            "Quality Assurance Engineer",
            "Business Analyst",
            "Project Manager",
            "Scrum Master",
            "Sales Representative",
            "Sales Manager",
            "Marketing Specialist",
            "Marketing Manager",
            "HR Specialist",
            "HR Manager",
            "Finance Analyst",
            "Accountant",
            "Administrative Assistant",
            "Office Manager",
            "Customer Support Representative",
            "Customer Success Manager"
        ];

        // Verify user has permission to create requisitions
        if (!requestingUser.isEnterpriseAdmin && 
            !allowedRoles.includes(requestingUser.role)) {
            return res.status(403).json({ 
                success: false,
                message: "Unauthorized to create requisitions",
                requiredRole: "One of: " + allowedRoles.join(", ")
            });
        }

        // Extract and validate required fields
        const { 
            itemName,
            quantity,
            budgetCode,
            urgency,
            preferredSupplier,
            reason,
            category,
            estimatedCost,
            deliveryDate,
            department,
            departmentId,
            environmentalImpact,
            projectCode,
            costCenter
        } = req.body;

        // Validate required fields
        const requiredFields = {
            itemName: "Item name is required",
            budgetCode: "Budget code is required",
            reason: "Business justification is required",
            department: "Department is required"
        };

        const missingFields = Object.entries(requiredFields)
            .filter(([field]) => !req.body[field] && field !== 'department' ? true : !department && !departmentId)
            .map(([_, message]) => message);

        if (missingFields.length > 0) {
            return res.status(400).json({ 
                success: false,
                message: "Validation failed",
                errors: missingFields
            });
        }

        // Find department by ID or name
        let departmentDoc = null;
        if (departmentId) {
            departmentDoc = await Department.findOne({
                _id: departmentId,
                company: requestingUser.company
            });
        } else if (department) {
            // Try to find by name if not an ObjectId
            if (mongoose.Types.ObjectId.isValid(department)) {
                departmentDoc = await Department.findOne({
                    _id: department,
                    company: requestingUser.company
                });
            } else {
                departmentDoc = await Department.findOne({
                    name: { $regex: new RegExp(`^${department}$`, 'i') },
                    company: requestingUser.company
                });
            }
        }

        if (!departmentDoc) {
            return res.status(400).json({ 
                success: false,
                message: "Department not found in your company",
                suggestion: "Please provide a valid department ID or exact name"
            });
        }

        // Convert and validate numeric fields
        const numericQuantity = Math.max(1, parseInt(quantity) || 1);
        
        let numericEstimatedCost = 0;
        if (estimatedCost) {
            numericEstimatedCost = parseFloat(estimatedCost.toString().replace(/[^0-9.]/g, ''));
            if (isNaN(numericEstimatedCost) || numericEstimatedCost <= 0) {
                return res.status(400).json({ 
                    success: false,
                    message: "Estimated cost must be a valid number greater than 0" 
                });
            }
        }

        // Validate delivery date if provided
        let validDeliveryDate = null;
        if (deliveryDate) {
            validDeliveryDate = new Date(deliveryDate);
            if (isNaN(validDeliveryDate.getTime())) {
                return res.status(400).json({ 
                    success: false,
                    message: "Invalid delivery date format" 
                });
            }
            
            // Ensure delivery date is in the future
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (validDeliveryDate < today) {
                return res.status(400).json({ 
                    success: false,
                    message: "Delivery date must be in the future" 
                });
            }
        }

        // Create requisition
        const newRequisition = new Requisition({
            employee: req.user._id,
            company: requestingUser.company,
            department: departmentDoc._id,
            departmentCode: departmentDoc.code || departmentDoc.departmentCode,
            itemName,
            quantity: numericQuantity,
            budgetCode,
            urgency: urgency || 'medium',
            preferredSupplier: preferredSupplier || 'No preference',
            reason,
            category: category || 'General',
            estimatedCost: numericEstimatedCost,
            deliveryDate: validDeliveryDate,
            environmentalImpact: environmentalImpact || 'No specific requirements',
            projectCode: projectCode || null,
            costCenter: costCenter || null,
            status: "pending",
            submittedAt: new Date()
        });

        // Add history
        newRequisition.addHistory(
            "created",
            req.user,
            "Requisition created and submitted for approval"
        );

        // Save requisition
        await newRequisition.save();

        // Assign and initialize workflow (without auto-approval check)
        await assignWorkflowToRequisition(newRequisition);
        
        // REMOVED: Auto-approval logic during creation
        // Auto-approval will now be handled later when vendor bids are submitted
        // and a vendor with a known price has been selected

        await newRequisition.save();

        // Populate the response
        const populatedRequisition = await Requisition.findById(newRequisition._id)
            .populate([
                {
                    path: 'employee',
                    select: 'firstName lastName email phoneNumber position',
                    populate: {
                        path: 'department',
                        select: 'name departmentCode'
                    }
                },
                {
                    path: 'department',
                    select: 'name departmentCode'
                },
                {
                    path: 'company',
                    select: 'name industry'
                },
                {
                    path: 'workflow',
                    select: 'name code version'
                }
            ]);

        // Send notifications
        await sendRequisitionNotification({
            requisitionId: newRequisition._id,
            action: "created",
            actor: req.user._id
        });

        // Send approval notifications if in-review
        if (newRequisition.status === "in-review") {
            await sendApprovalNotifications(newRequisition);
        }

        res.status(201).json({ 
            success: true,
            message: "Requisition submitted successfully",
            data: populatedRequisition,
            workflowStatus: {
                hasWorkflow: !!newRequisition.workflow,
                status: newRequisition.status,
                currentStep: newRequisition.currentApprovalStep
            }
        });

    } catch (err) {
        console.error('Error creating requisition:', err);
        
        // Handle duplicate key errors
        if (err.code === 11000) {
            return res.status(400).json({ 
                success: false,
                message: "Duplicate requisition detected",
                error: "This requisition appears to already exist"
            });
        }
        
        // Handle validation errors
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(el => el.message);
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors
            });
        }
        
        res.status(500).json({ 
            success: false,
            message: "Server error while creating requisition",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
};

// Get all requisitions (For Procurement Officers & Admins)
exports.getAllRequisitions = async (req, res) => {
    try {
        const requisitions = await Requisition.find().populate("employee", "firstName lastName email");
        res.json(requisitions);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};



exports.getPendingApprovalsByUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    console.log(`🔍 Fetching pending approvals for user: ${user.email}, Role: ${user.role}, Department: ${user.department}`);

    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build query to find requisitions where user is a pending approver in current step
    const baseQuery = {
      company: user.company,
      status: "in-review",
      "currentApprovalStep.approvers": {
        $elemMatch: {
          $or: [
            { userId: user._id },
            { email: user.email },
            // For department heads, include department-based approvals
            ...(user.role === 'Department Head' && user.department ? 
              [{ departmentId: user.department.toString() }] : [])
          ],
          status: "pending"
        }
      }
    };

    // Optional filters
    const filters = {};
    
    if (req.query.stage) {
      filters["currentApprovalStep.nodeType"] = req.query.stage;
    }
    
    if (req.query.urgency) {
      filters.urgency = req.query.urgency;
    }
    
    if (req.query.department) {
      filters.department = req.query.department;
    }
    
    if (req.query.category) {
      filters.category = req.query.category;
    }

    // Search by item name or requestor
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filters.$or = [
        { itemName: searchRegex },
        { reason: searchRegex },
        { "employee.firstName": searchRegex },
        { "employee.lastName": searchRegex }
      ];
    }

    const finalQuery = { ...baseQuery, ...filters };

    console.log('Final query:', JSON.stringify(finalQuery, null, 2));

    // Get total count
    const total = await Requisition.countDocuments(finalQuery);

    // Get requisitions with pagination
    const requisitions = await Requisition.find(finalQuery)
      .populate([
        {
          path: 'employee',
          select: 'firstName lastName email position phoneNumber',
          populate: {
            path: 'department',
            select: 'name departmentCode'
          }
        },
        {
          path: 'department',
          select: 'name departmentCode head'
        },
        {
          path: 'company',
          select: 'name logo'
        },
        {
          path: 'workflow',
          select: 'name code description'
        },
        {
          path: 'currentApprovalStep.approvers.userId',
          select: 'firstName lastName email role department avatar',
          model: 'User'
        }
      ])
      .sort({ 
        createdAt: -1,
        urgency: -1 // High urgency first
      })
      .skip(skip)
      .limit(limit)
      .lean();

    // Enrich the response with additional information
    const enrichedApprovals = requisitions.map(requisition => {
      const currentStep = requisition.currentApprovalStep;
      
      // Find user's specific approver info
      const userApprover = currentStep.approvers.find(approver => 
        (approver.userId && approver.userId._id && approver.userId._id.toString() === user._id.toString()) ||
        approver.email === user.email ||
        (user.role === 'Department Head' && 
         user.department && 
         requisition.department && 
         requisition.department._id.toString() === user.department.toString())
      );

      // Calculate days pending
      const created = new Date(requisition.createdAt);
      const now = new Date();
      const daysPending = Math.floor((now - created) / (1000 * 60 * 60 * 24));

      // Check SLA status
      let isSlaBreached = false;
      if (requisition.slaDueDate) {
        const slaDate = new Date(requisition.slaDueDate);
        isSlaBreached = slaDate < now;
      }

      return {
        _id: requisition._id,
        itemName: requisition.itemName,
        amount: requisition.estimatedCost,
        department: requisition.department?.name || 'N/A',
        departmentId: requisition.department?._id,
        category: requisition.category,
        urgency: requisition.urgency,
        requestor: {
          name: `${requisition.employee?.firstName || ''} ${requisition.employee?.lastName || ''}`.trim() || 'Unknown',
          email: requisition.employee?.email,
          position: requisition.employee?.position
        },
        currentStage: currentStep.nodeName,
        currentStageId: currentStep.nodeId,
        currentStageType: currentStep.nodeType,
        daysPending,
        slaDeadline: requisition.slaDueDate,
        isSlaBreached,
        createdAt: requisition.createdAt,
        workflow: {
          name: requisition.workflow?.name,
          code: requisition.workflow?.code
        },
        userApprovalInfo: userApprover ? {
          approverId: userApprover._id,
          status: userApprover.status,
          isDelegated: userApprover.isDelegated || false,
          delegatedFrom: userApprover.delegatedFrom,
          canDelegate: currentStep.canDelegate !== false
        } : null,
        stepDetails: {
          minApprovalsRequired: currentStep.minApprovalsRequired,
          approvalsReceived: currentStep.approvalsReceived,
          rejectionsReceived: currentStep.rejectionsReceived,
          totalApprovers: currentStep.approvers.length,
          timeoutAt: currentStep.timeoutAt
        },
        previousApprovals: requisition.approvalSteps?.map(step => ({
          stepName: step.nodeName,
          approvers: step.approvers.filter(a => a.status === 'approved').map(a => ({
            name: a.name,
            date: a.approvedAt
          })),
          completedAt: step.completedAt
        })) || []
      };
    });

    // Calculate statistics
    const stats = {
      totalPending: total,
      highPriority: enrichedApprovals.filter(a => a.urgency === 'high').length,
      overdue: enrichedApprovals.filter(a => a.isSlaBreached).length,
      avgResponseTime: 0 // Would need historical data to calculate
    };

    // Group by stage for filtering
    const stages = [...new Set(enrichedApprovals.map(a => a.currentStageType))];

    res.status(200).json({
      success: true,
      data: enrichedApprovals,
      stats,
      filters: {
        availableStages: stages.map(stage => ({
          value: stage,
          label: stage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
        })),
        departments: [...new Set(enrichedApprovals.map(a => a.department).filter(Boolean))],
        categories: [...new Set(enrichedApprovals.map(a => a.category).filter(Boolean))]
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      user: {
        id: user._id,
        role: user.role,
        department: user.department,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching pending approvals",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.approveRequisitionWorkflowStep = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, action = "approve", delegateTo } = req.body;
    const approverId = req.user._id;

    console.log(`📝 Approving step for requisition: ${id}, Action: ${action}, User: ${approverId}`);

    // Find requisition with full population
    const requisition = await Requisition.findById(id)
      .populate([
        {
          path: 'workflow',
          select: 'name code nodes connections'
        },
        {
          path: 'currentApprovalStep.approvers.userId',
          select: 'firstName lastName email role department'
        },
        {
          path: 'employee',
          select: 'firstName lastName email'
        }
      ]);

    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: "Requisition not found"
      });
    }

    // Check if requisition is in review
    if (requisition.status !== "in-review") {
      return res.status(400).json({
        success: false,
        message: `Cannot approve. Requisition status is: ${requisition.status}`
      });
    }

    // Get current step
    const currentStep = requisition.currentApprovalStep;
    if (!currentStep) {
      return res.status(400).json({
        success: false,
        message: "No current approval step found"
      });
    }

    // Find approver in current step
    const approverIndex = currentStep.approvers.findIndex(approver => {
      if (approver.userId) {
        return approver.userId._id && approver.userId._id.toString() === approverId.toString();
      }
      return false;
    });

    if (approverIndex === -1) {
      // Check if user is department head for department-based approvals
      const user = await User.findById(approverId);
      if (user.role === 'Department Head' && user.department) {
        // Check if this is a department approval step
        if (requisition.department && 
            requisition.department.toString() === user.department.toString() &&
            currentStep.nodeType === 'department-approval') {
          // Add user as approver if not already present
          const existingApprover = currentStep.approvers.find(a => 
            a.userId && a.userId.toString() === approverId.toString()
          );
          
          if (!existingApprover) {
            currentStep.approvers.push({
              userId: approverId,
              name: `${user.firstName} ${user.lastName}`,
              email: user.email,
              status: "pending",
              role: user.role
            });
            await requisition.save();
            
            // Re-find approver index
            const newApproverIndex = currentStep.approvers.findIndex(a => 
              a.userId && a.userId.toString() === approverId.toString()
            );
            if (newApproverIndex !== -1) {
              approverIndex = newApproverIndex;
            }
          }
        }
      }
      
      if (approverIndex === -1) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to approve this requisition"
        });
      }
    }

    // Check if approver has already responded
    if (currentStep.approvers[approverIndex].status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `You have already ${currentStep.approvers[approverIndex].status} this requisition`
      });
    }

    // Handle different actions
    if (action === "delegate" && delegateTo) {
      // Handle delegation
      const delegateUser = await User.findById(delegateTo);
      if (!delegateUser) {
        return res.status(404).json({
          success: false,
          message: "Delegate user not found"
        });
      }

      // Update current approver status
      currentStep.approvers[approverIndex].status = "delegated";
      currentStep.approvers[approverIndex].delegatedTo = delegateTo;
      currentStep.approvers[approverIndex].comments = comment || `Delegated to ${delegateUser.firstName} ${delegateUser.lastName}`;
      currentStep.approvers[approverIndex].delegatedAt = new Date();

      // Add delegate as new approver
      currentStep.approvers.push({
        userId: delegateTo,
        name: `${delegateUser.firstName} ${delegateUser.lastName}`,
        email: delegateUser.email,
        status: "pending",
        isDelegated: true,
        delegatedFrom: approverId
      });

      // Add to history
      requisition.addHistory(
        "delegated",
        req.user,
        comment || `Delegated to ${delegateUser.firstName} ${delegateUser.lastName}`,
        { delegateTo: delegateTo }
      );

      await requisition.save();

      // Send notification to delegate (you'll need to implement this)
      await sendDelegationNotification(requisition, req.user, delegateUser);

      return res.status(200).json({
        success: true,
        message: "Approval delegated successfully",
        data: {
          requisitionId: requisition._id,
          delegatedTo: {
            id: delegateUser._id,
            name: `${delegateUser.firstName} ${delegateUser.lastName}`,
            email: delegateUser.email
          }
        }
      });
    }

    if (action === "request-info") {
      // Handle request for more information
      currentStep.approvers[approverIndex].status = "info_requested";
      currentStep.approvers[approverIndex].comments = comment || "More information requested";
      currentStep.approvers[approverIndex].actionDate = new Date();

      // Add to history
      requisition.addHistory(
        "info_requested",
        req.user,
        comment || "Requested more information",
        { step: currentStep.nodeName }
      );

      await requisition.save();

      return res.status(200).json({
        success: true,
        message: "Information requested successfully",
        data: {
          requisitionId: requisition._id,
          comments: comment
        }
      });
    }

    if (action === "approve") {
      // Handle approval
      currentStep.approvers[approverIndex].status = "approved";
      currentStep.approvers[approverIndex].comments = comment;
      currentStep.approvers[approverIndex].approvedAt = new Date();
      currentStep.approvalsReceived = (currentStep.approvalsReceived || 0) + 1;

      // Add to history
      requisition.addHistory(
        "approved_step",
        req.user,
        comment || "Approved without comments",
        { step: currentStep.nodeName }
      );

      // Check if step is complete
      const approvalsMet = currentStep.approvalsReceived >= currentStep.minApprovalsRequired;
      const allResponded = currentStep.approvers.every(a => 
        a.status === "approved" || a.status === "rejected" || a.status === "delegated" || a.status === "info_requested"
      );

      if (approvalsMet || (allResponded && currentStep.approvalsReceived > 0)) {
        // Step completed successfully
        currentStep.status = "completed";
        currentStep.completedAt = new Date();
        currentStep.outcome = "approved";
        
        // Save completed step
        if (!requisition.approvalSteps) requisition.approvalSteps = [];
        requisition.approvalSteps.push({
          ...currentStep.toObject(),
          stepNumber: requisition.approvalSteps.length + 1
        });

        // Process next step
        await processNextWorkflowStep(requisition);
      }

      await requisition.save();

      return res.status(200).json({
        success: true,
        message: "Approved successfully",
        data: {
          requisitionId: requisition._id,
          currentStep: requisition.currentApprovalStep,
          status: requisition.status,
          approvalsReceived: currentStep.approvalsReceived,
          minApprovalsRequired: currentStep.minApprovalsRequired
        }
      });
    }

    if (action === "reject") {
      // Handle rejection
      currentStep.approvers[approverIndex].status = "rejected";
      currentStep.approvers[approverIndex].comments = comment;
      currentStep.approvers[approverIndex].rejectedAt = new Date();
      currentStep.rejectionsReceived = (currentStep.rejectionsReceived || 0) + 1;

      // Update requisition status
      requisition.status = "rejected";
      requisition.rejectedAt = new Date();
      requisition.rejectionReason = comment || "Rejected without reason";

      // Add to history
      requisition.addHistory(
        "rejected",
        req.user,
        comment || "Rejected without reason"
      );

      await requisition.save();

      return res.status(200).json({
        success: true,
        message: "Rejected successfully",
        data: {
          requisitionId: requisition._id,
          rejectedAt: requisition.rejectedAt,
          rejectionReason: requisition.rejectionReason
        }
      });
    }

    return res.status(400).json({
      success: false,
      message: "Invalid action specified"
    });

  } catch (error) {
    console.error('Error processing approval action:', error);
    res.status(500).json({
      success: false,
      message: "Server error while processing approval",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all approved requisitions
exports.getAllApprovedRequisitions = async (req, res) => {
  try {
    // Get the requesting user's company
    console.log("Requesting user ID:", req.user._id);
    const requestingUser = await User.findById(req.user._id).select('company isEnterpriseAdmin');
    if (!requestingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Base query - filter by company unless user is enterprise admin with special privileges
    const statusQuery = { status: "approved" };
    const companyQuery = requestingUser.isEnterpriseAdmin && req.query.allCompanies ? {} : { company: requestingUser.company };
    const baseQuery = { ...statusQuery, ...companyQuery };

    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get sorting parameters
    const sortField = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
    const sort = { [sortField]: sortOrder };

    // Get pending requisitions with populated employee and department info
    const requisitions = await Requisition.find(baseQuery)
      .populate({
        path: 'employee',
        select: 'firstName lastName email position',
        populate: {
          path: 'department',
          select: 'name departmentCode'
        }
      })
      .populate({
        path: 'department',
        select: 'name departmentCode'
      })
      .populate({
        path: 'company',
        select: 'name'
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalCount = await Requisition.countDocuments(baseQuery);

    console.log(`Fetched ${requisitions.length} approved requisitions for company ${requestingUser.company}`);

    res.status(200).json({
      success: true,
      data: requisitions,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        sort: `${sortField}:${sortOrder === 1 ? 'asc' : 'desc'}`,
        context: {
          company: requestingUser.company,
          isEnterpriseAdmin: requestingUser.isEnterpriseAdmin,
          allCompanies: req.query.allCompanies ? true : false
        }
      }
    });

  } catch (error) {
    console.error('Error fetching approved requisitions:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching approved requisitions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all pending requisitions
exports.getAllPendingRequisitions = async (req, res) => {
  try {
    // Get the requesting user's company
    console.log("Requesting user ID:", req.user._id);
    const requestingUser = await User.findById(req.user._id).select('company isEnterpriseAdmin');
    if (!requestingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Base query - filter by company unless user is enterprise admin with special privileges
    const statusQuery = { status: "pending" };
    const companyQuery = requestingUser.isEnterpriseAdmin && req.query.allCompanies ? {} : { company: requestingUser.company };
    const baseQuery = { ...statusQuery, ...companyQuery };

    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get sorting parameters
    const sortField = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
    const sort = { [sortField]: sortOrder };

    // Get pending requisitions with populated employee and department info
    const requisitions = await Requisition.find(baseQuery)
      .populate({
        path: 'employee',
        select: 'firstName lastName email position',
        populate: {
          path: 'department',
          select: 'name departmentCode'
        }
      })
      .populate({
        path: 'department',
        select: 'name departmentCode'
      })
      .populate({
        path: 'company',
        select: 'name'
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalCount = await Requisition.countDocuments(baseQuery);

    console.log(`Fetched ${requisitions.length} pending requisitions for company ${requestingUser.company}`);

    res.status(200).json({
      success: true,
      data: requisitions,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        sort: `${sortField}:${sortOrder === 1 ? 'asc' : 'desc'}`,
        context: {
          company: requestingUser.company,
          isEnterpriseAdmin: requestingUser.isEnterpriseAdmin,
          allCompanies: req.query.allCompanies ? true : false
        }
      }
    });

  } catch (error) {
    console.error('Error fetching pending requisitions:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching pending requisitions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Approve a requisition (legacy - without workflow)
exports.approveRequisition = async (req, res) => {
    console.log("Approving requisition with ID:", req.params.id);
    
    try {
        const requisition = await Requisition.findById(req.params.id);
        if (!requisition) return res.status(404).json({ 
            message: "Requisition not found",
            code: "REQUISITION_NOT_FOUND"
        });

        // Get approver details
        const approver = await User.findById(req.user._id);
        if (!approver) return res.status(404).json({ 
            message: "Approver not found",
            code: "APPROVER_NOT_FOUND"
        });

        // Update requisition status
        requisition.status = "approved";
        requisition.approver = req.user._id;
        requisition.approvalDate = new Date();
        await requisition.save();

        console.log(`✅ Requisition ${requisition._id} approved by ${approver.firstName}`);

        // Get employee details
        const employee = await User.findById(requisition.employee);
        if (!employee) return res.status(404).json({ 
            message: "Employee not found",
            code: "EMPLOYEE_NOT_FOUND"
        });

        // Prepare email notification using Gmail
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const requisitionUrl = `${frontendUrl}/requisitions/${requisition._id}`;
        
        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px; }
                    .content { padding: 20px; background-color: #f9f9f9; border-radius: 5px; margin-top: 20px; }
                    .button { display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
                    .details-box { background-color: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin: 20px 0; }
                    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
                    .status-badge { background-color: #4CAF50; color: white; padding: 5px 10px; border-radius: 3px; font-size: 12px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>✅ Requisition Approved</h1>
                </div>
                
                <div class="content">
                    <h2>Hello ${employee.firstName} ${employee.lastName},</h2>
                    
                    <p>Great news! Your requisition request has been approved.</p>
                    
                    <div class="details-box">
                        <p><strong>Approval Details:</strong></p>
                        <ul style="list-style: none; padding-left: 0;">
                            <li><strong>Item Name:</strong> ${requisition.itemName}</li>
                            <li><strong>Quantity:</strong> ${requisition.quantity}</li>
                            <li><strong>Purpose:</strong> ${requisition.purpose || 'Not specified'}</li>
                            <li><strong>Status:</strong> <span class="status-badge">APPROVED</span></li>
                            <li><strong>Approved By:</strong> ${approver.firstName} ${approver.lastName}</li>
                            <li><strong>Approval Date:</strong> ${new Date().toLocaleDateString()}</li>
                            <li><strong>Requisition ID:</strong> ${requisition._id}</li>
                        </ul>
                    </div>
                    
                    <p>The procurement team will now begin sourcing the product. You can track the status through your employee portal.</p>
                    
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="${requisitionUrl}" class="button">View Requisition Details</a>
                    </div>
                    
                    <div style="background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>📋 Next Steps:</strong></p>
                        <ol>
                            <li>Procurement team will source the requested item</li>
                            <li>You'll receive updates on the procurement status</li>
                            <li>Once procured, you'll be notified about collection/delivery</li>
                        </ol>
                    </div>
                    
                    <p>If you have any questions, please contact the procurement team or your approver.</p>
                    
                    <div class="footer">
                        <p>Best regards,<br>
                        <strong>The ${approver.companyName || 'Company'} Team</strong></p>
                        <p><em>This is an automated notification. Please do not reply to this email.</em></p>
                        <p>Need help? Contact: ${approver.email}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const emailText = `
REQUISITION APPROVED

Hello ${employee.firstName} ${employee.lastName},

Great news! Your requisition request has been approved.

APPROVAL DETAILS:
─────────────────────────────────────────────────────────────
Item Name:      ${requisition.itemName}
Quantity:       ${requisition.quantity}
Purpose:        ${requisition.purpose || 'Not specified'}
Status:         APPROVED ✅
Approved By:    ${approver.firstName} ${approver.lastName}
Approval Date:  ${new Date().toLocaleDateString()}
Requisition ID: ${requisition._id}
─────────────────────────────────────────────────────────────

The procurement team will now begin sourcing the product. 
You can track the status through your employee portal.

View your requisition: ${requisitionUrl}

NEXT STEPS:
1. Procurement team will source the requested item
2. You'll receive updates on the procurement status
3. Once procured, you'll be notified about collection/delivery

If you have any questions, please contact:
• Procurement team
• Your approver: ${approver.email}

Best regards,
The ${approver.companyName || 'Company'} Team

─────────────────────────────────────────────────────────────
This is an automated notification. Please do not reply to this email.
        `;

        // Send email notification using Gmail
        let emailSent = false;
        let emailError = null;
        let emailMessageId = null;

        try {
            const transporter = createGmailTransporter();
            
            if (transporter) {
                const senderEmail = process.env.GMAIL_USER || 'brianmtonga592@gmail.com';
                
                const mailOptions = {
                    from: {
                        name: approver.companyName || 'NexusMWI',
                        address: senderEmail
                    },
                    to: employee.email,
                    subject: `✅ Approved: ${requisition.itemName} - ${approver.companyName}`,
                    html: emailHtml,
                    text: emailText
                };

                const info = await transporter.sendMail(mailOptions);
                emailSent = true;
                emailMessageId = info.messageId;
                
                console.log(`📧 Requisition approval email sent to ${employee.email}`);
                console.log(`📨 Message ID: ${info.messageId}`);
                
            } else {
                console.warn('⚠️ Gmail transporter not available. Email notification skipped.');
                emailError = 'Email service not configured';
            }
            
        } catch (emailErr) {
            console.error('❌ Failed to send approval email:', emailErr.message);
            emailError = emailErr.message;
            
            // Log specific Gmail errors
            if (emailErr.code === 'EAUTH') {
                console.error('🔧 Gmail authentication error. Check your credentials in .env file');
            }
        }

        // Prepare response
        const response = {
            success: true,
            message: "Requisition approved successfully",
            code: "REQUISITION_APPROVED",
            requisition: {
                id: requisition._id,
                itemName: requisition.itemName,
                quantity: requisition.quantity,
                status: requisition.status,
                approvalDate: requisition.approvalDate,
                approver: {
                    id: approver._id,
                    name: `${approver.firstName} ${approver.lastName}`,
                    email: approver.email
                },
                employee: {
                    id: employee._id,
                    name: `${employee.firstName} ${employee.lastName}`,
                    email: employee.email
                }
            },
            notification: {
                sent: emailSent,
                recipient: employee.email,
                messageId: emailMessageId,
                error: emailError ? {
                    message: emailError,
                    requiresAttention: emailError.includes('authentication') || emailError.includes('credentials')
                } : null
            }
        };

        // Add troubleshooting info if email failed due to auth
        if (emailError && emailError.includes('authentication')) {
            response.notification.troubleshooting = {
                message: "Gmail authentication failed",
                steps: [
                    "1. Check GMAIL_USER and GMAIL_APP_PASSWORD in .env file",
                    "2. Ensure 2FA is enabled on your Google account",
                    "3. Generate a new App Password at: https://myaccount.google.com/apppasswords",
                    "4. Use the 16-character App Password (not regular password)"
                ]
            };
        }

        res.json(response);

    } catch (err) {
        console.error('❌ Error approving requisition:', err);
        
        // Handle specific errors
        if (err.name === 'CastError') {
            return res.status(400).json({ 
                success: false,
                message: "Invalid requisition ID format",
                code: "INVALID_ID_FORMAT"
            });
        }
        
        res.status(500).json({ 
            success: false,
            message: "Server error while approving requisition",
            code: "SERVER_ERROR",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Reject a requisition (legacy - without workflow)
exports.rejectRequisition = async (req, res) => {
    try {
        const requisition = await Requisition.findById(req.params.id);
        if (!requisition) return res.status(404).json({ message: "Requisition not found" });

        requisition.status = "rejected";
        requisition.approver = req.user.id;
        await requisition.save();

        // Notify the employee
        const message = `Your requisition for ${requisition.itemName} has been rejected.`;
        // await sendNotifications(requisition.employee, "Requisition Rejected", message);

        res.json({ message: "Requisition rejected and notification sent", requisition });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get user-specific requisitions (For Employees)
exports.getMyRequisitions = async (req, res) => {
    try {
        const requisitions = await Requisition.find({ employee: req.user._id })
        .populate('employee', 'firstName lastName phoneNumber email')
        .populate('department', 'name departmentCode')
        .populate('company', 'name industry')   
        .populate('approver', 'firstName lastName email');
        res.json(requisitions);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get all approved requisitions (legacy)
exports.getApprovedRequisitions = async (req, res) => {
    try {
        const requisitions = await Requisition.find({ status: "approved" }).populate("employee", "name email");
        res.json(requisitions);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get all rejected requisitions (legacy)
exports.getRejectedRequisitions = async (req, res) => {
    try {
        const requisitions = await Requisition.find({ status: "rejected" }).populate("employee", "name email");
        res.json(requisitions);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get all pending requisitions (legacy)
exports.getPendingRequisitions = async (req, res) => {
    try {
        const requisitions = await Requisition.find({status:"pending"}).populate("employee", "firstName lastName email");
        res.json(requisitions);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get requisition stats
exports.getRequisitionStats = async (req, res) => {
    try {
        // Get the requesting user's company
        const requestingUser = await User.findById(req.user._id).select('company isEnterpriseAdmin');
        if (!requestingUser) {
          return res.status(404).json({ 
            success: false,
            message: "User not found" 
          });
        }
    
        // Base query - filter by company unless user is enterprise admin with special privileges
        const companyQuery = requestingUser.isEnterpriseAdmin && req.query.allCompanies ? {} : { company: requestingUser.company };
    
        // Get counts with company filtering
        const [total, pending, approved, rejected] = await Promise.all([
          Requisition.countDocuments(companyQuery),
          Requisition.countDocuments({ ...companyQuery, status: "pending" }),
          Requisition.countDocuments({ ...companyQuery, status: "approved" }),
          Requisition.countDocuments({ ...companyQuery, status: "rejected" })
        ]);
    
        // Get pending requisitions with populated data and company filtering
        const pendingRequisitions = await Requisition.find({ ...companyQuery, status: "pending" })
          .populate({
            path: 'employee',
            select: 'firstName lastName email',
            populate: {
              path: 'department',
              select: 'name departmentCode'
            }
          })
          .populate({
            path: 'department',
            select: 'name departmentCode'
          })
          .populate({
            path: 'company',
            select: 'name logo'
          })
          .limit(10) // Limit to 10 most recent pending requisitions
          .sort({ createdAt: -1 }) // Sort by newest first
          .lean();
    
        // Calculate urgency distribution
        const urgencyStats = await Requisition.aggregate([
          { $match: { ...companyQuery, status: "pending" } },
          {
            $group: {
              _id: "$urgency",
              count: { $sum: 1 }
            }
          }
        ]);
    
        // Format urgency stats
        const urgencyDistribution = {
          high: urgencyStats.find(stat => stat._id === "high")?.count || 0,
          medium: urgencyStats.find(stat => stat._id === "medium")?.count || 0,
          low: urgencyStats.find(stat => stat._id === "low")?.count || 0
        };
    
        res.status(200).json({
          success: true,
          data: {
            counts: {
              total,
              pending,
              approved,
              rejected
            },
            urgencyDistribution,
            recentPending: pendingRequisitions,
            meta: {
              context: {
                company: requestingUser.company,
                isEnterpriseAdmin: requestingUser.isEnterpriseAdmin,
                allCompanies: req.query.allCompanies ? true : false
              }
            }
          }
        });
    
      } catch (error) {
        console.error('Error fetching requisition stats:', error);
        res.status(500).json({ 
          success: false,
          message: 'Server error while fetching requisition statistics',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
};

// Travel requisition
exports.travelRequisition = async (req, res) => {
    try {
        console.log(req.body);
        const { destination, purpose, departureDate, returnDate, meansOfTransport } = req.body;

        const newRequisition = await Requisition.create({
            employee: req.user.id, // User from JWT
            destination,
            purpose,
            departureDate,
            returnDate,
            meansOfTransport,
        });

        res.status(201).json({ message: "Travel requisition submitted successfully", requisition: newRequisition });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ============================================
// NEW WORKFLOW FUNCTIONS
// ============================================

// New function to handle approval with workflow
exports.approveRequisitionStep = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments, delegateTo, action = "approve" } = req.body;
    const approverId = req.user._id;

    console.log(`\n📝 Starting approval process for requisition: ${id}`);
    console.log(`User: ${approverId}, Action: ${action}, Comments: ${comments}`);

    // Find requisition with proper population
    const requisition = await Requisition.findById(id)
      .populate('workflow')
      .populate('employee')
      .populate({
        path: 'currentApprovalStep.approvers.userId',
        select: 'firstName lastName email role department',
        model: 'User'
      });

    if (!requisition) {
      console.log(`❌ Requisition ${id} not found`);
      return res.status(404).json({
        success: false,
        message: "Requisition not found"
      });
    }

    console.log(`Requisition found. Status: ${requisition.status}`);
    console.log(`Current step:`, requisition.currentApprovalStep ? 'Exists' : 'Null');

    // Check if requisition is in review
    if (requisition.status !== "in-review") {
      return res.status(400).json({
        success: false,
        message: `Requisition is not in review. Current status: ${requisition.status}`
      });
    }

    // Find approver in current step (don't use canUserApprove method due to null issues)
    let approverIndex = -1;
    let approver = null;

    if (requisition.currentApprovalStep && requisition.currentApprovalStep.approvers) {
      for (let i = 0; i < requisition.currentApprovalStep.approvers.length; i++) {
        const currentApprover = requisition.currentApprovalStep.approvers[i];
        
        if (!currentApprover || !currentApprover.userId) {
          console.log(`Skipping approver at index ${i} - null or missing userId`);
          continue;
        }

        // Get the approver ID - handle both populated and non-populated
        let approverUserId;
        if (currentApprover.userId._id) {
          // Already populated
          approverUserId = currentApprover.userId._id.toString();
        } else {
          // Not populated, use the ID directly
          approverUserId = currentApprover.userId.toString();
        }

        console.log(`Checking approver ${i}: ${approverUserId} vs ${approverId}`);
        
        if (approverUserId === approverId.toString() && currentApprover.status === "pending") {
          approverIndex = i;
          approver = currentApprover;
          console.log(`✅ Found approver at index ${i}`);
          break;
        }
      }
    }

    // If not found by userId, try to find by email
    if (approverIndex === -1) {
      const user = await User.findById(approverId);
      if (user && user.email) {
        console.log(`Trying to find by email: ${user.email}`);
        
        for (let i = 0; i < requisition.currentApprovalStep.approvers.length; i++) {
          const currentApprover = requisition.currentApprovalStep.approvers[i];
          
          if (currentApprover.email && 
              currentApprover.email.toLowerCase() === user.email.toLowerCase() &&
              currentApprover.status === "pending") {
            approverIndex = i;
            approver = currentApprover;
            console.log(`✅ Found approver by email at index ${i}`);
            break;
          }
        }
      }
    }

    // If still not found, check for department head scenario
    if (approverIndex === -1) {
      const user = await User.findById(approverId);
      if (user && user.role === 'Department Head' && user.department) {
        console.log(`User is Department Head, department: ${user.department}`);
        
        // Check if this requisition belongs to user's department
        if (requisition.department && 
            requisition.department.toString() === user.department.toString()) {
          
          // Check if current step is for department approval
          const stepName = requisition.currentApprovalStep.nodeName || '';
          if (stepName.toLowerCase().includes('department') || 
              stepName.toLowerCase().includes('head')) {
            
            console.log(`✅ Adding department head as approver`);
            
            // Add user to approvers list
            requisition.currentApprovalStep.approvers.push({
              userId: approverId,
              name: `${user.firstName} ${user.lastName}`,
              email: user.email,
              status: "pending",
              role: user.role,
              department: user.department
            });
            
            await requisition.save();
            
            approverIndex = requisition.currentApprovalStep.approvers.length - 1;
            approver = requisition.currentApprovalStep.approvers[approverIndex];
          }
        }
      }
    }

    if (approverIndex === -1 || !approver) {
      console.log(`❌ User not authorized to approve this requisition`);
      console.log(`Approvers list:`, requisition.currentApprovalStep?.approvers);
      return res.status(403).json({
        success: false,
        message: "You are not authorized to approve this requisition"
      });
    }

    // Handle delegation
    if (action === "delegate" && delegateTo) {
      return await handleDelegation(requisition, approverId, delegateTo, comments, res);
    }

    // Handle different actions
    switch (action) {
      case "approve":
        // Update approver status
        requisition.currentApprovalStep.approvers[approverIndex].status = "approved";
        requisition.currentApprovalStep.approvers[approverIndex].approvedAt = new Date();
        requisition.currentApprovalStep.approvers[approverIndex].comments = comments;
        requisition.currentApprovalStep.approvalsReceived += 1;

        console.log(`✅ Approved. Approvals: ${requisition.currentApprovalStep.approvalsReceived}/${requisition.currentApprovalStep.minApprovalsRequired}`);

        // Add to history
        requisition.addHistory(
          "approved_step",
          req.user,
          comments || "Approved without comments",
          { step: requisition.currentApprovalStep.nodeName }
        );

        // Add to timeline
        requisition.addToTimeline(
          requisition.approvalSteps ? requisition.approvalSteps.length + 1 : 1,
          "approved",
          req.user,
          requisition.currentApprovalStep.nodeId,
          requisition.currentApprovalStep.nodeName,
          { comments }
        );

        // Check if step is complete
        await checkAndProcessStepCompletion(requisition);
        break;

      case "reject":
        // Update approver status
        requisition.currentApprovalStep.approvers[approverIndex].status = "rejected";
        requisition.currentApprovalStep.approvers[approverIndex].comments = comments;
        requisition.currentApprovalStep.rejectionsReceived += 1;

        // Update requisition status
        requisition.status = "rejected";
        requisition.rejectedAt = new Date();
        requisition.rejectionReason = comments || "Rejected without specific reason";

        // Add to history
        requisition.addHistory(
          "rejected",
          req.user,
          comments || "Rejected without specific reason"
        );

        // Add to timeline
        requisition.addToTimeline(
          requisition.approvalSteps ? requisition.approvalSteps.length + 1 : 1,
          "rejected",
          req.user,
          requisition.currentApprovalStep.nodeId,
          requisition.currentApprovalStep.nodeName,
          { reason: comments }
        );
        break;

      case "request-info":
        // Update approver status
        requisition.currentApprovalStep.approvers[approverIndex].status = "info_requested";
        requisition.currentApprovalStep.approvers[approverIndex].comments = comments || "More information requested";
        requisition.currentApprovalStep.approvers[approverIndex].actionDate = new Date();

        // Add to history
        requisition.addHistory(
          "info_requested",
          req.user,
          comments || "Requested more information",
          { step: requisition.currentApprovalStep.nodeName }
        );
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid action specified"
        });
    }

    await requisition.save();
    console.log(`✅ Requisition ${id} updated successfully`);

    res.status(200).json({
      success: true,
      message: `Requisition ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'updated'} successfully`,
      data: {
        requisitionId: requisition._id,
        currentStep: requisition.currentApprovalStep,
        status: requisition.status
      }
    });

  } catch (error) {
    console.error('❌ Error in approveRequisitionStep:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: "Server error while processing approval",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// New function to reject with workflow
exports.rejectRequisitionStep = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, comments } = req.body;
        const approverId = req.user._id;

        const requisition = await Requisition.findById(id);

        if (!requisition) {
            return res.status(404).json({
                success: false,
                message: "Requisition not found"
            });
        }

        // Check authorization
        if (!requisition.canUserApprove(approverId)) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to reject this requisition"
            });
        }

        // Update approver status
        const approverIndex = requisition.currentApprovalStep.approvers
            .findIndex(a => a.userId && a.userId.equals(approverId));

        if (approverIndex === -1) {
            return res.status(400).json({
                success: false,
                message: "Approver not found in current step"
            });
        }

        requisition.currentApprovalStep.approvers[approverIndex].status = "rejected";
        requisition.currentApprovalStep.approvers[approverIndex].comments = comments || reason;
        requisition.currentApprovalStep.rejectionsReceived += 1;

        // Update requisition status
        requisition.status = "rejected";
        requisition.rejectedAt = new Date();
        requisition.rejectionReason = reason || comments;

        // Add to history and timeline
        requisition.addHistory(
            "rejected",
            req.user,
            reason || "Rejected without specific reason"
        );

        requisition.addToTimeline(
            requisition.approvalSteps ? requisition.approvalSteps.length + 1 : 1,
            "rejected",
            req.user,
            requisition.currentApprovalStep.nodeId,
            requisition.currentApprovalStep.nodeName,
            { reason, comments }
        );

        await requisition.save();

        // Send rejection notification
        await sendRequisitionNotification({
            requisitionId: requisition._id,
            action: "rejected",
            actor: req.user._id,
            reason
        });

        res.status(200).json({
            success: true,
            message: "Requisition rejected successfully",
            data: {
                requisitionId: requisition._id,
                rejectedAt: requisition.rejectedAt,
                rejectionReason: requisition.rejectionReason
            }
        });

    } catch (error) {
        console.error('Error rejecting requisition:', error);
        res.status(500).json({
            success: false,
            message: "Server error while rejecting requisition",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// New function to get requisitions pending user's approval
exports.getPendingApprovals = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Find requisitions where user is a pending approver
        const query = {
            company: user.company,
            status: "in-review",
            "currentApprovalStep.approvers": {
                $elemMatch: {
                    userId: user._id,
                    status: "pending"
                }
            }
        };

        const total = await Requisition.countDocuments(query);

        const requisitions = await Requisition.find(query)
            .populate([
                {
                    path: 'employee',
                    select: 'firstName lastName email position department',
                    populate: {
                        path: 'department',
                        select: 'name departmentCode'
                    }
                },
                {
                    path: 'department',
                    select: 'name departmentCode'
                },
                {
                    path: 'workflow',
                    select: 'name code'
                }
            ])
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Add additional info
        const enrichedRequisitions = requisitions.map(req => ({
            ...req,
            currentStep: req.currentApprovalStep,
            isUrgent: req.urgency === "high" || 
                     (req.currentApprovalStep.timeoutAt && 
                      new Date(req.currentApprovalStep.timeoutAt) < new Date(Date.now() + 24 * 60 * 60 * 1000))
        }));

        res.status(200).json({
            success: true,
            data: enrichedRequisitions,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            summary: {
                pendingCount: total,
                urgentCount: enrichedRequisitions.filter(r => r.isUrgent).length
            }
        });

    } catch (error) {
        console.error('Error fetching pending approvals:', error);
        res.status(500).json({
            success: false,
            message: "Server error while fetching pending approvals",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// New function to get requisition workflow details
exports.getRequisitionWorkflowDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const requisition = await Requisition.findById(id)
            .populate([
                {
                    path: 'workflow',
                    select: 'name code description nodes connections version'
                },
                {
                    path: 'employee',
                    select: 'firstName lastName email'
                },
                {
                    path: 'currentApprovalStep.approvers.userId',
                    select: 'firstName lastName email avatar role'
                },
                {
                    path: 'approvalSteps.approvers.userId',
                    select: 'firstName lastName email'
                }
            ]);

        if (!requisition) {
            return res.status(404).json({
                success: false,
                message: "Requisition not found"
            });
        }

        res.status(200).json({
            success: true,
            data: {
                requisition: {
                    id: requisition._id,
                    itemName: requisition.itemName,
                    status: requisition.status,
                    createdAt: requisition.createdAt,
                    estimatedCost: requisition.estimatedCost,
                    category: requisition.category
                },
                workflow: requisition.workflow,
                currentStep: requisition.currentApprovalStep,
                completedSteps: requisition.approvalSteps || [],
                timeline: requisition.workflowTimeline || [],
                sla: {
                    startDate: requisition.slaStartDate,
                    dueDate: requisition.slaDueDate,
                    breached: requisition.slaBreached
                }
            }
        });

    } catch (error) {
        console.error('Error fetching workflow details:', error);
        res.status(500).json({
            success: false,
            message: "Server error while fetching workflow details",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// EXPORTS
// ============================================

module.exports = exports;