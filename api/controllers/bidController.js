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
    console.log("  Files:", req.files ? req.files.map(f => f.originalname) : "No files");

    const { bidId, tenderId, vendorId, documentType } = req.body;

    // --- 1️⃣ Validate request ---
    if (!tenderId || !vendorId || !documentType) {
      return res.status(400).json({
        success: false,
        message: "Tender ID, Vendor ID, and Document Type are required",
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files were uploaded",
      });
    }

    // --- 2️⃣ Validate vendor and tender ---
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    const tender = await Tenders.findById(tenderId);
    if (!tender) {
      return res.status(404).json({
        success: false,
        message: "Tender not found",
      });
    }

    if (tender.status !== "open") {
      return res.status(400).json({
        success: false,
        message: "Tender is no longer accepting bids",
      });
    }

    // --- 3️⃣ Retrieve or create bid ---
    let bid;

    if (bidId && bidId !== "new") {
      bid = await Bid.findById(bidId);
    } else {
      bid = await Bid.findOne({ vendor: vendorId, tender: tenderId });

      if (!bid) {
        bid = new Bid({
          tender: tenderId,
          vendor: vendorId,
          status: "draft",
          documents: [],
        });
      } else if (!req.body.bidId || req.body.bidId === "new") {
        // 🧹 Reset old bid documents if user starts a fresh upload
        console.log("🧹 Resetting old bid documents for fresh upload");
        bid.documents = [];
      }
    }

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    if (!Array.isArray(bid.documents)) {
      bid.documents = [];
    }

    console.log("📋 Existing documents before update:", bid.documents);

    // --- 4️⃣ Remove only the document of the same type ---
    bid.documents = bid.documents.filter(
      (doc) => doc && doc.type !== documentType
    );

    // --- 5️⃣ Add the newly uploaded document ---
    const uploadedFile = req.files[0];
    const newDoc = {
      name: uploadedFile.originalname,
      type: documentType,
      // Normalize the file path (ensure it always starts with /uploads)
      filePath: uploadedFile.path.startsWith("/uploads")
        ? uploadedFile.path
        : `/uploads/${uploadedFile.filename}`,
      uploadedAt: new Date(),
      size: uploadedFile.size,
    };

    bid.documents.push(newDoc);
    bid.markModified("documents");

    // --- 6️⃣ Save and return updated bid ---
    await bid.save();

    console.log(`✅ ${documentType} uploaded successfully for bid ${bid._id}`);

    const updatedBid = await Bid.findById(bid._id)
      .populate("vendor", "businessName vendor")
      .populate("tender", "title budget deadline");

    res.status(200).json({
      success: true,
      message: `${documentType} uploaded successfully`,
      data: updatedBid,
    });
  } catch (err) {
    console.error("❌ Error uploading bid documents:", err);
    res.status(500).json({
      success: false,
      message: "Failed to upload documents",
      error:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error",
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