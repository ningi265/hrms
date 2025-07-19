// middleware/subscriptionMiddleware.js
const User = require('../models/User');

// Check if user has active subscription or trial
exports.requireActiveSubscription = async (req, res, next) => {
  const user = await User.findById(req.user._id);
  
  if (user.isOnTrial()) {
    return next();
  }

  if (user.billing.subscription.status !== 'active') {
    return res.status(403).json({ 
      message: 'Subscription required',
      code: 'SUBSCRIPTION_REQUIRED'
    });
  }

  next();
};

// Check if user has specific plan or higher
exports.requirePlan = (requiredPlan) => {
  const planOrder = {
    'trial': 0,
    'starter': 1,
    'professional': 2,
    'enterprise': 3
  };

  return async (req, res, next) => {
    const user = await User.findById(req.user._id);
    const userPlan = user.billing.subscription.plan;
    
    if (planOrder[userPlan] >= planOrder[requiredPlan]) {
      return next();
    }

    res.status(403).json({ 
      message: `Plan upgrade required (${requiredPlan} or higher)`,
      code: 'PLAN_UPGRADE_REQUIRED'
    });
  };
};