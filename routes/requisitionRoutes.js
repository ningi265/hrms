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


const billingRoles = [
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources",
  "Enterprise(CEO, CFO, etc.)","Software Engineer",
    "Senior Software Engineer", 
    "Lead Engineer",
    "Product Manager",
    "Senior Product Manager",
    "Data Scientist",
    "Data Analyst",
    "UI/UX Designer",
    "Senior Designer",
    "DevOps Engineer",
    "Quality Assurance Engineer",
    "Business Analyst",
    "Project Manager",
    "Scrum Master",
    "Sales Representative",
    "Sales Manager",
    "Marketing Specialist",
    "Marketing Manager",
    "HR Specialist",
    "HR Manager",
    "Finance Analyst",
    "Accountant",
    "Administrative Assistant",
    "Office Manager",
    "Customer Support Representative",
    "Customer Success Manager"
];

// Employee: Create a new requisition
router.post("/", protect(billingRoles), createRequisition);

// Employee: Get my requisitions
router.get("/my", protect(billingRoles), getMyRequisitions);

// Procurement/Admin: Get all requisitions
router.get("/", protect(billingRoles), getAllRequisitions);

// Procurement/Admin: Approve requisition
router.put("/:id/approve", protect(billingRoles), approveRequisition);

// Procurement/Admin: Reject requisition
router.put("/:id/reject", protect(billingRoles), rejectRequisition);

router.get("/approved", protect(billingRoles), getApprovedRequisitions);
router.get("/rejected", protect(billingRoles), getRejectedRequisitions);
router.get("/pending", protect(billingRoles), getPendingRequisitions);

router.get("/pendings", protect(billingRoles), getAllPendingRequisitions);

router.get("/stats", protect(billingRoles), getRequisitionStats);

router.get("/pending", protect(billingRoles), getPendingRequisitions);
router.post("/travel", protect(billingRoles), travelRequisition);

module.exports = router;
