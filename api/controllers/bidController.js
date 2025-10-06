// controllers/bidController.js
const Bid = require('../../models/bid');
const Tenders = require('../../models/tenders');
const Vendor = require('../../models/vendor');

// Get bid for specific vendor and tender
exports.getVendorBid = async (req, res) => {
  try {
    const { vendorId, tenderId } = req.params;

    console.log("🔍 Looking for bid:", { vendorId, tenderId });

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found"
      });
    }

    const tender = await Tenders.findById(tenderId);
    if (!tender) {
      return res.status(404).json({
        success: false,
        message: "Tender not found"
      });
    }

    const bid = await Bid.findOne({ 
      vendor: vendorId, 
      tender: tenderId 
    })
    .populate('vendor', 'businessName vendor')
    .populate('tender', 'title budget deadline');

    console.log("📋 Bid search result:", bid);

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "No bid found for this tender",
        data: null
      });
    }

    res.json({
      success: true,
      data: bid
    });

  } catch (err) {
    console.error("Error fetching vendor bid:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching bid",
      error: err.message
    });
  }
};

// Create or update bid
exports.createOrUpdateBid = async (req, res) => {
  try {
    const { tenderId, vendorId, bidAmount, proposal, documents } = req.body;

    if (!tenderId || !vendorId) {
      return res.status(400).json({
        success: false,
        message: "Tender ID and Vendor ID are required"
      });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found"
      });
    }

    const tender = await Tenders.findById(tenderId);
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

    let bid = await Bid.findOne({ 
      vendor: vendorId, 
      tender: tenderId 
    });

    if (bid) {
      if (bidAmount !== undefined) bid.bidAmount = bidAmount;
      if (proposal !== undefined) bid.proposal = proposal;
      if (documents !== undefined) bid.documents = documents;
      bid.updatedAt = new Date();
    } else {
      bid = new Bid({
        tender: tenderId,
        vendor: vendorId,
        bidAmount: bidAmount || 0,
        proposal: proposal || "",
        documents: documents || [],
        status: "draft"
      });
    }

    await bid.save();

    await bid.populate('vendor', 'businessName vendor');
    await bid.populate('tender', 'title budget deadline');

    res.status(200).json({
      success: true,
      message: bid.isNew ? "Bid created successfully" : "Bid updated successfully",
      data: bid
    });

  } catch (err) {
    console.error("Error creating/updating bid:", err);
    res.status(500).json({
      success: false,
      message: "Failed to save bid",
      error: err.message
    });
  }
};

// Upload bid documents
exports.uploadBidDocuments = async (req, res) => {
  try {
    console.log("📨 Incoming upload request:");
    console.log("  Body:", req.body);
    console.log("  Files:", req.files ? req.files.map(f => f.originalname) : 'No files');

    const { bidId, tenderId, vendorId, documentType } = req.body;
    
    // Validate required fields
    if (!tenderId || !vendorId || !documentType) {
      return res.status(400).json({
        success: false,
        message: "Tender ID, Vendor ID, and Document Type are required"
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files were uploaded"
      });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found"
      });
    }

    const tender = await Tenders.findById(tenderId);
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

    let bid;
    
    if (bidId && bidId !== 'new') {
      bid = await Bid.findById(bidId);
      if (!bid) {
        return res.status(404).json({
          success: false,
          message: "Bid not found"
        });
      }
    } else {
      bid = await Bid.findOne({ vendor: vendorId, tender: tenderId });
      if (!bid) {
        bid = new Bid({
          tender: tenderId,
          vendor: vendorId,
          status: 'draft',
          documents: []
        });
      }
    }

    // Ensure documents is initialized as an array
    if (!bid.documents) {
      bid.documents = [];
    }

    // Debug: Check the current documents array
    console.log("📋 Current documents:", bid.documents);
    console.log("📋 First document type:", typeof bid.documents[0]);

    // Remove existing documents of the same type
    bid.documents = bid.documents.filter(doc => {
      // Handle both object and potential string formats
      if (typeof doc === 'object' && doc !== null) {
        return doc.type !== documentType;
      }
      return true; // Keep if we can't determine type
    });

    // Add new documents as proper objects
    req.files.forEach(file => {
      const document = {
        name: file.originalname,
        type: documentType,
        filePath: file.path,
        uploadedAt: new Date(),
        size: file.size
      };
      
      console.log("📄 Adding document as object:", document);
      bid.documents.push(document);
    });

    // Mark the documents array as modified to ensure Mongoose saves it
    bid.markModified('documents');

    console.log("💾 Saving bid with documents:", bid.documents);

    try {
      await bid.save();
      console.log("✅ Bid saved successfully");
    } catch (saveError) {
      console.error("❌ Save error:", saveError);
      throw saveError;
    }

    // Repopulate the bid to get fresh data
    const populatedBid = await Bid.findById(bid._id)
      .populate('vendor', 'businessName vendor')
      .populate('tender', 'title budget deadline');

    console.log("✅ Documents uploaded successfully for bid:", bid._id);

    res.json({
      success: true,
      message: "Documents uploaded successfully",
      data: populatedBid
    });

  } catch (err) {
    console.error("❌ Error uploading bid documents:", err);
    
    // More detailed error logging
    if (err.name === 'ValidationError') {
      console.error("Validation errors:", err.errors);
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to upload documents",
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

exports.submitBid = async (req, res) => {
  try {
    const { bidId, tenderId, vendorId, bidAmount, proposal } = req.body;

    if (!bidId || !tenderId || !vendorId) {
      return res.status(400).json({
        success: false,
        message: "Bid ID, Tender ID, and Vendor ID are required"
      });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found"
      });
    }

    const tender = await Tenders.findById(tenderId);
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

    const bid = await Bid.findById(bidId);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found"
      });
    }

    if (bid.status === "submitted") {
      return res.status(400).json({
        success: false,
        message: "Bid has already been submitted"
      });
    }

    // Validate all required documents are uploaded
    const requiredDocuments = ["technical_proposal", "financial_proposal", "company_profile"];
    const uploadedDocTypes = bid.documents.map(doc => doc.type);
    const hasAllDocuments = requiredDocuments.every(doc => uploadedDocTypes.includes(doc));

    if (!hasAllDocuments) {
      const missingDocs = requiredDocuments.filter(doc => !uploadedDocTypes.includes(doc));
      return res.status(400).json({
        success: false,
        message: "All required documents must be uploaded before submission",
        missingDocuments: missingDocs
      });
    }

    if (!bidAmount || bidAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid bid amount is required"
      });
    }

    // Update bid for final submission
    bid.bidAmount = parseFloat(bidAmount);
    bid.proposal = proposal || "";
    bid.status = "submitted";
    bid.submittedAt = new Date();

    await bid.save();

    const populatedBid = await Bid.findById(bid._id)
      .populate('vendor', 'businessName vendor')
      .populate('tender', 'title budget deadline');

    res.status(200).json({
      success: true,
      message: "Bid submitted successfully",
      data: populatedBid
    });

  } catch (err) {
    console.error("Error submitting bid:", err);
    res.status(500).json({
      success: false,
      message: "Failed to submit bid",
      error: err.message
    });
  }
};


exports.checkVendorApplication = async (req, res) => {
  try {
    const { vendorId, tenderId } = req.params;

    const existingBid = await Bid.findOne({ 
      vendor: vendorId, 
      tender: tenderId,
      status: { $in: ["submitted", "under_review", "technical_evaluation", "financial_evaluation", "awarded"] }
    });

    res.json({
      success: true,
      data: {
        hasApplied: !!existingBid,
        bid: existingBid
      }
    });

  } catch (err) {
    console.error("Error checking vendor application:", err);
    res.status(500).json({
      success: false,
      message: "Server error while checking application",
      error: err.message
    });
  }
};