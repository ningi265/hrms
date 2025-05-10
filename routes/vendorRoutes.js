const express = require("express");
const { addVendor, getVendors, updateVendor, deleteVendor, getVendorByUser } = require("../api/controllers/vendorController");
const { protect } = require("../api/middleware/authMiddleware");

const router = express.Router();

// Only Admins & Procurement Officers can manage vendors
router.post("/", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), addVendor);
router.get("/", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), getVendors);

router.get("/me", protect(["admin", "procurement_officer", "vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]),getVendorByUser);

router.put("/:id", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), updateVendor);
router.delete("/:id", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), deleteVendor);

module.exports = router;
