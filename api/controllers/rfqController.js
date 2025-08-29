const RFQ = require("../../models/RFQ");
const Vendor = require("../../models/vendor");
const Requisition = require("../../models/requisition");
const User = require("../../models/user");
const { notifyVendorsAboutRFQ, notifySelectedVendor } = require("../services/notificationService");
const {sendNotifications} = require("../services/notificationService");
const Department = require("../../models/departments");
const mongoose = require("mongoose");
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);


// Create RFQ (Updated version)
exports.createRFQ = async (req, res) => {
    // Check for user ID in the correct property
    if (!req.user || !req.user._id) {
        return res.status(401).json({ message: "Authentication required" });
    }

    const requestingUser = await User.findById(req.user._id)
    .select('company isEnterpriseAdmin role department');
    if (!requestingUser) {
        return res.status(404).json({ message: "User not found" });
    }

    const allowedRoles = [
            "employee", "procurement_officer", "IT/Technical",
            "Executive (CEO, CFO, etc.)", "Management", 
            "Sales/Marketing", "Enterprise(CEO, CFO, etc.)",
    "Sales Representative",
    "Sales Manager",
    "Marketing Specialist",
    "Marketing Manager",
    "HR Specialist",
    "HR Manager",
    "Office Manager",
    "Customer Support Representative",
    "Customer Success Manager"
        ];

         if (!requestingUser.isEnterpriseAdmin && 
            !allowedRoles.includes(requestingUser.role)) {
            return res.status(403).json({ 
                success: false,
                message: "Unauthorized to create requisitions",
                requiredRole: "One of: " + allowedRoles.join(", ")
            });
        }
    
    console.log('Received data:', req.body);
    console.log('User from JWT:', req.user);
    
    try {
        const { 
            vendors, 
            itemName, 
            quantity, 
            deadline,
            description,
            estimatedBudget,
            priority,
            deliveryLocation,
            specifications,
            requisitionId 
        } = req.body;

        // Validate required fields
        if (!itemName || !quantity || !vendors || vendors.length === 0) {
            return res.status(400).json({ 
                message: "Item name, quantity, and at least one vendor are required" 
            });
        }

        // Validate deadline is in the future
        if (deadline && new Date(deadline) <= new Date()) {
            return res.status(400).json({ 
                message: "Deadline must be in the future" 
            });
        }

        // Get procurement officer details for email
        const procurementOfficer = await User.findById(req.user._id)
            .select('firstName lastName email companyName');

        // Ensure vendors is an array of valid vendor IDs
        const validVendors = await User.find({ 
            _id: { $in: vendors },
            role: 'Vendor' 
        }).select('firstName lastName email phoneNumber companyName');

        if (validVendors.length !== vendors.length) {
            return res.status(400).json({ 
                message: "One or more vendor IDs are invalid" 
            });
        }

        // Validate requisition if provided
        let requisition = null;
        if (requisitionId) {
            requisition = await Requisition.findById(requisitionId);
            if (!requisition) {
                return res.status(400).json({ message: "Invalid requisition ID provided" });
            }
            
            // Check if requisition is approved
            if (requisition.status !== 'approved') {
                return res.status(400).json({ 
                    message: "Only approved requisitions can be used to create RFQs" 
                });
            }
        }

        // Create the RFQ with all the enhanced fields
        const rfq = await RFQ.create({
            procurementOfficer: req.user._id,
            company: requestingUser.company,
            department: requestingUser.department,
            vendors,
            itemName,
            quantity: parseInt(quantity),
            deadline: deadline ? new Date(deadline) : null,
            description: description || '',
            estimatedBudget: estimatedBudget ? parseFloat(estimatedBudget) : null,
            priority: priority || 'medium',
            deliveryLocation: deliveryLocation || '',
            specifications: specifications || '',
            requisitionId: requisitionId || null,
            status: 'open',
            notificationsSent: false
        });

        // Update requisition status if linked
        if (requisition) {
            requisition.rfqCreated = true;
            requisition.rfqId = rfq._id;
            requisition.updatedAt = new Date();
            await requisition.save();
        }

        // Prepare email notification details
        const formattedDeadline = deadline 
            ? new Date(deadline).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
            : 'Not specified';

        // Send notifications to each vendor using SendGrid
        const notificationResults = {
            successful: 0,
            failed: 0,
            total: validVendors.length
        };

        for (const vendor of validVendors) {
            try {
                const vendorName = `${vendor.firstName} ${vendor.lastName}`.trim() || vendor.email;
                const rfqLink = `${process.env.FRONTEND_URL}/rfqs/${rfq._id}`;

                // Prepare SendGrid email
                const msg = {
                    to: vendor.email,
                    from: {
                        name: procurementOfficer.companyName || 'NexusMWI Procurement',
                        email: process.env.SENDGRID_FROM_EMAIL || 'procurement@nexusmwi.com'
                    },
                    subject: `New RFQ Opportunity: ${itemName}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
                            <h2 style="color: #333;">New Request for Quotation</h2>
                            <p>Dear ${vendorName},</p>
                            <p>You have been invited to submit a quote for the following item:</p>
                            
                            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0;">
                                <h3 style="margin-top: 0; color: #2c3e50;">${itemName}</h3>
                                <ul style="padding-left: 20px;">
                                    <li><strong>Quantity:</strong> ${quantity}</li>
                                    <li><strong>Deadline:</strong> ${formattedDeadline}</li>
                                    ${description ? `<li><strong>Description:</strong> ${description}</li>` : ''}
                                    ${specifications ? `<li><strong>Specifications:</strong> ${specifications}</li>` : ''}
                                    ${deliveryLocation ? `<li><strong>Delivery Location:</strong> ${deliveryLocation}</li>` : ''}
                                </ul>
                            </div>

                            <p>This RFQ was created by ${procurementOfficer.firstName} ${procurementOfficer.lastName} from ${procurementOfficer.companyName}.</p>
                            
                            <div style="margin: 20px 0; text-align: center;">
                                <a href="${rfqLink}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                    View RFQ Details
                                </a>
                            </div>
                            
                            <p style="font-size: 12px; color: #777;">Or copy and paste this link into your browser: ${rfqLink}</p>
                            
                            <p>Please submit your quote before the deadline to be considered for this opportunity.</p>
                            
                            <p>Best regards,<br/>
                            ${procurementOfficer.companyName || 'NexusMWI'} Procurement Team</p>
                        </div>
                    `,
                    text: `New Request for Quotation\n\nDear ${vendorName},\n\nYou have been invited to submit a quote for:\n\nItem: ${itemName}\nQuantity: ${quantity}\nDeadline: ${formattedDeadline}\n\nThis RFQ was created by ${procurementOfficer.firstName} ${procurementOfficer.lastName} from ${procurementOfficer.companyName}.\n\nView RFQ details: ${rfqLink}\n\nPlease submit your quote before the deadline.\n\nBest regards,\n${procurementOfficer.companyName || 'NexusMWI'} Procurement Team`
                };

                // Send email via SendGrid API
                await sgMail.send(msg);
                notificationResults.successful++;
                console.log(`RFQ notification sent to ${vendor.email}`);
                
            } catch (emailError) {
                notificationResults.failed++;
                console.error(`Failed to send RFQ notification to ${vendor.email}:`, emailError);
                // Continue with next vendor even if one fails
            }
        }

        // Update RFQ with notification status
        rfq.notificationsSent = notificationResults.successful > 0;
        await rfq.save();

        // Log the RFQ creation activity
        console.log(`RFQ created: ${rfq._id} by ${req.user.firstName || req.user._id} for ${itemName}`);
        console.log(`Notifications: ${notificationResults.successful} sent, ${notificationResults.failed} failed`);

        res.status(201).json({ 
            success: true,
            message: "RFQ created successfully", 
            rfq: {
                id: rfq._id,
                itemName: rfq.itemName,
                quantity: rfq.quantity,
                deadline: rfq.deadline,
                priority: rfq.priority,
                vendorCount: rfq.vendors.length,
                status: rfq.status,
                createdAt: rfq.createdAt
            },
            notifications: {
                sent: notificationResults.successful,
                failed: notificationResults.failed,
                total: notificationResults.total
            }
        });

    } catch (err) {
        console.error('Error creating RFQ:', err);
        res.status(500).json({ 
            success: false,
            message: "Server error while creating RFQ", 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
            code: "RFQ_CREATION_FAILED"
        });
    }
};
// Get all RFQs (Procurement Officers & Admins)

{/*exports.getAllRFQs = async (req, res) => {
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
    const baseQuery = requestingUser.isEnterpriseAdmin && req.query.allCompanies ? {} : { company: requestingUser.company };

    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get sorting parameters
    const sortField = req.query.sortBy || 'deadline';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
    const sort = { [sortField]: sortOrder };

    // Get RFQs with populated data
    const rfqs = await RFQ.find(baseQuery)
      .populate({
        path: 'vendors',
        select: 'name email contactPerson rating',
        populate: {
          path: 'company',
          select: 'name industry'
        }
      })
      .populate({
        path: 'procurementOfficer',
        select: 'firstName lastName email avatar',
        populate: {
          path: 'department',
          select: 'name departmentCode'
        }
      })
      .populate({
        path: 'company',
        select: 'name logo'
      })
      .populate({
        path: 'items.product',
        select: 'name description category'
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalCount = await RFQ.countDocuments(baseQuery);

    // Calculate RFQ statistics
    const stats = await RFQ.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalRFQs: { $sum: 1 },
          openRFQs: { 
            $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] } 
          },
          closedRFQs: { 
            $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] } 
          },
          avgVendorCount: { $avg: { $size: "$vendors" } },
          avgItemCount: { $avg: { $size: "$items" } }
        }
      }
    ]);

    // Get RFQ distribution by category
    const categoryDistribution = await RFQ.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log(`Fetched ${rfqs.length} RFQs for company ${requestingUser.company}`);

    res.status(200).json({
      success: true,
      data: rfqs,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        sort: `${sortField}:${sortOrder === 1 ? 'asc' : 'desc'}`,
        stats: stats[0] || {},
        categoryDistribution,
        context: {
          company: requestingUser.company,
          isEnterpriseAdmin: requestingUser.isEnterpriseAdmin,
          allCompanies: req.query.allCompanies ? true : false
        }
      }
    });

  } catch (error) {
    console.error('Error fetching RFQs:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching RFQs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};*/}





exports.getAllRFQs = async (req, res) => {
  try {
    // Get the requesting user's company and permissions
    console.log("Requesting user ID:", req.user._id);
    const requestingUser = await User.findById(req.user._id).select('company isEnterpriseAdmin');
    if (!requestingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Base query - filter by company unless user is enterprise admin with special privileges
    const companyQuery = requestingUser.isEnterpriseAdmin && req.query.allCompanies ? {} : { company: requestingUser.company };
    const baseQuery = { ...companyQuery };

    // Optional status filter
    if (req.query.status) {
      baseQuery.status = req.query.status;
    }

    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get sorting parameters
    const sortField = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
    const sort = { [sortField]: sortOrder };

    // Get RFQs with populated vendor and procurement officer info
    const rfqs = await RFQ.find(baseQuery)
      .populate({
        path: 'vendors',
        select: 'fistName email company'
      })
      .populate({
        path: 'procurementOfficer',
        select: 'firstName lastName email company'
      })
      .populate({
        path: 'company',
        select: 'name'
      })
      .populate({
        path: 'department',
        select: 'name departmentCode'
      })
      .populate({
        path: 'requisitionId',
        select: 'itemName quantity status'
      })
      .populate({
        path: 'selectedVendor',
        select: 'firstName, lastName email company'
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalCount = await RFQ.countDocuments(baseQuery);

    console.log(`Fetched ${rfqs.length} RFQs for company ${requestingUser.company}`);

    // Add virtuals to the response since lean() doesn't include them
    const enhancedRfqs = rfqs.map(rfq => ({
  ...rfq,
  quoteCount: rfq.quotes?.length || 0,
  vendorCount: rfq.vendors?.length || 0,
  daysUntilDeadline: rfq.deadline 
    ? Math.ceil((new Date(rfq.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null,
  completionPercentage: rfq.vendors?.length 
    ? Math.round(((rfq.quotes?.length || 0) / rfq.vendors.length) * 100)
    : 0,
  statusColor: getStatusColor(rfq.status),
  priorityColor: getPriorityColor(rfq.priority)
}));

    res.status(200).json({
      success: true,
      data: enhancedRfqs,
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
    console.error('Error fetching RFQs:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching RFQs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper functions for virtuals
function getStatusColor(status) {
  switch (status) {
    case 'open': return 'green';
    case 'closed': return 'blue';
    case 'pending': return 'yellow';
    case 'cancelled': return 'red';
    default: return 'gray';
  }
}

function getPriorityColor(priority) {
  switch (priority) {
    case 'high': return 'red';
    case 'medium': return 'yellow';
    case 'low': return 'green';
    default: return 'gray';
  }
}


exports.getAllRFQsAdmin = async (req, res) => {
    try {
        console.log("Fetching all RFQs for user:", req.user._id);
        
        // Check authentication and get requesting user
        if (!req.user || !req.user._id) {
            return res.status(401).json({ 
                success: false,
                message: "Unauthorized: User not authenticated" 
            });
        }

        const requestingUser = await User.findById(req.user._id)
            .select('company isEnterpriseAdmin');
        
        if (!requestingUser) {
            return res.status(404).json({ 
                success: false,
                message: "User not found" 
            });
        }

        // Base query - filter by company unless user is enterprise admin with allCompanies flag
        const baseQuery = requestingUser.isEnterpriseAdmin && req.query.allCompanies === 'true' 
            ? {} 
            : { company: requestingUser.company };

        // Get pagination parameters with defaults
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Get sorting parameters
        const sortField = req.query.sortBy || 'deadline';
        const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
        const sort = { [sortField]: sortOrder };

        // Additional filters from query params
        const statusFilter = req.query.status ? { status: req.query.status } : {};
        const deadlineFilter = req.query.deadline ? { 
            deadline: { 
                [req.query.deadlineOp || '$gte']: new Date(req.query.deadline) 
            } 
        } : {};

        // Get RFQs with populated data
        const rfqs = await RFQ.find({
            ...baseQuery,
            ...statusFilter,
            ...deadlineFilter
        })
        .populate({
            path: 'company',
            select: 'name industry'
        })
        .populate({
            path: 'department',
            select: 'name departmentCode'
        })
        .populate({ 
            path: 'createdBy',
            select: 'firstName lastName email'
        })
        .populate({ 
            path: 'vendors',
            select: 'name email businessName',
            match: { status: 'active' } // Only include active vendors
        })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

        // Get total count for pagination
        const totalCount = await RFQ.countDocuments({
            ...baseQuery,
            ...statusFilter,
            ...deadlineFilter
        });

        // Get statistics
        const stats = await RFQ.aggregate([
            { $match: baseQuery },
            { 
                $group: {
                    _id: null,
                    totalRFQs: { $sum: 1 },
                    draftRFQs: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
                    publishedRFQs: { $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } },
                    closedRFQs: { $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] } },
                    avgVendorsPerRFQ: { $avg: { $size: "$vendors" } }
                }
            }
        ]);

        console.log(`Fetched ${rfqs.length} RFQs for company ${requestingUser.company}`);

        res.status(200).json({
            success: true,
            data: rfqs,
            meta: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
                stats: stats[0] || {},
                context: {
                    company: requestingUser.company,
                    isEnterpriseAdmin: requestingUser.isEnterpriseAdmin,
                    allCompanies: req.query.allCompanies === 'true'
                }
            }
        });

    } catch (error) {
        console.error('Error fetching RFQs:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error while fetching RFQs',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
    

exports.submitQuote = async (req, res) => {
    try {
        const { price, deliveryTime, notes } = req.body;
        console.log(req.body);

        // Find the RFQ by ID (no need to populate vendors since they're embedded)
        const rfq = await RFQ.findById(req.params.id);
        console.log("RFQ Found:", rfq);

        if (!rfq || rfq.status === "closed") {
            return res.status(400).json({ message: "RFQ not found or closed" });
        }

        // Find the vendor based on req.user._id
        const vendorEntry = rfq.vendors.find(vendor => vendor._id.toString() === req.user._id.toString());
        
        if (!vendorEntry) {
            console.log("Vendor ID mismatch:", req.user._id, "not in", rfq.vendors.map(v => v._id.toString()));
            return res.status(403).json({ message: "You are not invited to submit a quote for this RFQ." });
        }

        console.log("Vendor Found:", vendorEntry);

        // Create new quote using vendor's _id from the vendors array
        const newQuote = { 
            vendor: vendorEntry._id, 
            price, 
            deliveryTime, 
            notes 
        };
        
        rfq.quotes.push(newQuote);
        await rfq.save();

        res.json({ message: "Quote submitted successfully", newQuote });
    } catch (err) {
        console.error("Error submitting quote:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};



exports.selectVendor = async (req, res) => {
    try {
        const { vendorId } = req.body;
        const rfqId = req.params.id;

        // 1. Find the RFQ (no need for population)
        const rfq = await RFQ.findById(rfqId);
        
        if (!rfq) return res.status(404).json({ message: "RFQ not found" });
        if (rfq.status === "closed") return res.status(400).json({ message: "RFQ is already closed" });
        if (rfq.quotes.length === 0) return res.status(400).json({ message: "No quotes available" });

        // 2. Convert string vendor IDs to comparable format
        const selectedQuote = rfq.quotes.find(quote => 
            quote.vendor.toString() === vendorId.toString()
        );

        if (!selectedQuote) {
            return res.status(400).json({ 
                message: "Invalid vendor selection",
                debug: {
                    providedVendorId: vendorId,
                    availableQuoteVendors: rfq.quotes.map(q => q.vendor.toString()),
                    allVendors: rfq.vendors.map(v => v._id.toString())
                }
            });
        }

        // 3. Update RFQ
        rfq.status = "closed";
        rfq.selectedVendor = selectedQuote.vendor; // This is already the string ID
        await rfq.save();

        res.json({ 
            message: "Vendor selected successfully",
            selectedVendorId: selectedQuote.vendor
        });

    } catch (err) {
        console.error("Error selecting vendor:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get RFQ stats (total, open, closed)
exports.getRFQStats = async (req, res) => {
    try {
        const total = await RFQ.countDocuments();
        const open = await RFQ.countDocuments({ status: "open" });
        const closed = await RFQ.countDocuments({ status: "closed" });
        const openRFQs = await RFQ.find({ status: "open" })
        .populate("procurementOfficer", "name email")
        .sort({ deadline: 1 }); // Sort by deadline ascending

        const stats = {
            counts: {
                total,
                open,
                closed
            },
            openRFQs: openRFQs // Include the full open RFQs data
        };

        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
// Get a single RFQ by ID
exports.getRFQById = async (req, res) => {
    try {
        const rfq = await RFQ.findById(req.params.id)
            .populate("vendor", "name email")
            .populate("requisition", "itemName quantity budgetCode urgency reason");
        if (!rfq) return res.status(404).json({ message: "RFQ not found" });
        res.json(rfq);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

