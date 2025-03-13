const express = require("express");
const { addVendor, getVendors, updateVendor, deleteVendor, getVendorByUser } = require("../api/controllers/vendorController");
const { protect } = require("../api/middleware/authMiddleware");

const router = express.Router();

// Only Admins & Procurement Officers can manage vendors
router.post("/", protect(["admin", "procurement_officer"]), addVendor);
router.get("/", protect(["admin", "procurement_officer"]), getVendors);

router.get("/me", protect(["admin", "procurement_officer", "vendor"]),getVendorByUser);

router.put("/:id", protect(["admin", "procurement_officer"]), updateVendor);
router.delete("/:id", protect(["admin", "procurement_officer"]), deleteVendor);

module.exports = router;
