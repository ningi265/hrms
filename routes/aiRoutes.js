const express = require('express');
const { protect } = require('../api/middleware/authMiddleware');

// Import individual controller methods
const {
  processMessage,
  getConversationHistory,
  getSuggestions,
  getAIStatus,
  clearConversation
} = require('../api/controllers/aiChatController');

const router = express.Router();

// Allowed roles for AI chat access
const ALLOWED_ROLES = [
  "admin", 
  "procurement_officer", 
  "vendor",
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources",
  "Accounting/Finance",
  "Enterprise(CEO, CFO, etc.)", "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer"
];

// Process AI chat message
router.post('/chat', protect(ALLOWED_ROLES), processMessage);

// Get conversation history (no userId param - uses authenticated user)
router.get('/conversation', protect(ALLOWED_ROLES), getConversationHistory);

// Get personalized suggestions (no userId param - uses authenticated user)
router.get('/suggestions', protect(ALLOWED_ROLES), getSuggestions);

// Check AI service status
router.get('/status', protect(ALLOWED_ROLES), getAIStatus);

// Clear conversation history
router.delete('/conversation', protect(ALLOWED_ROLES), clearConversation);

module.exports = router;