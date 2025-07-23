// routes/billingRoutes.js
const express = require('express');
const router = express.Router();
const billingController = require('../api/controllers/billingController');
const {protect} = require('../api/middleware/authMiddleware');

// Define allowed roles for billing operations
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

// Public webhook endpoint (must be before other routes and without auth)
router.post('/webhook', express.raw({type: 'application/json'}), billingController.handleWebhook);

// Get available plans (public endpoint)
router.get('/plans', billingController.getPlans);

// Protected routes requiring specific roles
router.get('/subscription', protect(billingRoles), billingController.getUserSubscription);

// Checkout and subscription management
router.post('/checkout', protect(billingRoles), billingController.createCheckoutSession);
router.post('/create-checkout-session', protect(billingRoles), billingController.createCheckoutSession); // Alternative endpoint name
router.get('/checkout-success', protect(billingRoles), billingController.handleCheckoutSuccess);

// Subscription management
router.post('/cancel', protect(billingRoles), billingController.cancelSubscription);
router.post('/cancel-subscription', protect(billingRoles), billingController.cancelSubscription); // Alternative endpoint name
router.post('/reactivate', protect(billingRoles), billingController.reactivateSubscription);
router.post('/reactivate-subscription', protect(billingRoles), billingController.reactivateSubscription); // Alternative endpoint name

// Billing history and payment methods
router.get('/history', protect(billingRoles), billingController.getBillingHistory);
router.get('/billing-history', protect(billingRoles), billingController.getBillingHistory); // Alternative endpoint name
router.post('/update-payment-method', protect(billingRoles), billingController.updatePaymentMethod);

// Usage tracking
router.get('/usage', protect(billingRoles), (req, res) => {
  // Return user usage data
  res.json(req.user.usage || {
    apiCalls: { count: 0, lastReset: new Date() },
    storage: { used: 0, limit: 100 }
  });
});

module.exports = router;