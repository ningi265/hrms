// controllers/usageController.js
const UsageService = require('../services/usageService');

exports.getUsage = async (req, res) => {
  try {
    const usage = await UsageService.getUserUsage(req.user._id);
    
    if (!usage) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(usage);
  } catch (error) {
    console.error('Error getting usage:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.resetUsage = async (req, res) => {
  try {
    // This endpoint should be protected and only accessible by admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const success = await UsageService.resetMonthlyUsage();
    
    if (success) {
      res.json({ message: 'Usage reset successfully' });
    } else {
      res.status(500).json({ message: 'Failed to reset usage' });
    }
  } catch (error) {
    console.error('Error resetting usage:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};