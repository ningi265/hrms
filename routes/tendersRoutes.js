const express = require("express");
const {
    createTender,
    getAllTenders,
getCompanyTenders,
        getTenderById,
} = require("../api/controllers/tendersController");
const { protect } = require("../api/middleware/authMiddleware");
const { trackApiUsage } = require("../api/middleware/usageMiddleware");

const router = express.Router();

// Create Tender (Procurement Officers only)
router.post("/", protect(["procurement_officer", "admin","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), trackApiUsage, createTender);

// Get all RFQs (Procurement Officers & Admins)
router.get("/", protect(["procurement_officer", "admin", "Vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), getAllTenders);


router.get("/company", protect(["procurement_officer", "admin", "Vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), getCompanyTenders);


router.get("/:id", protect(["procurement_officer", "admin", "Vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), getTenderById);



module.exports = router;
