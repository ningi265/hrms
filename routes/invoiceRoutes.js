const express = require("express");
const {
    submitInvoice,
    approveInvoice,
    rejectInvoice,
    markAsPaid,
    getAllInvoices,
    getInvoiceById,
    getInvoiceStats
} = require("../api/controllers/invoiceController");
const { protect } = require("../api/middleware/authMiddleware");

const router = express.Router();

// Vendor submits an invoice
router.post("/", protect(["vendor"]), submitInvoice);

router.get("/stats", protect(["admin", "procurement_officer","vendor"]), getInvoiceStats);

// Approve invoice (Admin Only)
router.put("/:id/approve", protect(["admin","procurement_officer"]), approveInvoice);

// Reject invoice (Admin Only)
router.put("/:id/reject", protect(["admin","procurement_officer"]), rejectInvoice);

// Mark invoice as paid (Finance Team)
router.put("/:id/status/pay", protect(["finance", "admin", "procurement_officer"]), markAsPaid);

// Get all invoices
router.get("/", protect(["procurement_officer", "admin", "finance"]), getAllInvoices);

// Get single invoice
router.get("/:id", protect(["procurement_officer", "admin", "finance", "vendor"]), getInvoiceById);



module.exports = router;
