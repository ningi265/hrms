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
     getAllPendingRequisitions,
    getRequisitionStats,
    travelRequisition
} = require("../api/controllers/requisitionController");
const { protect } = require("../api/middleware/authMiddleware");

const router = express.Router();

// Employee: Create a new requisition
router.post("/", protect(["employee","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Sales/Marketing"]), createRequisition);

// Employee: Get my requisitions
router.get("/my", protect(["employee"]), getMyRequisitions);

// Procurement/Admin: Get all requisitions
router.get("/", protect(["procurement_officer", "admin","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), getAllRequisitions);

// Procurement/Admin: Approve requisition
router.put("/:id/approve", protect(["procurement_officer", "admin","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), approveRequisition);

// Procurement/Admin: Reject requisition
router.put("/:id/reject", protect(["procurement_officer", "admin","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), rejectRequisition);

router.get("/approved", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), getApprovedRequisitions);
router.get("/rejected", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), getRejectedRequisitions);
router.get("/pending", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), getPendingRequisitions);

router.get("/pendings", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), getAllPendingRequisitions);
router.get("/stats", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), getRequisitionStats);

router.get("/pending", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), getPendingRequisitions);
router.post("/travel", protect(["employee", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), travelRequisition);

module.exports = router;
