const RFQ = require("../../models/RFQ");
const Vendor = require("../../models/vendor");
const Requisition = require("../../models/requisition");
const User = require("../../models/user");
const { notifyVendorsAboutRFQ, notifySelectedVendor } = require("../services/notificationService");
const {sendNotifications} = require("../services/notificationService");





// Create RFQ (Updated version)
exports.createRFQ = async (req, res) => {

    // Check for user ID in the correct property
    if (!req.user?._id) {
        return res.status(401).json({ message: "Authentication required" });
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

    // Ensure vendors is an array of valid vendor IDs
const validVendors = await User.find({ 
  _id: { $in: vendors },
  role: 'Vendor' 
}).select('firstName email phoneNumber companyName');

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

    // Populate vendor details for notification
    await rfq.populate('vendors', 'firstName email phoneNumber');
    await rfq.populate('procurementOfficer', 'firstName email phoneNumber');

    // Notify vendors about the RFQ (make sure this function exists)
    try {
        const notificationResults = await notifyVendorsAboutRFQ(validVendors, rfq);
  
  rfq.notificationsSent = notificationResults.successful > 0;
  await rfq.save();
  
  console.log(`Notifications sent: ${notificationResults.successful}/${notificationResults.total}`);
    } catch (notificationError) {
      console.error('Error sending notifications:', notificationError);
      // Don't fail the RFQ creation if notifications fail
    }

    // Log the RFQ creation activity
    console.log(`RFQ created: ${rfq._id} by ${req.user.firstName || req.user._id} for ${itemName}`);

    res.status(201).json({ 
      message: "RFQ created successfully and vendors notified", 
      rfq: {
        id: rfq._id,
        itemName: rfq.itemName,
        quantity: rfq.quantity,
        deadline: rfq.deadline,
        priority: rfq.priority,
        vendorCount: rfq.vendors.length,
        status: rfq.status,
        createdAt: rfq.createdAt
      }
    });

  } catch (err) {
    console.error('Error creating RFQ:', err);
    res.status(500).json({ 
      message: "Server error", 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};
// Get all RFQs (Procurement Officers & Admins)
exports.getAllRFQs = async (req, res) => {
    try {
        const rfqs = await RFQ.find().populate("vendors procurementOfficer", "name email");
        res.json(rfqs);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
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

