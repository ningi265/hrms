// middleware/usageMonitoringMiddleware.js
const User = require('../../models/user');

// Track purchase order creation
exports.trackPurchaseOrderCreation = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is on trial and trial has expired
    if (user.hasTrialExpired()) {
      return res.status(403).json({ 
        message: 'Trial expired. Please upgrade your plan.',
        code: 'TRIAL_EXPIRED'
      });
    }

    // Initialize usage tracking if not exists
    if (!user.usage.purchaseOrders) {
      user.usage.purchaseOrders = {
        count: 0,
        lastReset: new Date(),
        limit: getPOLimitForPlan(user.billing.subscription.plan)
      };
    }

    // Check if monthly limit is reached
    if (user.usage.purchaseOrders.count >= user.usage.purchaseOrders.limit) {
      return res.status(429).json({ 
        message: 'Purchase order limit exceeded for your plan.',
        code: 'PO_LIMIT_EXCEEDED',
        limit: user.usage.purchaseOrders.limit,
        currentUsage: user.usage.purchaseOrders.count
      });
    }

    // Attach usage data to request for later increment
    req.usageData = {
      userId: user._id,
      incrementPO: true
    };

    next();
  } catch (error) {
    console.error('Error tracking purchase order:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Track API usage with enhanced limits
exports.trackApiUsage = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize API usage tracking if not exists
    if (!user.usage.apiCalls) {
      user.usage.apiCalls = {
        count: 0,
        lastReset: new Date(),
        limit: getApiCallLimitForPlan(user.billing.subscription.plan)
      };
    }

    // Check if monthly limit is reached
    if (user.usage.apiCalls.count >= user.usage.apiCalls.limit) {
      return res.status(429).json({ 
        message: 'API call limit exceeded for your plan.',
        code: 'API_LIMIT_EXCEEDED',
        limit: user.usage.apiCalls.limit,
        currentUsage: user.usage.apiCalls.count
      });
    }

    // Attach usage data to request for later increment
    req.usageData = {
      userId: user._id,
      incrementApi: true
    };

    next();
  } catch (error) {
    console.error('Error tracking API usage:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Track storage usage
exports.trackStorageUsage = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize storage tracking if not exists
    if (!user.usage.storage) {
      user.usage.storage = {
        used: 0,
        limit: getStorageLimitForPlan(user.billing.subscription.plan)
      };
    }

    // Check file size from request (assuming it's available)
    const fileSize = req.file?.size || 0; // in bytes
    const fileSizeMB = fileSize / (1024 * 1024); // convert to MB

    // Check if storage limit would be exceeded
    if (user.usage.storage.used + fileSizeMB > user.usage.storage.limit) {
      return res.status(403).json({ 
        message: 'Storage limit would be exceeded with this upload.',
        code: 'STORAGE_LIMIT_EXCEEDED',
        limit: user.usage.storage.limit,
        currentUsage: user.usage.storage.used,
        required: fileSizeMB
      });
    }

    // Attach usage data to request for later increment
    req.usageData = {
      userId: user._id,
      incrementStorage: fileSizeMB
    };

    next();
  } catch (error) {
    console.error('Error tracking storage usage:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Helper functions to get plan limits
function getPOLimitForPlan(planName) {
  const limits = {
    trial: 10, // Trial users get 10 POs
    starter: 50, // Starter plan: 50 POs/month
    professional: 1000, // Professional plan: 1000 POs/month (effectively unlimited)
    enterprise: 100000 // Enterprise: effectively unlimited
  };
  return limits[planName] || 0;
}

function getApiCallLimitForPlan(planName) {
  const limits = {
    trial: 1000,
    starter: 10000,
    professional: 100000,
    enterprise: 1000000
  };
  return limits[planName] || 1000;
}

function getStorageLimitForPlan(planName) {
  const limits = {
    trial: 100, // 100MB
    starter: 1000, // 1GB
    professional: 10000, // 10GB
    enterprise: 100000 // 100GB
  };
  return limits[planName] || 100;
}