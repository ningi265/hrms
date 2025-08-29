// middleware/usageMiddleware.js
const User = require('../../models/user');


// Track API usage for all endpoints
exports.trackApiUsage = async (req, res, next) => {
  console.log(`[Usage Middleware] Tracking API call to: ${req.method} ${req.originalUrl}`);
  
  try {
    if (!req.user || !req.user._id) {
      console.log('[Usage Middleware] User not authenticated, skipping tracking');
      return next();
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      console.log('[Usage Middleware] User not found in database');
      return next();
    }
    
    console.log(`[Usage Middleware] Found user: ${user.email}`);

     const planLimits = {
      trial: 20,
      starter: 50,
      professional: 1000,
      enterprise: Infinity
    };

    const plan = user.billing?.subscription?.plan || 'trial';
    user.usage.apiCallLimit = planLimits[plan];

    if (user.hasTrialExpired && user.hasTrialExpired()) {
      console.warn(`[Usage Middleware] Trial expired for user: ${user.email}`);
      return res.status(403).json({ 
        message: 'Trial expired. Please upgrade your plan.',
        code: 'TRIAL_EXPIRED'
      });
    }

    if (!user.usage) {
      console.log(`[Usage Middleware] Initializing usage tracking for user: ${user.email}`);
      user.usage = {
        apiCalls: {
          count: 0,
          byEndpoint: {},
          byMethod: {},
          lastUpdated: new Date()
        },
        storage: {
          used: 0,
          limit: user.subscription && user.subscription.plan === 'professional' ? 1000 : 100
        }
      };
    }

    if (!user.usage.apiCalls) {
      user.usage.apiCalls = {
        count: 0,
        byEndpoint: {},
        byMethod: {},
        lastUpdated: new Date()
      };
    }

    if (typeof user.usage.apiCalls.count !== 'number' || isNaN(user.usage.apiCalls.count)) {
      console.log(`[Usage Middleware] Fixing total counter (was: ${user.usage.apiCalls.count})`);
      user.usage.apiCalls.count = 0;
    }

    if (!user.usage.apiCalls.byEndpoint) {
      user.usage.apiCalls.byEndpoint = {};
    }
    if (!user.usage.apiCalls.byMethod) {
      user.usage.apiCalls.byMethod = {};
    }

    // ✅ FIXED: Track full baseUrl + route path
let endpointPath = (req.baseUrl + (req.route?.path || ''))
  .replace(/\/:[^/]+/g, '/:id') || 'unknown_endpoint';


if (endpointPath.length > 1 && endpointPath.endsWith('/')) {
  endpointPath = endpointPath.slice(0, -1);
}


    const method = req.method;

    console.log(`[Usage Middleware] Tracking endpoint: ${endpointPath}, Method: ${method}`);

    user.usage.apiCalls.count = (user.usage.apiCalls.count || 0) + 1;
 user.usage.apiCalls.byEndpoint.set(
  endpointPath,
  (user.usage.apiCalls.byEndpoint.get(endpointPath) || 0) + 1
);

user.usage.apiCalls.byMethod.set(
  method,
  (user.usage.apiCalls.byMethod.get(method) || 0) + 1
);

    user.usage.apiCalls.lastUpdated = new Date();

  console.log(
  `[Usage Middleware] Updated counters - Total: ${user.usage.apiCalls.count}, ${endpointPath}: ${user.usage.apiCalls.byEndpoint.get(endpointPath)}, ${method}: ${user.usage.apiCalls.byMethod.get(method)}`
);

    if (user.usage.apiCallLimit && user.usage.apiCalls.count >= user.usage.apiCallLimit) {
      console.warn(`[Usage Middleware] API limit exceeded for user: ${user.email}`);
      return res.status(429).json({ 
        message: 'API call limit exceeded. Please upgrade your plan.',
        code: 'API_LIMIT_EXCEEDED',
        usage: user.usage
      });
    }

    await user.save();
    console.log(`[Usage Middleware] Saved updated usage for user: ${user.email}`);

   res.locals.usage = {
  remaining: user.usage.apiCallLimit 
    ? user.usage.apiCallLimit - user.usage.apiCalls.count 
    : 'unlimited',
  total: user.usage.apiCalls.count,
  byEndpoint: Object.fromEntries(user.usage.apiCalls.byEndpoint),
  byMethod: Object.fromEntries(user.usage.apiCalls.byMethod)
};


    console.log(`[Usage Middleware] Usage attached to response - Remaining: ${res.locals.usage.remaining}`);
    next();
  } catch (error) {
    console.error('[Usage Middleware] Error tracking API usage:', error.message, error.stack);
    next();
  }
};




// Enhanced storage limit checker
exports.checkStorageLimit = async (req, res, next) => {
  console.log(`[Storage Middleware] Checking storage for request to: ${req.method} ${req.originalUrl}`);
  
  try {
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      console.log('[Storage Middleware] User not authenticated, skipping storage check');
      return next();
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      console.log('[Storage Middleware] User not found in database');
      return next();
    }
    
    console.log(`[Storage Middleware] Found user: ${user.email}`);
    
    if (!user.usage) {
      console.log(`[Storage Middleware] Initializing usage tracking for user: ${user.email}`);
      user.usage = {
        storage: {
          used: 0,
          limit: user.subscription && user.subscription.plan === 'professional' ? 1000 : 100
        }
      };
    }

    if (!user.usage.storage) {
      console.log(`[Storage Middleware] Initializing storage tracking for user: ${user.email}`);
      user.usage.storage = {
        used: 0,
        limit: user.subscription && user.subscription.plan === 'professional' ? 1000 : 100
      };
    }

    // Calculate storage usage
    const fileSize = req.file?.size || 0;
    const newUsage = user.usage.storage.used + fileSize;
    console.log(`[Storage Middleware] Current storage: ${user.usage.storage.used}/${user.usage.storage.limit}MB, File size: ${fileSize}MB`);

    if (newUsage >= user.usage.storage.limit) {
      console.warn(`[Storage Middleware] Storage limit exceeded for user: ${user.email}`);
      return res.status(403).json({ 
        message: 'Storage limit exceeded. Please upgrade your plan.',
        code: 'STORAGE_LIMIT_EXCEEDED',
        usage: {
          used: user.usage.storage.used,
          limit: user.usage.storage.limit,
          remaining: user.usage.storage.limit - user.usage.storage.used
        }
      });
    }

    // Update storage usage if this is a file upload request
    if (fileSize > 0) {
      user.usage.storage.used = newUsage;
      await user.save();
      console.log(`[Storage Middleware] Updated storage usage to: ${user.usage.storage.used}MB for user: ${user.email}`);
    }

    next();
  } catch (error) {
    console.error('[Storage Middleware] Error checking storage limit:', error.message, error.stack);
    next();
  }
};

// Get usage summary
exports.getUsageSummary = async (req, res) => {
  console.log(`[Usage Summary] Requested by user: ${req.user?.email || 'unknown'}`);
  
  try {
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      console.log('[Usage Summary] User not authenticated');
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      console.log('[Usage Summary] User not found in database');
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!user.usage) {
      console.log(`[Usage Summary] No usage data found for user: ${user.email}`);
      return res.status(200).json({
        message: 'No usage data available',
        usage: null
      });
    }

    // Initialize apiCalls if not exists (ADDED SAFETY)
    if (!user.usage.apiCalls) {
      user.usage.apiCalls = {
        count: 0,
        byEndpoint: {},
        byMethod: {},
        lastUpdated: new Date()
      };
    }

    const summary = {
      apiUsage: {
        total: user.usage.apiCalls.count || 0,
        byEndpoint: user.usage.apiCalls.byEndpoint || {},
        byMethod: user.usage.apiCalls.byMethod || {},
        lastUpdated: user.usage.apiCalls.lastUpdated || null
      },
      storageUsage: {
        used: user.usage.storage?.used || 0,
        limit: user.usage.storage?.limit || 0,
        remaining: (user.usage.storage?.limit || 0) - (user.usage.storage?.used || 0)
      },
      limits: {
        apiCalls: user.usage.apiCallLimit,
        storage: user.usage.storage?.limit || 0
      }
    };

    console.log(`[Usage Summary] Returning data for user: ${user.email}`);
    res.status(200).json(summary);
  } catch (error) {
    console.error('[Usage Summary] Error generating summary:', error.message, error.stack);
    res.status(500).json({ message: 'Failed to get usage summary' });
  }
};