const express = require("express");
const {
    createRequisition,
    getAllRequisitions,
    approveRequisition,
    rejectRequisition,
    getMyRequisitions,
    getApprovedRequisitions,
    getRejectedRequisitions,
    getPendingRequisitions,
    getRequisitionStats
} = require("../api/controllers/requisitionController");
const { protect } = require("../api/middleware/authMiddleware");

const router = express.Router();

// Employee: Create a new requisition
router.post("/", protect(["employee","procurement_officer"]), createRequisition);

// Employee: Get my requisitions
router.get("/my", protect(["employee"]), getMyRequisitions);

// Procurement/Admin: Get all requisitions
router.get("/", protect(["procurement_officer", "admin"]), getAllRequisitions);

// Procurement/Admin: Approve requisition
router.put("/:id/approve", protect(["procurement_officer", "admin"]), approveRequisition);

// Procurement/Admin: Reject requisition
router.put("/:id/reject", protect(["procurement_officer", "admin"]), rejectRequisition);

router.get("/approved", protect(["admin", "procurement_officer"]), getApprovedRequisitions);
router.get("/rejected", protect(["admin", "procurement_officer"]), getRejectedRequisitions);
router.get("/pending", protect(["admin", "procurement_officer"]), getPendingRequisitions);
router.get("/stats", protect(["admin", "procurement_officer"]), getRequisitionStats);

router.get("/pending", protect(["admin", "procurement_officer"]), getPendingRequisitions);

module.exports = router;
