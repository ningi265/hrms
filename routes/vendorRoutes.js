const express = require("express");
const { addVendor, getVendors, updateVendor, deleteVendor, getVendorByUser , uploadDocs} = require("../api/controllers/vendorController");
const { protect } = require("../api/middleware/authMiddleware");
const vendorController = require('../api/controllers/vendorController');
const router = express.Router();

// Only Admins & Procurement Officers can manage vendors
router.post("/", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance", "Enterprise(CEO, CFO, etc.)"]), addVendor);
router.get("/", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources","Enterprise(CEO, CFO, etc.)",
        "Accounting/Finance"]), getVendors);

router.get("/me", protect(["admin", "procurement_officer", "Vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]),getVendorByUser);

router.put("/:id", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), updateVendor);
router.delete("/:id", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), deleteVendor);

router.post('/register', protect(["admin", "Vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), 
    vendorController.uploadDocs, 
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
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), vendorController.getVendorByUser);

// GET /api/vendors - Get all vendors
router.get('/', protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), vendorController.getVendors);
router.get('/vendor-data', protect(["admin", "Vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), vendorController.getVendorRegistrationData );
// GET /api/vendors/:vendorId - Get specific vendor details
router.get('/:vendorId', protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)", "Vendor"]), vendorController.getVendorDetails);

// POST /api/vendors - Add vendor (legacy method for compatibility)
router.post('/', protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), vendorController.addVendor);

// PUT /api/vendors/:id - Update vendor
router.put('/:id', protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), vendorController.updateVendor);

// DELETE /api/vendors/:id - Delete vendor
router.delete('/:id', protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), vendorController.deleteVendor);


        // POST /api/vendors/admin/approve/:vendorId - Approve vendor registration
router.post('/approve/:vendorId', 
   protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), 
    vendorController.approveVendor
);

// POST /api/vendors/admin/reject/:vendorId - Reject vendor registration
router.post('/reject/:vendorId', 
    protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), 
    vendorController.rejectVendor
);
// Admin only routes (requires admin role)
// GET /api/vendors/admin/pending - Get all pending registrations
router.get('/admin/pending', 
  protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]),
    vendorController.getPendingRegistrations
);

router.post('/send-pre-qual-email',protect(["admin", 
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources","Vendor",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]),  vendorController.sendPreQualEmail);




router.get('/pending/registration', 
    protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), 
    vendorController.getPendingRegistrations
);


module.exports = router;
