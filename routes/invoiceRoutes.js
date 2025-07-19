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
router.post("/", protect(["Vendor"]), submitInvoice);

router.get("/stats", protect(["admin", "procurement_officer","vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), getInvoiceStats);

// Approve invoice (Admin Only)
router.post("/:id/approve", protect(["admin","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), approveInvoice);

// Reject invoice (Admin Only)
router.post("/:id/reject", protect(["admin","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), rejectInvoice);

// Mark invoice as paid (Finance Team)
router.post("/:id/status/pay", protect(["finance", "admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), markAsPaid);

// Get all invoices
router.get("/", protect(["procurement_officer", "admin", "finance","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), getAllInvoices);

// Get single invoice
router.get("/:id", protect(["procurement_officer", "admin", "finance", "vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), getInvoiceById);



module.exports = router;
