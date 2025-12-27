const express = require('express');
const router = express.Router();
const approvalWorkflowController = require('../api/controllers/approvalWorkflowController');
const { protect } = require('../api/middleware/authMiddleware');

// Define allowed roles for workflow management
const workflowAdminRoles = [
 "procurement_officer", "admin","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Enterprise(CEO, CFO, etc.)", "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer"
];


// Apply middleware to all routes
router.use(protect(workflowAdminRoles));

// Workflow CRUD operations
router.post('/', approvalWorkflowController.createWorkflow);
router.get('/', approvalWorkflowController.getWorkflows);
router.get('/templates', approvalWorkflowController.getWorkflowTemplates);
router.get('/applicable', approvalWorkflowController.getApplicableWorkflow);

// Single workflow operations
router.get('/:id', approvalWorkflowController.getWorkflow);
router.put('/:id', approvalWorkflowController.updateWorkflow);
router.delete('/:id', approvalWorkflowController.deleteWorkflow);
router.post('/:id/clone', approvalWorkflowController.cloneWorkflow);
router.post('/:id/publish', approvalWorkflowController.publishWorkflow);
router.post('/:id/test', approvalWorkflowController.testWorkflow);
router.get('/:id/statistics', approvalWorkflowController.getWorkflowStatistics);

module.exports = router;