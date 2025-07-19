// middleware/usageMiddleware.js
const User = require('../models/User');

// Track API usage
exports.trackApiUsage = async (req, res, next) => {
  const user = await User.findById(req.user._id);
  
  // Check if trial has expired
  if (user.hasTrialExpired()) {
    return res.status(403).json({ 
      message: 'Trial expired. Please upgrade your plan.',
      code: 'TRIAL_EXPIRED'
    });
  }

  // Check API call limit
  if (user.usage.apiCallLimit && user.usage.apiCalls.count >= user.usage.apiCallLimit) {
    return res.status(429).json({ 
      message: 'API call limit exceeded. Please upgrade your plan.',
      code: 'API_LIMIT_EXCEEDED'
    });
  }

  // Increment API call count
  user.usage.apiCalls.count += 1;
  await user.save();

  next();
};

// Check storage limits
exports.checkStorageLimit = async (req, res, next) => {
  const user = await User.findById(req.user._id);
  
  if (user.usage.storage.used >= user.usage.storage.limit) {
    return res.status(403).json({ 
      message: 'Storage limit exceeded. Please upgrade your plan.',
      code: 'STORAGE_LIMIT_EXCEEDED'
    });
  }

  next();
};