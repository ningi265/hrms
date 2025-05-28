const express = require("express");
const { addVendor, getVendors, updateVendor, deleteVendor, getVendorByUser } = require("../api/controllers/vendorController");
const { protect } = require("../api/middleware/authMiddleware");
const vendorController = require('../api/controllers/vendorController');
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

router.get("/me", protect(["admin", "procurement_officer", "Vendor","IT/Technical",
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

router.post('/register', protect(["admin", "Vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), 
    vendorController.uploadPowerOfAttorney, 
    vendorController.registerVendor
);
// GET /api/vendors/registration-status - Check registration status by email
router.get('/registration-status', vendorController.getRegistrationStatus);

// Protected routes (authentication required)
// GET /api/vendors/by-user - Get vendor by authenticated user
router.get('/by-user', protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), vendorController.getVendorByUser);

// GET /api/vendors - Get all vendors
router.get('/', protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), vendorController.getVendors);

// GET /api/vendors/:vendorId - Get specific vendor details
router.get('/:vendorId', protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), vendorController.getVendorDetails);

// POST /api/vendors - Add vendor (legacy method for compatibility)
router.post('/', protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), vendorController.addVendor);

// PUT /api/vendors/:id - Update vendor
router.put('/:id', protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), vendorController.updateVendor);

// DELETE /api/vendors/:id - Delete vendor
router.delete('/:id', protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), vendorController.deleteVendor);


        // POST /api/vendors/admin/approve/:vendorId - Approve vendor registration
router.post('/approve/:vendorId', 
   protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), 
    vendorController.approveVendor
);

// POST /api/vendors/admin/reject/:vendorId - Reject vendor registration
router.post('/reject/:vendorId', 
    protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), 
    vendorController.rejectVendor
);
// Admin only routes (requires admin role)
// GET /api/vendors/admin/pending - Get all pending registrations
router.get('/admin/pending', 
  protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]),
    vendorController.getPendingRegistrations
);




router.get('/pending/registration', 
    protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), 
    vendorController.getPendingRegistrations
);
module.exports = router;
