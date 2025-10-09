// routes/bids.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const bidController = require('../api/controllers/bidController');

const bidStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/bid-documents/';
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = `bid-doc-${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.doc', '.docx', '.xlsx', '.xls', '.jpg', '.jpeg', '.png'];
  const fileExt = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, Excel, JPG, and PNG files are allowed.'), false);
  }
};

const uploadBidDocuments = multer({
  storage: bidStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
}).array('documents', 5);

// Add error handling middleware for Multer
const handleMulterErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  } else if (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
  next();
};

// GET /api/bids/vendor/:vendorId/tender/:tenderId - Get vendor's bid for tender
router.get('/vendor/:vendorId/tender/:tenderId', bidController.getVendorBid);

// POST /api/bids - Create or update bid
router.post('/', bidController.createOrUpdateBid);

// POST /api/bids/documents - Upload bid documents (with error handling)
router.post('/documents', uploadBidDocuments, handleMulterErrors, bidController.uploadBidDocuments);

// POST /api/bids/submit - Submit bid
router.post('/submit', bidController.submitBid);

// GET /api/bids/check-application/:vendorId/:tenderId - Check if vendor has applied
router.get('/check-application/:vendorId/:tenderId', bidController.checkVendorApplication);



// Company bidding portal routes
router.get('/tender/:tenderId', bidController.getBidsByTender);
router.get('/tender/:tenderId/count', bidController.getBidCountByTender);
router.put('/:bidId/evaluate', bidController.evaluateBid);
router.put('/:bidId/award', bidController.awardBid);
router.get('/', bidController.getAllBids);




// GET /api/bids/:bidId/documents/:documentId/download - Download bid document
router.get('/:bidId/documents/:documentId/download', bidController.downloadDocument);

// GET /api/bids/:bidId/documents/:documentId/view - View bid document in browser
router.get('/:bidId/documents/:documentId/view', bidController.viewDocument);

// GET /api/bids/:bidId/documents/:documentId - Get document info
router.get('/:bidId/documents/:documentId', bidController.getDocumentInfo);

router.get('/:bidId/documents/:documentId/view', bidController.viewDocument);

module.exports = router;