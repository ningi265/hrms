// routes/billingRoutes.js
const express = require('express');
const router = express.Router();
const billingController = require('../api/controllers/billingController');
const {protect} = require('../api/middleware/authMiddleware');

// Get available plans
router.get('/plans', billingController.getPlans);

// Create checkout session
router.post('/checkout', protect([ 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources","Enterprise(CEO, CFO, etc.)"
]), billingController.createCheckoutSession);

// Get user subscription info
router.get('/subscription', protect([ 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources","Enterprise(CEO, CFO, etc.)"
]), billingController.getUserSubscription);

// Cancel subscription
router.post('/cancel', protect([ 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources","Enterprise(CEO, CFO, etc.)"
]), billingController.cancelSubscription);

// Reactivate subscription
router.post('/reactivate', protect([ 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources","Enterprise(CEO, CFO, etc.)"
]), billingController.reactivateSubscription);

// Stripe webhook handler
router.post('/webhook', express.raw({type: 'application/json'}), billingController.handleWebhook);

module.exports = router;