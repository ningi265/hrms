const express = require("express");
const router = express.Router();
const vendorPreQualController = require("../api/controllers/vendorPreQualificationController");

// CRUD routes
router.post("/", vendorPreQualController.createPreQualification);
router.get("/", vendorPreQualController.getAllPreQualifications);
router.get("/vendor/:vendorId", vendorPreQualController.getPreQualificationByVendor);
router.put("/:id", vendorPreQualController.updatePreQualification);
router.delete("/:id", vendorPreQualController.deletePreQualification);

module.exports = router;
