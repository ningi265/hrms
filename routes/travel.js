const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const travelController = require('../api/controllers/travel');

const { protect } = require('../api/middleware/authMiddleware');

// Travel Request Routes
router.post( '/', protect(["employee","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Sales/Marketing"]), travelController.travelRequest);

router.get("/analytics", protect(["admin","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), travelController.getTravelExpenseAnalytics);
// Detailed breakdown endpoint
router.get("/breakdown", protect(["admin","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), travelController.getTravelExpenseBreakdown);

// Export endpoint for CSV/JSON data
router.get("/export", protect(["admin","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), travelController.exportTravelExpenseData);

router.get('/employee/processed',protect(["employee","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Sales/Marketing"]), travelController.getEmployeeProcessedRequests);

// Approval Routes
router.put( '/:id/supervisor-approval', protect(["admin","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), travelController.supervisorApproval);


router.put('/:id/final-approval',protect(["admin","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]),travelController.finalApproval);

// Fetching Routes     
router.get( '/pending/recon', protect(["admin","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), travelController.getPendingReconciliation);
router.get( '/approved/recon', protect(["admin","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), travelController.getApprovedReconciliation);
router.get( '/pending', protect(["employee","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), travelController.getPendingRequests);
router.get( '/pending/all', protect(["employee","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), travelController.getPendingRequestsAll);
router.get( '/pending/stats', protect(["employee","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), travelController.getPendingApprovalsStats);
router.get('/supervisor-approved', protect(["admin","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), travelController.getSupervisorApprovedRequests);
router.get('/finance/pending', protect(["admin","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Sales/Marketing"]), travelController.getFinancePendingRequests);
router.get('/finance/processed', protect(["admin","employee","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Sales/Marketing"]), travelController.getFinanceProcessedRequestsUser);
router.get('/employee/:employeeId/reconcile-pending', protect, travelController.getReconcilePendingRequests);

router.put( '/:id/expenses', protect(["employee","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), travelController.saveExpense);
router.put('/:id/assign-driver',protect(["admin","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]),travelController.assignDriver);
router.post('/:id/reconcile', protect(["admin","employee","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]),travelController.submitReconciliation);

router.post('/:id/send-notifications', protect(["admin","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), travelController.sendTravelNotifications);

// Finance Routes
router.put('/:id/finance-process', protect(["admin","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), travelController.financeProcess);

// Travel Execution Routes
router.put('/:id/complete-travel', protect, travelController.completeTravel);
router.put( '/:id/process-reconciliation',  protect(["admin","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), travelController.processReconciliation);

// Reconciliation Routes
router.post(
  '/:id/reconcile',
  protect,
  [
    body('expenses').isArray(),
    body('expenses.*.category').isString(),
    body('expenses.*.amount').isNumeric(),
    body('additionalNotes').optional().isString()
  ],
  travelController.submitReconciliation
);

router.get('/:id', protect(["admin","procurement_officer","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance"]), travelController.getTravelRequestById);

router.post(
  '/:id/reconcile-expenses',
  protect,
  [
    body('expenses').isArray(),
    body('expenses.*.category').isString(),
    body('expenses.*.amount').isNumeric().toFloat(),
    body('expenses.*.description').optional().isString(),
    body('tripReport').optional().isString()
  ],
  travelController.submitReconciliationWithExpenses
);

router.put(
  '/:id/approve-reconciliation',
  protect,
  travelController.approveReconciliation
);

router.put(
  '/:id/finance-review',
  protect,
  [
    body('action').isIn(['approve', 'reject', 'request_changes']),
    body('comments').optional().isString()
  ],
  travelController.financeReview
);

router.get(
  '/:id/reconciliation-status',
  protect,
  travelController.getReconciliationStatus
);

// Dashboard Routes
router.get('/dashboard/overview', protect, travelController.getDashboardOverview);
router.get('/dashboard/stats', protect, travelController.getDashboardStats);
router.get('/dashboard/quick-links', protect, travelController.getDashboardQuickLinks);
router.get('/upcoming', protect, travelController.getUpcomingTrips);
router.get('/recent', protect, travelController.getRecentRequests);




module.exports = router;