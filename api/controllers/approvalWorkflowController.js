const mongoose = require('mongoose');
import ApprovalWorkflow from '../../models/approvalWorkflow.js';
import Requisition from '../../models/requisition.js';
import User from '../../models/user.js';
import Department from '../../models/departments.js';

// Helper function to validate workflow nodes
const validateWorkflowNodes = (nodes) => {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error('Workflow must have at least one node');
  }

  // Check for exactly one start and one end node
  const startNodes = nodes.filter(node => node.type === 'start');
  const endNodes = nodes.filter(node => node.type === 'end');

  if (startNodes.length !== 1) {
    throw new Error('Workflow must have exactly one start node');
  }

  if (endNodes.length === 0) {
    throw new Error('Workflow must have at least one end node');
  }

  // Validate node structure
  for (const node of nodes) {
    if (!node.id || !node.type || !node.name) {
      throw new Error('Each node must have id, type, and name');
    }

    if (node.type === 'approval' || node.type === 'parallel') {
      if (!node.approvers || !Array.isArray(node.approvers) || node.approvers.length === 0) {
        throw new Error('Approval nodes must have at least one approver');
      }

      if (node.minApprovals < 1 || node.minApprovals > node.approvers.length) {
        throw new Error('Minimum approvals must be between 1 and number of approvers');
      }
    }

    if (node.type === 'condition') {
      if (!node.conditions || !Array.isArray(node.conditions) || node.conditions.length === 0) {
        throw new Error('Condition nodes must have at least one condition');
      }

      if (!node.trueBranch || !node.falseBranch) {
        throw new Error('Condition nodes must have both true and false branches');
      }
    }
  }

  return true;
};

// Helper function to validate workflow connections
const validateWorkflowConnections = (nodes, connections) => {
  if (!Array.isArray(connections)) return true;

  const nodeIds = nodes.map(node => node.id);

  for (const connection of connections) {
    if (!connection.from || !connection.to) {
      throw new Error('Each connection must have from and to node IDs');
    }

    if (!nodeIds.includes(connection.from) || !nodeIds.includes(connection.to)) {
      throw new Error('Connection references non-existent node');
    }

    // Check for cycles
    // Simple check - more complex cycle detection would be needed for production
    if (connection.from === connection.to) {
      throw new Error('Cannot connect a node to itself');
    }
  }

  return true;
};

// @desc    Create new approval workflow
// @route   POST /api/approval-workflows
// @access  Private (Admin/Manager)
export const createWorkflow = async (req, res) => {
  try {
    console.log('User object:', req.user); // Debug log
    console.log('Request body:', req.body); // Debug log
    
    const {
      name,
      description,
      isActive = true,
      priority = 5,
      applyToAll = false,
      departments = [],
      categories = [],
      minAmount = 0,
      maxAmount,
      triggerConditions = [],
      nodes = [],
      connections = [],
      slaHours = 72,
      autoApproveBelow,
      requireCFOAbove = 500000,
      requireLegalReview = false,
      requireITReview = false,
      allowDelegation = true,
      notifications = [],
      version = '1.0',
      isDraft = true,
      company: companyFromBody, // Get from request body
      createdBy: createdByFromBody // Get from request body
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Workflow name is required'
      });
    }

    // Get company and user - PRIORITIZE request body over req.user
    // Since req.user.company is undefined, use company from request body
    const companyId = companyFromBody || req.user?.company;
    const createdById = createdByFromBody || req.user?.id || req.user?._id;

    console.log('Using Company ID:', companyId); // Debug
    console.log('Using Created By ID:', createdById); // Debug

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company information is required. Please provide company ID.'
      });
    }

    if (!createdById) {
      return res.status(400).json({
        success: false,
        message: 'User information is required'
      });
    }

    // Only validate nodes if provided (allow empty workflows initially)
    if (nodes && nodes.length > 0) {
      validateWorkflowNodes(nodes, isDraft);
      validateWorkflowConnections(nodes, connections || []);
    }

    // Check for duplicate workflow name in same company
    const existingWorkflow = await ApprovalWorkflow.findOne({
      company: companyId,
      name,
      isDraft: false
    });

    if (existingWorkflow) {
      return res.status(400).json({
        success: false,
        message: 'A workflow with this name already exists'
      });
    }

    // Create workflow
    const workflowData = {
      name,
      description,
      isActive,
      priority,
      applyToAll,
      departments,
      categories,
      minAmount,
      maxAmount,
      triggerConditions,
      nodes: nodes.length > 0 ? nodes : [
        {
          id: 'start-1',
          type: 'start',
          name: 'Start',
          description: 'Workflow start point',
          position: { x: 100, y: 100 },
          approvers: [],
          approvalType: 'sequential',
          minApprovals: 1,
          conditions: [],
          trueBranch: '',
          falseBranch: '',
          timeoutHours: 24,
          escalationTo: '',
          isMandatory: true,
          canDelegate: true,
          actions: [],
        },
        {
          id: 'end-1',
          type: 'end',
          name: 'End',
          description: 'Workflow end point',
          position: { x: 400, y: 100 },
          approvers: [],
          approvalType: 'sequential',
          minApprovals: 1,
          conditions: [],
          trueBranch: '',
          falseBranch: '',
          timeoutHours: 24,
          escalationTo: '',
          isMandatory: true,
          canDelegate: true,
          actions: [],
        }
      ],
      connections: connections.length > 0 ? connections : [],
      slaHours,
      autoApproveBelow,
      requireCFOAbove,
      requireLegalReview,
      requireITReview,
      allowDelegation,
      notifications,
      version,
      isDraft: nodes.length === 0 ? true : isDraft,
      createdBy: createdById,
      company: companyId
    };

    console.log('Workflow data to save:', workflowData); // Debug log

    const workflow = new ApprovalWorkflow(workflowData);
    await workflow.save();

    // Populate references
    await workflow.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'departments', select: 'name code' },
      { path: 'company', select: 'name' }
    ]);

    res.status(201).json({
      success: true,
      data: workflow,
      message: 'Workflow created successfully'
    });
  } catch (error) {
    console.error('Create workflow error details:', error);
    console.error('Error stack:', error.stack);
    
    // Handle specific validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages
      });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate workflow name or code'
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create workflow'
    });
  }
};

// @desc    Get all approval workflows
// @route   GET /api/approval-workflows
// @access  Private
export const getWorkflows = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = '-createdAt',
      search,
      status,
      department,
      category,
      isActive,
      isDraft
    } = req.query;

    console.log('Get workflows - User:', req.user);
    
    // Build query - handle missing company
    const query = {};
    
    // Option 1: If we have company from user, use it
    if (req.user?.company) {
      query.company = req.user.company;
    } 
    // Option 2: Find workflows created by this user
    else if (req.user?._id) {
      query.createdBy = req.user._id;
      console.log('Using createdBy query:', req.user._id);
    }
    // Option 3: If still no query, find all (for debugging)
    else {
      console.log('No company or user ID, finding all workflows (debug mode)');
      // For now, find all - but this should be restricted in production
    }

    console.log('Get workflows - Query:', JSON.stringify(query, null, 2));

    // Search by name or description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by status
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (isDraft !== undefined) {
      query.isDraft = isDraft === 'true';
    }

    // Filter by department
    if (department) {
      query.departments = department;
    }

    // Filter by category
    if (category) {
      query.categories = category;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count
    const total = await ApprovalWorkflow.countDocuments(query);
    console.log('Total workflows found:', total);

    // Get workflows with pagination and sorting
    const workflows = await ApprovalWorkflow.find(query)
      .populate([
        { path: 'createdBy', select: 'name email' },
        { path: 'departments', select: 'name code' },
        { path: 'activeInstances' }
      ])
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    console.log('Workflows retrieved:', workflows.length);
    console.log('Workflow companies:', workflows.map(w => w.company));

    res.status(200).json({
      success: true,
      data: workflows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get workflows error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflows'
    });
  }
};


// @desc    Get single approval workflow
// @route   GET /api/approval-workflows/:id
// @access  Private
export const getWorkflow = async (req, res) => {
  try {
    console.log('Get workflow - User:', req.user);
    
    // Build flexible query
    const query = { _id: req.params.id };
    
    if (req.user?.company) {
      query.company = req.user.company;
    } else if (req.user?.id) {
      query.createdBy = req.user.id;
    }
    
    console.log('Get workflow - Query:', query);

    const workflow = await ApprovalWorkflow.findOne(query).populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'updatedBy', select: 'name email' },
      { path: 'departments', select: 'name code head' },
      { 
        path: 'nodes.approvers.userId',
        select: 'name email role department avatar',
        model: 'User'
      }
    ]);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }

    res.status(200).json({
      success: true,
      data: workflow
    });
  } catch (error) {
    console.error('Get workflow error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflow'
    });
  }
};

// @desc    Update approval workflow
// @route   PUT /api/approval-workflows/:id
// @access  Private (Admin/Manager)
export const updateWorkflow = async (req, res) => {
  try {
    const {
      name,
      description,
      isActive,
      priority,
      applyToAll,
      departments,
      categories,
      minAmount,
      maxAmount,
      triggerConditions,
      nodes,
      connections,
      slaHours,
      autoApproveBelow,
      requireCFOAbove,
      requireLegalReview,
      requireITReview,
      allowDelegation,
      notifications,
      version,
      isDraft,
      company // Get company from request body
    } = req.body;

    console.log('Update workflow - User:', req.user);
    console.log('Update workflow - Body company:', company);
    console.log('Update workflow - User company:', req.user?.company);

    // Build query - try to find by ID first, then optionally by company
    const query = { _id: req.params.id };
    
    // If user has company, add it to query
    if (req.user?.company) {
      query.company = req.user.company;
    } 
    // If company is provided in body, use it
    else if (company) {
      query.company = company;
    }
    // Otherwise, find workflow created by this user
    else if (req.user?.id) {
      query.createdBy = req.user.id;
    }

    console.log('Update workflow - Query:', query);

    // Find workflow
    let workflow = await ApprovalWorkflow.findOne(query);

    if (!workflow) {
      console.log('Workflow not found with query:', query);
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }

    console.log('Found workflow:', workflow._id);

    // Check if workflow is in use (if trying to deactivate or modify significantly)
    if (isActive === false && workflow.isActive === true) {
      const activeRequisitions = await Requisition.countDocuments({
        workflow: workflow._id,
        status: { $in: ['pending', 'in-review', 'in-approval'] }
      });

      if (activeRequisitions > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot deactivate workflow with ${activeRequisitions} active requisitions`
        });
      }
    }

    // Validate nodes if provided
    if (nodes && workflow.isDraft === false) {
      validateWorkflowNodes(nodes);
      validateWorkflowConnections(nodes, connections || workflow.connections);
    }

    // Update workflow
    const updateData = {
      name: name || workflow.name,
      description: description !== undefined ? description : workflow.description,
      isActive: isActive !== undefined ? isActive : workflow.isActive,
      priority: priority || workflow.priority,
      applyToAll: applyToAll !== undefined ? applyToAll : workflow.applyToAll,
      departments: departments || workflow.departments,
      categories: categories || workflow.categories,
      minAmount: minAmount !== undefined ? minAmount : workflow.minAmount,
      maxAmount: maxAmount !== undefined ? maxAmount : workflow.maxAmount,
      triggerConditions: triggerConditions || workflow.triggerConditions,
      nodes: nodes || workflow.nodes,
      connections: connections || workflow.connections,
      slaHours: slaHours || workflow.slaHours,
      autoApproveBelow: autoApproveBelow !== undefined ? autoApproveBelow : workflow.autoApproveBelow,
      requireCFOAbove: requireCFOAbove || workflow.requireCFOAbove,
      requireLegalReview: requireLegalReview !== undefined ? requireLegalReview : workflow.requireLegalReview,
      requireITReview: requireITReview !== undefined ? requireITReview : workflow.requireITReview,
      allowDelegation: allowDelegation !== undefined ? allowDelegation : workflow.allowDelegation,
      notifications: notifications || workflow.notifications,
      version: version || workflow.version,
      isDraft: isDraft !== undefined ? isDraft : workflow.isDraft,
      updatedBy: req.user.id
    };

    console.log('Update data:', updateData);

    workflow = await ApprovalWorkflow.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'updatedBy', select: 'name email' },
      { path: 'departments', select: 'name code' }
    ]);

    res.status(200).json({
      success: true,
      data: workflow,
      message: 'Workflow updated successfully'
    });
 } catch (error) {
    console.error('Update workflow error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update workflow'
    });
  }
};

// @desc    Delete approval workflow
// @route   DELETE /api/workflows/:id
// @access  Private (Admin/Manager)
export const deleteWorkflow = async (req, res) => {
  try {
    console.log('DELETE /api/workflows/:id called');
    console.log('Workflow ID to delete:', req.params.id);
    console.log('User making request:', {
      id: req.user.id,
      role: req.user.role,
      company: req.user.company
    });

    // Build query - try multiple approaches to find the workflow
    const query = { _id: req.params.id };
    
    // First, try to find by company if available
    if (req.user?.company) {
      query.company = req.user.company;
      console.log('Querying by company:', req.user.company);
    } 
    // If no company, try to find by createdBy (user who created the workflow)
    else if (req.user?.id || req.user?._id) {
      const userId = req.user.id || req.user._id;
      query.createdBy = userId;
      console.log('Querying by createdBy:', userId);
    }
    // If still no query criteria, allow admin/enterprise users to delete
    else if (req.user?.role === 'Enterprise(CEO, CFO, etc.)' || req.user?.role === 'admin') {
      console.log('Admin/Enterprise user, allowing delete without company filter');
      // Just use the ID query
    } 
    // Otherwise, restrict access
    else {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete workflows'
      });
    }

    console.log('Final query for workflow:', query);

    // Find workflow
    const workflow = await ApprovalWorkflow.findOne(query);
    
    if (!workflow) {
      console.log('Workflow not found with query:', query);
      
      // For debugging, show what workflows exist
      const allWorkflows = await ApprovalWorkflow.find({}, '_id name createdBy company');
      console.log('Available workflows:', allWorkflows);
      
      return res.status(404).json({
        success: false,
        message: 'Workflow not found or you do not have permission to delete it'
      });
    }

    console.log('Found workflow:', {
      id: workflow._id,
      name: workflow.name,
      createdBy: workflow.createdBy,
      company: workflow.company
    });

    // Check if workflow is in use
    const requisitionCount = await Requisition.countDocuments({
      workflow: workflow._id
    });

    if (requisitionCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete workflow with ${requisitionCount} associated requisitions`
      });
    }

    // Perform deletion
    await ApprovalWorkflow.deleteOne({ _id: workflow._id });
    console.log('Workflow deleted successfully:', workflow._id);

    res.status(200).json({
      success: true,
      message: 'Workflow deleted successfully',
      deletedWorkflow: {
        id: workflow._id,
        name: workflow.name
      }
    });
  } catch (error) {
    console.error('Delete workflow error:', error);
    console.error('Error stack:', error.stack);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid workflow ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete workflow'
    });
  }
};

// @desc    Clone approval workflow
// @route   POST /api/workflows/:id/clone
// @access  Private (Admin/Manager)
export const cloneWorkflow = async (req, res) => {
  try {
    const { name: newName, description: newDescription } = req.body;

    console.log('Clone workflow - User:', req.user);
    console.log('Clone workflow - Body:', req.body);

    // Build flexible query
    const query = { _id: req.params.id };
    
    // Try multiple approaches to find the workflow
    if (req.user?.company) {
      query.company = req.user.company;
      console.log('Querying by company:', req.user.company);
    } else if (req.user?.id || req.user?._id) {
      const userId = req.user.id || req.user._id;
      query.createdBy = userId;
      console.log('Querying by createdBy:', userId);
    } else {
      // For admin/enterprise users, allow cloning any workflow
      console.log('No company or user ID, trying to find workflow by ID only');
    }

    console.log('Clone workflow - Query:', query);

    // Find original workflow
    const originalWorkflow = await ApprovalWorkflow.findOne(query);

    if (!originalWorkflow) {
      console.log('Original workflow not found with query:', query);
      return res.status(404).json({
        success: false,
        message: 'Workflow not found or you do not have permission to clone it'
      });
    }

    console.log('Found original workflow:', originalWorkflow._id);

    // Get user ID for createdBy field
    const createdById = req.user?.id || req.user?._id;
    if (!createdById) {
      return res.status(400).json({
        success: false,
        message: 'User information is required for cloning'
      });
    }

    // Create clone data
    const cloneData = {
      ...originalWorkflow.toObject(),
      _id: undefined, // Remove the original ID
      name: newName || `${originalWorkflow.name} (Copy)`,
      description: newDescription || originalWorkflow.description,
      code: undefined, // Will be auto-generated
      isDraft: true, // Clone as draft
      createdBy: createdById,
      updatedBy: undefined,
      statistics: {
        totalRequests: 0,
        avgApprovalTime: null,
        completionRate: null,
        lastUsed: null,
        activeInstances: 0
      },
      activeInstances: 0,
      createdAt: undefined,
      updatedAt: undefined,
      __v: undefined // Remove version key
    };

    // Remove any undefined values
    Object.keys(cloneData).forEach(key => {
      if (cloneData[key] === undefined) {
        delete cloneData[key];
      }
    });

    console.log('Clone data prepared:', cloneData.name);

    const clonedWorkflow = new ApprovalWorkflow(cloneData);
    await clonedWorkflow.save();

    // Populate the response
    await clonedWorkflow.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'departments', select: 'name code' },
      { path: 'company', select: 'name' }
    ]);

    console.log('Workflow cloned successfully:', clonedWorkflow._id);

    res.status(201).json({
      success: true,
      data: clonedWorkflow,
      message: 'Workflow cloned successfully'
    });
  } catch (error) {
    console.error('Clone workflow error:', error);
    console.error('Error stack:', error.stack);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to clone workflow'
    });
  }
};


// @desc    Publish workflow (convert draft to active)
// @route   POST /api/workflows/:id/publish
// @access  Private (Admin/Manager)
export const publishWorkflow = async (req, res) => {
  try {
    console.log('Publish workflow - User:', req.user);
    console.log('Publish workflow - Params:', req.params);

    // Build flexible query
    const query = { _id: req.params.id };
    
    // Try multiple approaches to find the workflow
    if (req.user?.company) {
      query.company = req.user.company;
      console.log('Querying by company:', req.user.company);
    } else if (req.user?.id || req.user?._id) {
      const userId = req.user.id || req.user._id;
      query.createdBy = userId;
      console.log('Querying by createdBy:', userId);
    } else {
      // For admin/enterprise users, allow publishing any workflow
      console.log('No company or user ID, trying to find workflow by ID only');
    }

    console.log('Publish workflow - Query:', query);

    // Find workflow
    const workflow = await ApprovalWorkflow.findOne(query);

    if (!workflow) {
      console.log('Workflow not found with query:', query);
      return res.status(404).json({
        success: false,
        message: 'Draft workflow not found or you do not have permission to publish it'
      });
    }

    console.log('Found workflow:', {
      id: workflow._id,
      name: workflow.name,
      isDraft: workflow.isDraft,
      createdBy: workflow.createdBy
    });

    // Check if workflow is already published
    if (!workflow.isDraft) {
      return res.status(400).json({
        success: false,
        message: 'Workflow is already published'
      });
    }

    // Validate workflow before publishing
    try {
      validateWorkflowNodes(workflow.nodes);
      validateWorkflowConnections(workflow.nodes, workflow.connections);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: `Cannot publish workflow: ${validationError.message}`,
        error: validationError.message
      });
    }

    // Check for conflicting workflows (only if user has company)
    if (req.user?.company) {
      const conflictingWorkflow = await ApprovalWorkflow.findOne({
        company: req.user.company,
        _id: { $ne: workflow._id },
        isActive: true,
        isDraft: false,
        $or: [
          { applyToAll: true },
          { departments: { $in: workflow.departments } },
          { categories: { $in: workflow.categories } }
        ]
      });

      if (conflictingWorkflow) {
        return res.status(400).json({
          success: false,
          message: 'Active workflow with similar scope already exists',
          conflictingWorkflow: {
            id: conflictingWorkflow._id,
            name: conflictingWorkflow.name,
            code: conflictingWorkflow.code
          }
        });
      }
    }

    // Get user ID for updatedBy field
    const updatedById = req.user?.id || req.user?._id;
    if (!updatedById) {
      return res.status(400).json({
        success: false,
        message: 'User information is required for publishing'
      });
    }

    // Publish workflow
    workflow.isDraft = false;
    workflow.isActive = true;
    workflow.updatedBy = updatedById;
    
    // Increment version
    const currentVersion = parseFloat(workflow.version) || 1.0;
    workflow.version = (currentVersion + 0.1).toFixed(1);
    
    workflow.publishedAt = new Date();

    await workflow.save();

    // Populate the response
    await workflow.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'updatedBy', select: 'name email' },
      { path: 'departments', select: 'name code' },
      { path: 'company', select: 'name' }
    ]);

    console.log('Workflow published successfully:', workflow._id);

    res.status(200).json({
      success: true,
      data: workflow,
      message: 'Workflow published successfully'
    });
  } catch (error) {
    console.error('Publish workflow error:', error);
    console.error('Error stack:', error.stack);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to publish workflow'
    });
  }
};

// @desc    Get applicable workflow for requisition
// @route   GET /api/approval-workflows/applicable
// @access  Private
export const getApplicableWorkflow = async (req, res) => {
  try {
    const { departmentId, category, estimatedCost, departmentCode, urgency, isCustomItem } = req.query;

    // Create mock requisition object for evaluation
    const mockRequisition = {
      department: departmentId,
      departmentCode,
      category,
      estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
      urgency,
      isCustomItem: isCustomItem === 'true'
    };

    // Find applicable workflow
    const workflow = await ApprovalWorkflow.findApplicableWorkflow(
      mockRequisition,
      req.user.company
    );

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'No applicable workflow found',
        data: null
      });
    }

    res.status(200).json({
      success: true,
      data: workflow
    });
  } catch (error) {
    console.error('Get applicable workflow error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to find applicable workflow'
    });
  }
};

// @desc    Test workflow with sample data
// @route   POST /api/approval-workflows/:id/test
// @access  Private (Admin/Manager)
export const testWorkflow = async (req, res) => {
  try {
    const { testData } = req.body;

    // Find workflow
    const workflow = await ApprovalWorkflow.findOne({
      _id: req.params.id,
      company: req.user.company
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }

    // Test if workflow applies
    const applies = workflow.appliesToRequisition(testData);

    // Get approval path
    const approvalPath = [];
    let currentNode = workflow.nodes.find(node => node.type === 'start');
    
    while (currentNode && currentNode.type !== 'end') {
      approvalPath.push({
        nodeId: currentNode.id,
        nodeName: currentNode.name,
        nodeType: currentNode.type,
        approvers: currentNode.approvers || [],
        conditions: currentNode.conditions || []
      });

      // Find next node
      if (currentNode.type === 'condition') {
        const meetsCondition = workflow.evaluateConditions(currentNode.conditions, testData);
        const nextNodeId = meetsCondition ? currentNode.trueBranch : currentNode.falseBranch;
        currentNode = workflow.nodes.find(node => node.id === nextNodeId);
      } else {
        // Find connection from current node
        const connection = workflow.connections.find(conn => conn.from === currentNode.id);
        if (connection) {
          currentNode = workflow.nodes.find(node => node.id === connection.to);
        } else {
          currentNode = null;
        }
      }
    }

    res.status(200).json({
      success: true,
      data: {
        applies,
        approvalPath,
        estimatedSteps: approvalPath.length,
        slaHours: workflow.slaHours,
        autoApprove: workflow.autoApproveBelow && testData.estimatedCost <= workflow.autoApproveBelow
      }
    });
  } catch (error) {
    console.error('Test workflow error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test workflow'
    });
  }
};

// @desc    Get workflow statistics
// @route   GET /api/approval-workflows/:id/statistics
// @access  Private
export const getWorkflowStatistics = async (req, res) => {
  try {
    const workflow = await ApprovalWorkflow.findOne({
      _id: req.params.id,
      company: req.user.company
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }

    // Get requisition statistics for this workflow
    const requisitionStats = await Requisition.aggregate([
      {
        $match: {
          workflow: workflow._id,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgAmount: { $avg: '$estimatedCost' },
          totalAmount: { $sum: '$estimatedCost' }
        }
      }
    ]);

    // Get approval time statistics
    const approvalTimeStats = await Requisition.aggregate([
      {
        $match: {
          workflow: workflow._id,
          status: 'approved',
          approvedAt: { $exists: true },
          createdAt: { $exists: true }
        }
      },
      {
        $project: {
          approvalTimeHours: {
            $divide: [
              { $subtract: ['$approvedAt', '$createdAt'] },
              1000 * 60 * 60
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgApprovalTime: { $avg: '$approvalTimeHours' },
          minApprovalTime: { $min: '$approvalTimeHours' },
          maxApprovalTime: { $max: '$approvalTimeHours' }
        }
      }
    ]);

    // Get department usage
    const departmentStats = await Requisition.aggregate([
      {
        $match: {
          workflow: workflow._id
        }
      },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'departmentInfo'
        }
      },
      {
        $unwind: '$departmentInfo'
      },
      {
        $project: {
          departmentName: '$departmentInfo.name',
          departmentCode: '$departmentInfo.code',
          count: 1
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 5
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        basicStats: {
          totalRequests: workflow.statistics.totalRequests || 0,
          activeRequests: workflow.activeInstances || 0,
          avgApprovalTime: workflow.statistics.avgApprovalTime || null,
          completionRate: workflow.statistics.completionRate || null,
          lastUsed: workflow.statistics.lastUsed || null
        },
        requisitionStats,
        approvalTimeStats: approvalTimeStats[0] || {},
        departmentStats,
        nodeUsage: workflow.nodes.map(node => ({
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          approversCount: node.approvers ? node.approvers.length : 0
        }))
      }
    });
  } catch (error) {
    console.error('Get workflow statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflow statistics'
    });
  }
};

// @desc    Get workflow templates
// @route   GET /api/approval-workflows/templates
// @access  Private
export const getWorkflowTemplates = async (req, res) => {
  try {
    const templates = [
      {
        id: 'template-standard',
        name: 'Standard Procurement Workflow',
        description: 'Basic approval chain for general purchases',
        nodes: [
          {
            id: 'start-1',
            type: 'start',
            name: 'Request Submitted',
            position: { x: 100, y: 100 }
          },
          {
            id: 'approval-1',
            type: 'approval',
            name: 'Department Head Approval',
            approvalType: 'sequential',
            minApprovals: 1,
            timeoutHours: 24,
            position: { x: 300, y: 100 }
          },
          {
            id: 'condition-1',
            type: 'condition',
            name: 'Amount Check',
            conditions: [
              {
                field: 'estimatedCost',
                operator: 'lt',
                value: 50000,
                logicalOperator: 'AND'
              }
            ],
            trueBranch: 'approval-2',
            falseBranch: 'approval-3',
            position: { x: 500, y: 100 }
          },
          {
            id: 'approval-2',
            type: 'approval',
            name: 'Procurement Officer Approval',
            approvalType: 'sequential',
            minApprovals: 1,
            timeoutHours: 24,
            position: { x: 700, y: 50 }
          },
          {
            id: 'approval-3',
            type: 'approval',
            name: 'CFO Final Approval',
            approvalType: 'sequential',
            minApprovals: 1,
            timeoutHours: 48,
            position: { x: 700, y: 150 }
          },
          {
            id: 'end-1',
            type: 'end',
            name: 'Request Approved',
            position: { x: 900, y: 100 }
          }
        ],
        connections: [
          { from: 'start-1', to: 'approval-1' },
          { from: 'approval-1', to: 'condition-1' },
          { from: 'condition-1', to: 'approval-2', condition: 'true' },
          { from: 'condition-1', to: 'approval-3', condition: 'false' },
          { from: 'approval-2', to: 'end-1' },
          { from: 'approval-3', to: 'end-1' }
        ],
        settings: {
          slaHours: 72,
          autoApproveBelow: 10000,
          requireCFOAbove: 50000,
          allowDelegation: true
        }
      },
      {
        id: 'template-fast-track',
        name: 'Fast-Track Low Value',
        description: 'Quick approval for small purchases',
        nodes: [
          {
            id: 'start-2',
            type: 'start',
            name: 'Low Value Request',
            position: { x: 100, y: 100 }
          },
          {
            id: 'notification-1',
            type: 'notification',
            name: 'Auto-Approval Notification',
            position: { x: 300, y: 100 }
          },
          {
            id: 'end-2',
            type: 'end',
            name: 'Auto-Approved',
            position: { x: 500, y: 100 }
          }
        ],
        connections: [
          { from: 'start-2', to: 'notification-1' },
          { from: 'notification-1', to: 'end-2' }
        ],
        settings: {
          slaHours: 24,
          autoApproveBelow: 5000,
          applyToAll: true
        }
      },
      {
        id: 'template-it-hardware',
        name: 'IT Hardware Purchase',
        description: 'Specialized workflow for IT equipment',
        nodes: [
          {
            id: 'start-3',
            type: 'start',
            name: 'IT Request Submitted',
            position: { x: 100, y: 100 }
          },
          {
            id: 'parallel-1',
            type: 'parallel',
            name: 'IT & Security Review',
            approvalType: 'parallel',
            minApprovals: 2,
            timeoutHours: 48,
            position: { x: 300, y: 100 }
          },
          {
            id: 'approval-4',
            type: 'approval',
            name: 'Budget Committee Approval',
            approvalType: 'sequential',
            minApprovals: 1,
            timeoutHours: 72,
            position: { x: 500, y: 100 }
          },
          {
            id: 'end-3',
            type: 'end',
            name: 'IT Purchase Approved',
            position: { x: 700, y: 100 }
          }
        ],
        connections: [
          { from: 'start-3', to: 'parallel-1' },
          { from: 'parallel-1', to: 'approval-4' },
          { from: 'approval-4', to: 'end-3' }
        ],
        settings: {
          slaHours: 120,
          requireITReview: true,
          categories: ['Computing Hardware', 'Networking', 'Software & Licenses']
        }
      }
    ];

    res.status(200).json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Get workflow templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflow templates'
    });
  }
};
