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
    travelRequisition,
    getAllApprovedRequisitions,
    approveRequisitionStep,
    rejectRequisitionStep,
    getPendingApprovals,
    getRequisitionWorkflowDetails
} = require("../api/controllers/requisitionController");
const { protect } = require("../api/middleware/authMiddleware");

const router = express.Router();

const billingRoles = [
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources",
  "Enterprise(CEO, CFO, etc.)",
  "Software Engineer",
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

// ======================
// 🔄 WORKFLOW ROUTES
// ======================

// Get requisitions pending user's approval (for approvers)
router.get("/pending", protect(billingRoles), getPendingApprovals);

// Get detailed workflow information for a requisition
router.get("/:id/workflow-details", protect(billingRoles), getRequisitionWorkflowDetails);

// Approve a specific workflow step (new workflow-aware endpoint)
router.post("/:id/approve-step", protect(billingRoles), approveRequisitionStep);

// Reject a specific workflow step (new workflow-aware endpoint)
router.post("/:id/reject-step", protect(billingRoles), rejectRequisitionStep);

// ======================
// 📋 EXISTING ROUTES
// ======================

// Employee: Create a new requisition (now with workflow integration)
router.post("/", protect(billingRoles), createRequisition);

// Employee: Get my requisitions
router.get("/my", protect(billingRoles), getMyRequisitions);

// Procurement/Admin: Get all requisitions
router.get("/", protect(billingRoles), getAllRequisitions);

// Get all approved requisitions
router.get("/all/approved", protect(billingRoles), getAllApprovedRequisitions);

// Procurement/Admin: Approve requisition (legacy endpoint - still works)
router.put("/:id/approve", protect(billingRoles), approveRequisition);

// Procurement/Admin: Reject requisition (legacy endpoint - still works)
router.put("/:id/reject", protect(billingRoles), rejectRequisition);

// Get approved requisitions (legacy)
router.get("/approved", protect(billingRoles), getApprovedRequisitions);

// Get rejected requisitions (legacy)
router.get("/rejected", protect(billingRoles), getRejectedRequisitions);

// Get pending requisitions (department admin view) - RENAMED
router.get("/department-pending", protect(billingRoles), getPendingRequisitions);

// Get all pending requisitions (admin view)
router.get("/all-pending", protect(billingRoles), getAllPendingRequisitions);

// Get requisition statistics
router.get("/stats", protect(billingRoles), getRequisitionStats);

// Travel requisition
router.post("/travel", protect(billingRoles), travelRequisition);

module.exports = router;