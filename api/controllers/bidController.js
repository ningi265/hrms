// controllers/bidController.js
const Bid = require('../../models/bid');
const Tenders = require('../../models/tenders');
const Vendor = require('../../models/vendor');
const fs = require('fs'); 
const path = require('path'); 

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
  filePath: `/uploads/bid-documents/${uploadedFile.filename}`,
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



// Get all bids for a specific tender (for company users)
exports.getBidsByTender = async (req, res) => {
  try {
    const { tenderId } = req.params;

    const tender = await Tenders.findById(tenderId);
    if (!tender) {
      return res.status(404).json({
        success: false,
        message: "Tender not found"
      });
    }

    const bids = await Bid.find({ tender: tenderId })
      .populate('vendor', 'businessName vendor registrationStatus')
      .populate('tender', 'title budget deadline status')
      .sort({ submittedAt: -1, createdAt: -1 });

    res.json({
      success: true,
      data: bids,
      count: bids.length
    });

  } catch (err) {
    console.error("Error fetching bids by tender:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching bids",
      error: err.message
    });
  }
};

// Get bid count for a tender
exports.getBidCountByTender = async (req, res) => {
  try {
    const { tenderId } = req.params;

    const count = await Bid.countDocuments({ 
      tender: tenderId,
      status: { $in: ["submitted", "under_review", "technical_evaluation", "financial_evaluation", "awarded"] }
    });

    res.json({
      success: true,
      count: count
    });

  } catch (err) {
    console.error("Error fetching bid count:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching bid count",
      error: err.message
    });
  }
};

// Evaluate a bid (technical/financial scoring)
exports.evaluateBid = async (req, res) => {
  try {
    const { bidId } = req.params;
    const { technicalScore, financialScore, comments, recommendation } = req.body;

    if (!bidId) {
      return res.status(400).json({
        success: false,
        message: "Bid ID is required"
      });
    }

    const bid = await Bid.findById(bidId);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found"
      });
    }

    // Update evaluation fields
    if (technicalScore !== undefined) {
      bid.technicalScore = parseInt(technicalScore);
    }
    if (financialScore !== undefined) {
      bid.financialScore = parseInt(financialScore);
    }
    if (comments !== undefined) {
      bid.evaluationComments = comments;
    }
    if (recommendation !== undefined) {
      bid.recommendation = recommendation;
    }

    // Calculate total score if both scores are provided
    if (technicalScore !== undefined && financialScore !== undefined) {
      bid.totalScore = (parseInt(technicalScore) + parseInt(financialScore)) / 2;
    }

    // Update status based on evaluation
    if (bid.status === 'submitted') {
      bid.status = 'under_review';
    }

    bid.updatedAt = new Date();
    await bid.save();

    const populatedBid = await Bid.findById(bidId)
      .populate('vendor', 'businessName vendor')
      .populate('tender', 'title budget deadline');

    res.json({
      success: true,
      message: "Bid evaluation saved successfully",
      data: populatedBid
    });

  } catch (err) {
    console.error("Error evaluating bid:", err);
    res.status(500).json({
      success: false,
      message: "Failed to evaluate bid",
      error: err.message
    });
  }
};

// Award a bid to a vendor
exports.awardBid = async (req, res) => {
  try {
    const { bidId } = req.params;

    const bid = await Bid.findById(bidId);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found"
      });
    }

    const tender = await Tenders.findById(bid.tender);
    if (!tender) {
      return res.status(404).json({
        success: false,
        message: "Tender not found"
      });
    }

    // Check if tender is still open
    if (tender.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: "Cannot award bid for a closed tender"
      });
    }

    // Set all other bids for this tender to 'rejected'
    await Bid.updateMany(
      { 
        tender: bid.tender, 
        _id: { $ne: bidId },
        status: { $ne: 'awarded' }
      },
      { 
        status: 'rejected',
        updatedAt: new Date()
      }
    );

    // Award the selected bid
    bid.status = 'awarded';
    bid.awardedAt = new Date();
    bid.updatedAt = new Date();
    await bid.save();

    // Close the tender
    tender.status = 'closed';
    tender.awardedTo = bid.vendor;
    tender.updatedAt = new Date();
    await tender.save();

    const populatedBid = await Bid.findById(bidId)
      .populate('vendor', 'businessName vendor')
      .populate('tender', 'title budget deadline');

    res.json({
      success: true,
      message: "Bid awarded successfully",
      data: populatedBid
    });

  } catch (err) {
    console.error("Error awarding bid:", err);
    res.status(500).json({
      success: false,
      message: "Failed to award bid",
      error: err.message
    });
  }
};

// Get all bids with filtering and pagination (for admin dashboard)
exports.getAllBids = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      tenderId, 
      vendorId 
    } = req.query;

    const filter = {};
    
    if (status) filter.status = status;
    if (tenderId) filter.tender = tenderId;
    if (vendorId) filter.vendor = vendorId;

    const bids = await Bid.find(filter)
      .populate('vendor', 'businessName vendor registrationStatus')
      .populate('tender', 'title budget deadline company')
      .sort({ submittedAt: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Bid.countDocuments(filter);

    res.json({
      success: true,
      data: bids,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalBids: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });

  } catch (err) {
    console.error("Error fetching all bids:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching bids",
      error: err.message
    });
  }
};


exports.downloadDocument = async (req, res) => {
  try {
    const { bidId, documentId } = req.params;

    console.log("📥 Download request:", { bidId, documentId });

    const bid = await Bid.findById(bidId);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found"
      });
    }

    const document = bid.documents.id(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found in bid"
      });
    }

    console.log("📄 Found document:", {
      name: document.name,
      type: document.type,
      filePath: document.filePath,
      size: document.size
    });

    // Extract filename from filePath
    const filename = path.basename(document.filePath);
    console.log("📝 Extracted filename:", filename);

    // The file is actually in the bid-documents subdirectory
    // but the stored filePath doesn't include this
    let filePath;
    
    // Try multiple possible locations in order
    const possiblePaths = [
      // First try: bid-documents directory (most likely location)
      path.join(process.cwd(), 'uploads', 'bid-documents', filename),
      // Second try: direct path from database (if it includes bid-documents)
      path.join(process.cwd(), document.filePath.startsWith('/') ? document.filePath.substring(1) : document.filePath),
      // Third try: uploads root (fallback)
      path.join(process.cwd(), 'uploads', filename)
    ];

    console.log("🔍 Checking possible file paths:");
    let foundPath = null;
    
    for (const possiblePath of possiblePaths) {
      console.log("   →", possiblePath);
      if (fs.existsSync(possiblePath)) {
        foundPath = possiblePath;
        console.log("✅ File found at:", foundPath);
        break;
      }
    }

    if (!foundPath) {
      console.log("❌ File not found in any location");
      
      // List all files in bid-documents for debugging
      const bidDocsDir = path.join(process.cwd(), 'uploads/bid-documents');
      if (fs.existsSync(bidDocsDir)) {
        const files = fs.readdirSync(bidDocsDir);
        console.log("📂 All files in bid-documents:", files);
        
        // Check if our file exists with a different name
        const matchingFiles = files.filter(f => f.includes('1759996501331'));
        if (matchingFiles.length > 0) {
          console.log("🎯 Files with matching timestamp:", matchingFiles);
        }
      }

      return res.status(404).json({
        success: false,
        message: "File not found on server",
        searchedPaths: possiblePaths,
        storedFilePath: document.filePath,
        actualFilename: filename
      });
    }

    filePath = foundPath;

    console.log("✅ File confirmed, starting download...");

    // Get file stats
    const stats = fs.statSync(filePath);
    console.log("📊 File stats:", {
      size: stats.size,
      modified: stats.mtime
    });

    // Set appropriate headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${document.name}"`);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-File-Name', encodeURIComponent(document.name));

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    
    fileStream.on('error', (error) => {
      console.error('❌ File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Error streaming file",
          error: error.message
        });
      }
    });

    // Handle client disconnect
    req.on('close', () => {
      if (fileStream && !fileStream.closed) {
        fileStream.destroy();
      }
    });

    fileStream.pipe(res);

  } catch (err) {
    console.error("❌ Error in downloadDocument:", err);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to download document",
        error: err.message
      });
    }
  }
};

// Get document info
exports.getDocumentInfo = async (req, res) => {
  try {
    const { bidId, documentId } = req.params;

    const bid = await Bid.findById(bidId);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found"
      });
    }

    const document = bid.documents.id(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found"
      });
    }

    res.json({
      success: true,
      data: document
    });

  } catch (err) {
    console.error("Error getting document info:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get document info",
      error: err.message
    });
  }
};


exports.viewDocument = async (req, res) => {
  try {
    const { bidId, documentId } = req.params;

    console.log("👀 View document request:", { bidId, documentId });

    const bid = await Bid.findById(bidId);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found"
      });
    }

    const document = bid.documents.id(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found in bid"
      });
    }

    console.log("📄 Found document for viewing:", {
      name: document.name,
      type: document.type,
      filePath: document.filePath
    });

    // Extract filename from filePath
    const filename = path.basename(document.filePath);
    
    // Construct the full file path - same logic as download
    let filePath;
    const possiblePaths = [
      path.join(process.cwd(), 'uploads', 'bid-documents', filename),
      path.join(process.cwd(), document.filePath.startsWith('/') ? document.filePath.substring(1) : document.filePath),
      path.join(process.cwd(), 'uploads', filename)
    ];

    let foundPath = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        foundPath = possiblePath;
        console.log("✅ File found for viewing at:", foundPath);
        break;
      }
    }

    if (!foundPath) {
      console.log("❌ File not found for viewing");
      return res.status(404).json({
        success: false,
        message: "File not found on server"
      });
    }

    filePath = foundPath;

    // Determine content type based on file extension
    const ext = path.extname(document.name).toLowerCase();
    const contentTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.txt': 'text/plain'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';
    console.log("📄 Content type determined:", contentType);

    // Set headers for viewing in browser (inline instead of attachment)
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${document.name}"`);
    res.setHeader('Content-Length', fs.statSync(filePath).size);
    res.setHeader('Cache-Control', 'no-cache');

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    
    fileStream.on('error', (error) => {
      console.error('❌ File stream error in view:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Error streaming file for viewing",
          error: error.message
        });
      }
    });

    fileStream.pipe(res);

  } catch (err) {
    console.error("❌ Error in viewDocument:", err);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to view document",
        error: err.message
      });
    }
  }
};
