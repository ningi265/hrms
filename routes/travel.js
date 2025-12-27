const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const travelController = require('../api/controllers/travel');

const { protect } = require('../api/middleware/authMiddleware');


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
    "Customer Success Manager","Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer",
];



// Travel Request Routes
router.post( '/', protect(billingRoles), travelController.travelRequest);

router.get("/analytics", protect(billingRoles), travelController.getTravelExpenseAnalytics);
// Detailed breakdown endpoint
router.get("/breakdown", protect(billingRoles), travelController.getTravelExpenseBreakdown);

// Export endpoint for CSV/JSON data
router.get("/export", protect(billingRoles), travelController.exportTravelExpenseData);

router.get('/employee/processed',protect(billingRoles), travelController.getEmployeeProcessedRequests);

// Approval Routes
router.put( '/:id/supervisor-approval', protect(billingRoles), travelController.supervisorApproval);


router.put('/:id/final-approval',protect(billingRoles),travelController.finalApproval);

// Fetching Routes     
router.get( '/pending/recon', protect(billingRoles), travelController.getPendingReconciliation);
router.get( '/approved/recon', protect(billingRoles), travelController.getApprovedReconciliation);
router.get( '/pending', protect(billingRoles), travelController.getPendingRequests);
router.get( '/pending/all', protect(billingRoles), travelController.getPendingRequestsAll);
router.get( '/pending/stats', protect(billingRoles), travelController.getPendingApprovalsStats);
router.get('/supervisor-approved', protect(billingRoles), travelController.getSupervisorApprovedRequests);
router.get('/finance/pending', protect(billingRoles), travelController.getFinancePendingRequests);
router.get('/finance/processed', protect(billingRoles), travelController.getFinanceProcessedRequestsUser);
router.get('/employee/:employeeId/reconcile-pending', protect, travelController.getReconcilePendingRequests);

router.put( '/:id/expenses', protect(billingRoles), travelController.saveExpense);
router.put('/:id/assign-driver',protect(billingRoles),travelController.assignDriver);
router.post('/:id/reconcile', protect(billingRoles),travelController.submitReconciliation);

router.post('/:id/send-notifications', protect(billingRoles), travelController.sendTravelNotifications);

// Finance Routes
router.put('/:id/finance-process', protect(billingRoles), travelController.financeProcess);

// Travel Execution Routes
router.put('/:id/complete-travel', protect, travelController.completeTravel);
router.put( '/:id/process-reconciliation',  protect(billingRoles), travelController.processReconciliation);

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

router.get('/:id', protect(billingRoles), travelController.getTravelRequestById);

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


router.post('/:id/send-notification', protect(billingRoles), travelController.sendTravelNotification);


// Flight Booking Routes
router.post('/:id/book-flight', protect(billingRoles), travelController.bookFlight);
router.get('/:id/flight-booking', protect(billingRoles), travelController.getFlightBooking);
router.put('/:id/flight-booking', protect(billingRoles), travelController.updateFlightBooking);
router.delete('/:id/flight-booking', protect(billingRoles), travelController.cancelFlightBooking);


// Dashboard Routes
router.get('/dashboard/overview', protect, travelController.getDashboardOverview);
router.get('/dashboard/stats', protect, travelController.getDashboardStats);
router.get('/dashboard/quick-links', protect, travelController.getDashboardQuickLinks);
router.get('/upcoming', protect, travelController.getUpcomingTrips);
router.get('/recent', protect, travelController.getRecentRequests);






module.exports = router;