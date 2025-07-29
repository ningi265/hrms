const mongoose = require('mongoose');
const Requisition = require("../../models/requisition");
//const {sendNotifications} = require("../services/notificationService");
const User = require("../../models/user");
const Department = require("../../models/departments");

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);


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
        if (!requisition) return res.status(404).json({ message: "Requisition not found" });

        // Get approver details
        const approver = await User.findById(req.user._id);
        if (!approver) return res.status(404).json({ message: "Approver not found" });

        // Update requisition status
        requisition.status = "approved";
        requisition.approver = req.user._id;
        await requisition.save();

        // Get employee details
        const employee = await User.findById(requisition.employee);
        if (!employee) return res.status(404).json({ message: "Employee not found" });

        // Prepare email notification
        const msg = {
            to: employee.email,
            from: {
                name: approver.companyName || 'NexusMWI',
                email: process.env.SENDGRID_FROM_EMAIL || 'noreply@nexusmwi.com'
            },
            subject: `Your Requisition Has Been Approved - ${requisition.itemName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
                    <h2 style="color: #333;">Requisition Approved</h2>
                    <p>Dear ${employee.firstName} ${employee.lastName},</p>
                    <p>Your requisition for <strong>${requisition.itemName}</strong> has been approved by ${approver.firstName} ${approver.lastName}.</p>
                    <p>Here are the details of your approved requisition:</p>
                    <ul>
                        <li><strong>Item:</strong> ${requisition.itemName}</li>
                        <li><strong>Quantity:</strong> ${requisition.quantity}</li>
                        <li><strong>Purpose:</strong> ${requisition.purpose}</li>
                        <li><strong>Approval Date:</strong> ${new Date().toLocaleDateString()}</li>
                    </ul>
                    <p>The procurement team will now begin sourcing the product. You can track the status of your requisition through your employee portal.</p>
                    <div style="margin: 20px 0; text-align: center;">
                        <a href="${process.env.FRONTEND_URL}/requisitions/${requisition._id}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">View Requisition</a>
                    </div>
                    <p style="font-size: 12px; color: #777;">Or copy and paste this link into your browser: ${process.env.FRONTEND_URL}/requisitions/${requisition._id}</p>
                    <p>If you have any questions, please contact the procurement team.</p>
                    <p>Best regards,<br/>${approver.companyName} Team</p>
                </div>
            `,
            text: `Requisition Approved\n\nDear ${employee.firstName} ${employee.lastName},\n\nYour requisition for ${requisition.itemName} has been approved by ${approver.firstName} ${approver.lastName}.\n\nDetails:\n- Item: ${requisition.itemName}\n- Quantity: ${requisition.quantity}\n- Purpose: ${requisition.purpose}\n- Approval Date: ${new Date().toLocaleDateString()}\n\nThe procurement team will now begin sourcing the product. You can track the status of your requisition through your employee portal: ${process.env.FRONTEND_URL}/requisitions/${requisition._id}\n\nIf you have any questions, please contact the procurement team.\n\nBest regards,\n${approver.companyName} Team`
        };

        // Send email notification
        await sgMail.send(msg);
        console.log(`Requisition approval email sent to ${employee.email}`);

        res.json({ 
            message: "Requisition approved and notification sent", 
            requisition,
            notification: {
                sent: true,
                recipient: employee.email,
                item: requisition.itemName
            }
        });
    } catch (err) {
        console.error('Error approving requisition:', err);
        res.status(500).json({ 
            message: "Server error", 
            error: err.message,
            code: "SERVER_ERROR"
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
        .populate('employee', 'firstName lastName phoneNumber email');
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
