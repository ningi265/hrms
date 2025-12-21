const Tenders = require("../../models/tenders");
const Requisition = require("../../models/requisition");
const User = require("../../models/user");
const { notifyVendorsAboutRFQ, notifySelectedVendor } = require("../services/notificationService");
const {sendNotifications} = require("../services/notificationService");
const Department = require("../../models/departments");
const mongoose = require("mongoose");
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.createTender = async (req, res) => {
    if (!req.user || !req.user._id) {
        return res.status(401).json({ message: "Authentication required" });
    }

    const requestingUser = await User.findById(req.user._id)
        .select("company isEnterpriseAdmin role department");
    if (!requestingUser) {
        return res.status(404).json({ message: "User not found" });
    }

    const allowedRoles = [
        "employee", "procurement_officer", "IT/Technical",
        "Executive (CEO, CFO, etc.)", "Management", 
        "Sales/Marketing", "Enterprise(CEO, CFO, etc.)",
        "Sales Representative", "Sales Manager",
        "Marketing Specialist", "Marketing Manager",
        "HR Specialist", "HR Manager", "Office Manager",
        "Customer Support Representative", "Customer Success Manager"
    ];

    if (!requestingUser.isEnterpriseAdmin && !allowedRoles.includes(requestingUser.role)) {
        return res.status(403).json({ 
            success: false,
            message: "Unauthorized to create tenders",
            requiredRole: "One of: " + allowedRoles.join(", ")
        });
    }

    try {
        const { 
            title, 
            category, 
            deadline,
            description,
            budget,
            urgency,
            location,
            requisitionId,
            requirements,
            technicalSpecs,
            paymentTerms,
            evaluationCriteria
        } = req.body;

        // Validate required fields
        if (!title || !budget || !category || !location) {
            return res.status(400).json({ 
                message: "title, budget, category, and location are required" 
            });
        }

        // Validate deadline
        if (deadline && new Date(deadline) <= new Date()) {
            return res.status(400).json({ message: "Deadline must be in the future" });
        }

        // Validate requisition if provided
        let requisition = null;
        if (requisitionId) {
            requisition = await Requisition.findById(requisitionId);
            if (!requisition) {
                return res.status(400).json({ message: "Invalid requisition ID provided" });
            }
            if (requisition.status !== "approved") {
                return res.status(400).json({ message: "Only approved requisitions can be linked to a tender" });
            }
        }

        const parsedRequirements = Array.isArray(requirements) 
            ? requirements 
            : requirements?.split(",").map(r => r.trim()) || [];

        // Create tender
        let tender = await Tenders.create({
            procurementOfficer: req.user._id,
            company: requestingUser.company,
            department: requestingUser.department,
            title,
            status: "open",
            deadline: deadline ? new Date(deadline) : null,
            description: description || "",
            budget: budget ? parseFloat(budget) : null,
            urgency: urgency || "medium",
            location: location || "",
            requisitionId: requisitionId || null,
            requirements: parsedRequirements,
            technicalSpecs: technicalSpecs || "",
            paymentTerms: paymentTerms || "",
            evaluationCriteria: evaluationCriteria || ""
        });

        // 🔥 Populate the company so we can return its name
        tender = await tender.populate("company", "name");

        res.status(201).json({ 
            success: true,
            message: "Tender created successfully", 
            tender: {
                id: tender._id,
                title: tender.title,
                deadline: tender.deadline,
                urgency: tender.urgency,
                requirements: tender.requirements,
                description: tender.description,
                status: tender.status,
                createdAt: tender.createdAt,
                company: { 
                    _id: tender.company._id, 
                    name: tender.company.name 
                },
                procurementOfficer: tender.procurementOfficer,
                requisitionId: tender.requisitionId || null,
                budget: tender.budget,
                location: tender.location,
                bidCount: 0,
                vendorCount: 0,
                daysUntilDeadline: tender.deadline
                    ? Math.ceil((new Date(tender.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                    : null,
                completionPercentage: 0,
                statusColor: "green",
                priorityColor: tender.urgency === "high" ? "red" : (tender.urgency === "medium" ? "yellow" : "green")
            }
        });

    } catch (err) {
        console.error("Error creating tender:", err);
        res.status(500).json({ 
            success: false,
            message: "Server error while creating tender", 
            error: process.env.NODE_ENV === "development" ? err.message : undefined,
            code: "TENDER_CREATION_FAILED"
        });
    }
};



// Get all Tenders (Procurement Officers & Admins)
exports.getAllTenders = async (req, res) => {
    try {
        const tenders = await Tenders.find()
        .populate("procurementOfficer", "firstName lastName email")
        .populate("company", "name")
        .populate("requisitionId", "itemName status")
        .populate("bids.vendor", "name contactEmail")
        .sort({ createdAt: -1 });
        res.json(tenders);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.getCompanyTenders = async (req, res) => {
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
    const tenders = await Tenders.find(baseQuery)
      .populate("procurementOfficer", "firstName lastName email")
        .populate("company", "name")
        .populate("requisitionId", "itemName status")
        .populate("bids.vendor", "name contactEmail")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalCount = await Tenders.countDocuments(baseQuery);

    console.log(`Fetched ${tenders.length} Tenders for company ${requestingUser.company}`);

    // Add virtuals to the response since lean() doesn't include them
    const enhancedTenders = tenders.map(tender => ({
  ...tender,
  bidCount: tender.bids?.length || 0,
  vendorCount: tender.vendors?.length || 0,
  daysUntilDeadline: tender.deadline 
    ? Math.ceil((new Date(tender.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null,
  completionPercentage: tender.vendors?.length 
    ? Math.round(((tender.bids?.length || 0) / tender.vendors.length) * 100)
    : 0,
  statusColor: getStatusColor(tender.status),
  priorityColor: getPriorityColor(tender.priority)
}));

    res.status(200).json({
      success: true,
      data: enhancedTenders,
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
    console.error('Error fetching Tenders:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching Tenders',
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



exports.getTenderById = async (req, res) => {
    try {
        const tender = await Tenders.findById(req.params.id)
            .populate("procurementOfficer", "firstName lastName email")
            .populate("company", "name")
            .populate("requisitionId", "itemName status")
            .populate("bids.vendor", "name contactEmail");
        if (!tender) {
            return res.status(404).json({ message: "Tender not found" });
        }
        res.json(tender);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};




exports.selectBid = async (req, res) => {
  try{
    const {vendorId} = reqbody;
    const tenderId = req.params.id;

    const tender = await Tenders.findById(tenderId);

    if(!tender) return res.status(404).json({message:"Tender not found"});
    if(tender.status === "closed") return res.status(400).json({message:"Tender is already closed"});
    if(tender.bids.length === 0) return res.status(400).json({message:"No bids available"});

    const selectedBid = tender.bids.find(bid =>
        bid.vendor.toString() === vendorId.toString()
    );

    if(!selectedBid){
      return res.status(400).json({
        message:"Invalid vendor selection",
        debig:{
          providedVendorId: vendorId,
          availableBidsBendors: tender.bids.map(b => b.vendor.toString()),
          allVendors: tender.vendors.map(v => v._id.toString())
        }
      });
    }
    tender.status = "closed";
    tender.selectedVendor = selectedBid.vendor;
    await tender.save();

    res.json({
      message:"Vendor selected successfully",
      selectedVendorId: selectedBid.vendor
    });
  }
  catch (err) {
       console.error("Error selecting vendor:", err);
       res.status(500).json({message:"Server error", error: err.message});
  }
};


exports.createBid = async (req, res) => {
  try {
    const { tenderId, vendorId, bidAmount, proposal, documents } = req.body;

    // Validate required fields
    if (!tenderId || !vendorId || !proposal) {
      return res.status(400).json({
        success: false,
        message: "Tender ID, Vendor ID, and bid amount are required"
      });
    }

    // Check if vendor exists and is pre-qualified
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found"
      });
    }

    // Check if tender exists and is open
    const tender = await Tender.findById(tenderId);
    if (!tender) {
      return res.status(404).json({
        success: false,
        message: "Tender not found"
      });
    }

    if (tender.status !== "open") {
      return res.status(400).json({
        success: false,
        message: "Tender is no longer accepting bids"
      });
    }

    // Check if vendor has already submitted a bid for this tender
    const existingBid = await Bid.findOne({ tenderId, vendorId });
    if (existingBid) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted a bid for this tender"
      });
    }

    // Create new bid
    const bid = new Bid({
      tenderId,
      vendorId,
      bidAmount,
      proposal: proposal || "",
      documents: documents || [],
      status: "submitted",
      submittedAt: new Date()
    });

    await bid.save();

    // Send bid confirmation email
    await sendBidConfirmationEmail(vendor, tender, bid);

    res.status(201).json({
      success: true,
      message: "Bid submitted successfully",
      data: bid
    });

  } catch (err) {
    console.error("Error creating bid:", err);
    res.status(500).json({
      success: false,
      message: "Failed to submit bid",
      error: err.message
    });
  }
};

// Email function for bid confirmation
const sendBidConfirmationEmail = async (vendor, tender, bid) => {
  try {
    const vendorEmail = vendor.vendor?.email || vendor.email;

    const subject = `Bid Submitted Successfully - ${tender.title}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">Bid Submission Confirmed</h2>
        <p>Dear ${vendor.vendor?.firstName || "Vendor"},</p>
        
        <p>Your bid has been successfully submitted for the tender: <strong>${tender.title}</strong></p>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Bid Details:</h3>
          <p><strong>Bid Amount:</strong> $${bid.bidAmount.toLocaleString()}</p>
          <p><strong>Tender Reference:</strong> ${tender._id}</p>
          <p><strong>Submission Date:</strong> ${new Date(bid.submittedAt).toLocaleDateString()}</p>
          <p><strong>Bid Status:</strong> Submitted for review</p>
        </div>

        <h3>Next Steps:</h3>
        <ol>
          <li><strong>Technical Evaluation:</strong> Your bid will undergo technical evaluation (3-5 business days)</li>
          <li><strong>Financial Evaluation:</strong> Qualified bids will proceed to financial evaluation</li>
          <li><strong>Award Notification:</strong> Successful bidders will be notified via email</li>
          <li><strong>Contract Signing:</strong> Final contract negotiation and signing</li>
        </ol>

        <p><strong>Important Notes:</strong></p>
        <ul>
          <li>Keep all supporting documents ready for verification</li>
          <li>Ensure your contact information is up to date</li>
          <li>Monitor your email for any clarification requests</li>
          <li>The evaluation process typically takes 2-3 weeks</li>
        </ul>

        <p>You can check your bid status anytime in your vendor portal.</p>

        <p>Best regards,<br/>
        <strong>Procurement Team</strong><br/>
        Nexus Procurement System</p>
      </div>
    `;

    const msg = {
      to: vendorEmail,
      from: {
        name: 'Nexus Procurement',
        email: process.env.SENDGRID_FROM_EMAIL || 'noreply@nexusmwi.com'
      },
      subject: subject,
      html: html
    };

    await sgMail.send(msg);

  } catch (err) {
    console.error("Error sending bid confirmation email:", err);
    // Don't throw error - email failure shouldn't prevent bid submission
  }
};


  



