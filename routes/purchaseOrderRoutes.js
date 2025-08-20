const express = require("express");
const {
    createPO,
    approvePO,
    rejectPO,
    getAllPOs,
    getPOById,
    updateDeliveryStatus,
    confirmDelivery,
    getPOStats,
    confirmPO
} = require("../api/controllers/purchaseOrderController");
const { protect } = require("../api/middleware/authMiddleware");
const { trackApiUsage, checkStorageLimit, getUsageSummary } = require("../api/middleware/usageMiddleware");

const router = express.Router();

// Apply API usage tracking to all routes
router.use(trackApiUsage);

// Create PO (Procurement Officer)
router.post("/", 
  protect([
    "procurement_officer",
    "IT/Technical",
    "Executive (CEO, CFO, etc.)",
    "Management",
    "Human Resources",
    "Accounting/Finance",
    "Enterprise(CEO, CFO, etc.)"
  ]), 
  createPO
);

// Get PO statistics
router.get("/stats", 
  protect([
    "admin",
    "Vendor",
    "IT/Technical",
    "Executive (CEO, CFO, etc.)",
    "Management",
    "Human Resources",
    "Accounting/Finance",
    "Enterprise(CEO, CFO, etc.)"
  ]), 
  getPOStats
);

// Vendor confirms PO
router.put("/:id/vendor/confirm", 
  protect([
    "admin",
    "Vendor",
    "IT/Technical",
    "Executive (CEO, CFO, etc.)",
    "Management",
    "Human Resources",
    "Accounting/Finance",
    "Enterprise(CEO, CFO, etc.)"
  ]), 
  confirmPO
);

// Approve PO (Admin Only)
router.put("/:id/approve", 
  protect(["admin"]), 
  approvePO
);

// Update delivery status
router.put("/:id/delivery-status", 
  protect(["admin", "Vendor"]), 
  updateDeliveryStatus
);

// Confirm delivery
router.put("/:id/delivery-confirmed", 
  protect([
    "procurement_officer", 
    "admin", 
    "IT/Technical",
    "Executive (CEO, CFO, etc.)",
    "Management",
    "Sales/Marketing",
    "Operations",
    "Human Resources",
    "Accounting/Finance",
    "Other",
    "vendor",
    "Enterprise(CEO, CFO, etc.)"
  ]),
  confirmDelivery
);

// Reject PO (Admin Only)
router.put("/:id/reject", 
  protect(["admin"]), 
  rejectPO
);

// Get All POs
router.get("/", 
  protect([
    "procurement_officer", 
    "admin", 
    "Vendor",
    "IT/Technical",
    "Executive (CEO, CFO, etc.)",
    "Management",
    "Human Resources",
    "Accounting/Finance",
    "Enterprise(CEO, CFO, etc.)"
  ]), 
  getAllPOs
);

// Get Single PO
router.get("/:id", 
  protect([
    "procurement_officer", 
    "admin", 
    "Vendor",
    "IT/Technical",
    "Executive (CEO, CFO, etc.)",
    "Management",
    "Human Resources",
    "Accounting/Finance",
    "Enterprise(CEO, CFO, etc.)"
  ]), 
  getPOById
);

// Vendor updates delivery status
router.put("/:id/delivery", 
  protect(["Vendor"]), 
  updateDeliveryStatus
);

// Procurement officer confirms delivery
router.put("/:id/confirm", 
  protect([
    "procurement_officer", 
    "admin", 
    "IT/Technical",
    "Executive (CEO, CFO, etc.)",
    "Management",
    "Sales/Marketing",
    "Operations",
    "Human Resources",
    "Accounting/Finance",
    "Other",
    "vendor",
    "Enterprise(CEO, CFO, etc.)"
  ]), 
  confirmDelivery
);

// Add usage summary endpoint
router.get("/usage/summary",
  protect([
    "procurement_officer",
    "admin",
    "IT/Technical",
    "Executive (CEO, CFO, etc.)",
    "Management",
    "Accounting/Finance"
  ]),
  getUsageSummary
);

module.exports = router;