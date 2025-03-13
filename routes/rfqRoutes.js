const express = require("express");
const {
    createRFQ,
    getAllRFQs,
    submitQuote,
    selectVendor,
    getRFQStats,
    getRFQById
} = require("../api/controllers/rfqController");
const { protect } = require("../api/middleware/authMiddleware");
const { getPOById } = require("../api/controllers/purchaseOrderController");

const router = express.Router();

// Create RFQ (Procurement Officers only)
router.post("/", protect(["procurement_officer", "admin"]), createRFQ);

// Get all RFQs (Procurement Officers & Admins)
router.get("/", protect(["procurement_officer", "admin", "vendor"]), getAllRFQs);

// Vendor submits a quote
router.post("/:id/quote", protect(["vendor", "admin"]), submitQuote);

// Select the best vendor (Procurement Officers & Admins)
router.put("/:id/select", protect(["procurement_officer", "admin"]), selectVendor);

router.get("/stats",  protect(["admin", "procurement_officer","vendor"]), getRFQStats);

router.get("/:id", protect(["admin", "procurement_officer", "vendor"]),getRFQById);

module.exports = router;
