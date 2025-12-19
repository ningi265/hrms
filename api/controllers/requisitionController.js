const mongoose = require('mongoose');
const Requisition = require("../../models/requisition");
//const {sendNotifications} = require("../services/notificationService");
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
            department, // This can be either ID or name
            departmentId, // Alternative way to specify department
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
        const newRequisition = await Requisition.create({
            employee: req.user._id,
            company: requestingUser.company,
            department: departmentDoc._id, // Use the found department's ID
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
            approvalWorkflow: [], // Will be populated by workflow engine
            history: [{
                action: "created",
                performedBy: req.user._id,
                date: new Date(),
                notes: "Requisition created"
            }]
        });

        // Populate the response with detailed information
        const populatedRequisition = await Requisition.findById(newRequisition._id)
            .populate({
                path: 'employee',
                select: 'firstName lastName email phoneNumber position',
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
                select: 'name industry'
            });

        // Trigger workflow notification
        await sendRequisitionNotification({
            requisitionId: newRequisition._id,
            action: "created",
            actor: req.user._id
        });

        res.status(201).json({ 
            success: true,
            message: "Requisition submitted successfully", 
            data: populatedRequisition,
            meta: {
                company: requestingUser.company,
                createdBy: req.user._id,
                timestamp: new Date()
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

// Helper function to send notifications
async function sendRequisitionNotification({ requisitionId, action, actor }) {
    try {
        // Implementation would depend on your notification system
        console.log(`Notification: Requisition ${requisitionId} ${action} by ${actor}`);
    } catch (error) {
        console.error("Error sending requisition notification:", error);
    }
}
// Get all requisitions (For Procurement Officers & Admins)
exports.getAllRequisitions = async (req, res) => {
    try {
        const requisitions = await Requisition.find().populate("employee", "firstName lastName email");
        res.json(requisitions);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

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

//pending
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



// Approve a requisition
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


// Reject a requisition
exports.rejectRequisition = async (req, res) => {
    try {
        const requisition = await Requisition.findById(req.params.id);
        if (!requisition) return res.status(404).json({ message: "Requisition not found" });

        requisition.status = "rejected";
        requisition.approver = req.user.id;
        await requisition.save();

        // Notify the employee
        const message = `Your requisition for ${requisition.itemName} has been rejected.`;
        await sendNotifications(requisition.employee, "Requisition Rejected", message);

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
// Get all approved requisitions
exports.getApprovedRequisitions = async (req, res) => {
    try {
        const requisitions = await Requisition.find({ status: "approved" }).populate("employee", "name email");
        res.json(requisitions);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get all rejected requisitions
exports.getRejectedRequisitions = async (req, res) => {
    try {
        const requisitions = await Requisition.find({ status: "rejected" }).populate("employee", "name email");
        res.json(requisitions);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get all pending requisitions
exports.getAllPendingRequisitions = async (req, res) => {
    try {
        const requisitions = await Requisition.find({status:"pending"}).populate("employee", "firstName lastName email");
        res.json(requisitions);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get requisition stats (total, pending, approved, rejected)

{/*exports.getRequisitionStats = async (req, res) => {
    try {
        const total = await Requisition.countDocuments();
        const pending = await Requisition.countDocuments({ status: "pending" });
        const approved = await Requisition.countDocuments({ status: "approved" });
        const rejected = await Requisition.countDocuments({ status: "rejected" });
        const requisitions = await Requisition.find({ status: "pending" })
            .populate("employee", "name email");

        const stats = {
            counts: {
                total,
                pending,
                approved,
                rejected
            },
            pendingRequisitions: requisitions // Include the full requisitions data
        };

        res.json(stats); // Send a single response with all data
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
}; */}
exports.getRequisitionStats = async (req, res) => {
    try {
        // Get the requesting user's company
        const user = await User.findById(req.user._id).select('company isEnterpriseAdmin');
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Base query - filter by company unless user is enterprise admin with special privileges
        const baseQuery = user.isEnterpriseAdmin && req.query.allCompanies ? {} : { company: user.company };

        // Get counts by status
        const [total, pending, approved, rejected, processing, completed] = await Promise.all([
            Requisition.countDocuments(baseQuery),
            Requisition.countDocuments({ ...baseQuery, status: "pending" }),
            Requisition.countDocuments({ ...baseQuery, status: "approved" }),
            Requisition.countDocuments({ ...baseQuery, status: "rejected" }),
            Requisition.countDocuments({ ...baseQuery, status: "processing" }),
            Requisition.countDocuments({ ...baseQuery, status: "completed" })
        ]);

        // Get pending requisitions with employee details
        const pendingRequisitions = await Requisition.find({ ...baseQuery, status: "pending" })
            .populate({
                path: "employee",
                select: "firstName lastName email department position",
                populate: {
                    path: "department",
                    select: "name"
                }
            })
            .sort({ createdAt: -1 })
            .limit(10); // Limit to 10 most recent pending requisitions

        // Get recent activity (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentActivity = await Requisition.aggregate([
            { $match: { ...baseQuery, createdAt: { $gte: thirtyDaysAgo } } },
            { $group: { 
                _id: { 
                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } 
                },
                count: { $sum: 1 },
                approved: { 
                    $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } 
                },
                rejected: { 
                    $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } 
                }
            }},
            { $sort: { _id: 1 } },
            { $project: { 
                date: "$_id", 
                count: 1, 
                approved: 1, 
                rejected: 1,
                _id: 0 
            }}
        ]);

        // Get department-wise breakdown
        const departmentStats = await Requisition.aggregate([
            { $match: baseQuery },
            { $lookup: {
                from: "users",
                localField: "employee",
                foreignField: "_id",
                as: "employeeData"
            }},
            { $unwind: "$employeeData" },
            { $group: {
                _id: "$employeeData.department",
                total: { $sum: 1 },
                pending: { 
                    $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } 
                },
                approved: { 
                    $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } 
                },
                rejected: { 
                    $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } 
                }
            }},
            { $lookup: {
                from: "departments",
                localField: "_id",
                foreignField: "_id",
                as: "departmentData"
            }},
            { $unwind: "$departmentData" },
            { $project: {
                department: "$departmentData.name",
                total: 1,
                pending: 1,
                approved: 1,
                rejected: 1,
                approvalRate: {
                    $cond: [
                        { $eq: ["$total", 0] },
                        0,
                        { $divide: ["$approved", "$total"] }
                    ]
                }
            }},
            { $sort: { total: -1 } }
        ]);

        // Calculate approval rate
        const approvalRate = total > 0 ? (approved / total) * 100 : 0;
        const rejectionRate = total > 0 ? (rejected / total) * 100 : 0;

        // Prepare response
        const stats = {
            summary: {
                total,
                pending,
                approved,
                rejected,
                processing,
                completed,
                approvalRate: parseFloat(approvalRate.toFixed(2)),
                rejectionRate: parseFloat(rejectionRate.toFixed(2)),
                avgProcessingTime: "N/A" // Could be implemented with actual data
            },
            recentActivity,
            departmentStats,
            pendingRequisitions,
            context: {
                company: user.company,
                isEnterpriseAdmin: user.isEnterpriseAdmin,
                allCompanies: req.query.allCompanies ? true : false
            }
        };

        res.json(stats);
    } catch (err) {
        console.error("Error in getRequisitionStats:", err);
        res.status(500).json({ 
            message: "Server error", 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};


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

// Get all pending requisitions (For Procurement Officers & Admins)
exports.getPendingRequisitions = async (req, res) => {
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

    // Get pending requisitions with populated data
    const requisitions = await Requisition.find(baseQuery)
      .populate({
        path: 'employee',
        select: 'firstName lastName email position avatar',
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
      .populate({
        path: 'approver',
        select: 'firstName lastName email'
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalCount = await Requisition.countDocuments(baseQuery);

    // Calculate summary statistics
    const stats = await Requisition.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalRequisitions: { $sum: 1 },
          totalEstimatedCost: { $sum: "$estimatedCost" },
          avgEstimatedCost: { $avg: "$estimatedCost" },
          earliestDate: { $min: "$createdAt" },
          latestDate: { $max: "$createdAt" },
          highUrgencyCount: { 
            $sum: { $cond: [{ $eq: ["$urgency", "high"] }, 1, 0] } 
          },
          mediumUrgencyCount: { 
            $sum: { $cond: [{ $eq: ["$urgency", "medium"] }, 1, 0] } 
          },
          lowUrgencyCount: { 
            $sum: { $cond: [{ $eq: ["$urgency", "low"] }, 1, 0] } 
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: requisitions,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        sort: `${sortField}:${sortOrder === 1 ? 'asc' : 'desc'}`,
        stats: stats[0] || {},
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
