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

const router = express.Router();

// Create PO (Procurement Officer)
router.post("/", protect(["procurement_officer"]), createPO);

router.get("/stats", protect(["admin", "procurement_officer","vendor"]), getPOStats);

router.put("/:id/vendor/confirm", protect(["admin","vendor"]), confirmPO);

// Approve PO (Admin Only)
router.put("/:id/approve", protect(["admin"]), approvePO);

router.put("/:id/delivery-status", protect(["admin", "vendor"]), updateDeliveryStatus);


router.put("/:id/delivery-confirmed", protect(["admin", "procurement_officer"]), confirmDelivery);

// Reject PO (Admin Only)
router.put("/:id/reject", protect(["admin"]), rejectPO);

// Get All POs
router.get("/", protect(["procurement_officer", "admin", "vendor"]), getAllPOs);

// Get Single PO
router.get("/:id", protect(["procurement_officer", "admin", "vendor"]), getPOById);

// Vendor updates delivery status
router.put("/:id/delivery", protect(["vendor"]), updateDeliveryStatus);

// Procurement officer confirms delivery
router.put("/:id/confirm", protect(["procurement_officer"]), confirmDelivery);




module.exports = router;



