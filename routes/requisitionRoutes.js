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
        "Accounting/Finance","Sales/Marketing","Enterprise(CEO, CFO, etc.)"]), createRequisition);

// Employee: Get my requisitions
router.get("/my", protect(["Sales/Marketing"]), getMyRequisitions);

// Procurement/Admin: Get all requisitions
router.get("/", protect(["procurement_officer", "admin","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), getAllRequisitions);

// Procurement/Admin: Approve requisition
router.put("/:id/approve", protect(["procurement_officer", "admin","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), approveRequisition);

// Procurement/Admin: Reject requisition
router.put("/:id/reject", protect(["procurement_officer", "admin","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), rejectRequisition);

router.get("/approved", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), getApprovedRequisitions);
router.get("/rejected", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), getRejectedRequisitions);
router.get("/pending", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), getPendingRequisitions);

router.get("/pendings", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), getAllPendingRequisitions);

router.get("/stats", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), getRequisitionStats);

router.get("/pending", protect(["admin", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), getPendingRequisitions);
router.post("/travel", protect(["employee", "procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)"]), travelRequisition);

module.exports = router;
