// services/usageService.js
const User = require('../../models/user');

class UsageService {
  // Update usage after successful operation
  static async updateUsage(userId, updateData) {
    try {
      const updates = {};
      
      if (updateData.incrementPO) {
        updates['$inc'] = { 'usage.purchaseOrders.count': 1 };
      }
      
      if (updateData.incrementApi) {
        updates['$inc'] = { 
          ...(updates['$inc'] || {}),
          'usage.apiCalls.count': 1 
        };
      }
      
      if (updateData.incrementStorage) {
        updates['$inc'] = { 
          ...(updates['$inc'] || {}),
          'usage.storage.used': updateData.incrementStorage 
        };
      }
      
      if (Object.keys(updates).length > 0) {
        await User.findByIdAndUpdate(userId, updates);
      }
      
      return true;
    } catch (error) {
      console.error('Error updating usage:', error);
      return false;
    }
  }

  // Reset monthly usage (to be called by a scheduled job)
  static async resetMonthlyUsage() {
    try {
      await User.updateMany({}, {
        $set: {
          'usage.purchaseOrders.count': 0,
          'usage.apiCalls.count': 0,
          'usage.purchaseOrders.lastReset': new Date(),
          'usage.apiCalls.lastReset': new Date()
        }
      });
      console.log('Monthly usage reset completed');
      return true;
    } catch (error) {
      console.error('Error resetting monthly usage:', error);
      return false;
    }
  }

  // Get current usage for a user
  static async getUserUsage(userId) {
    try {
      const user = await User.findById(userId)
        .select('usage billing.subscription.plan');
      
      if (!user) {
        return null;
      }

      return {
        plan: user.billing.subscription.plan,
        purchaseOrders: {
          count: user.usage.purchaseOrders?.count || 0,
          limit: getPOLimitForPlan(user.billing.subscription.plan),
          lastReset: user.usage.purchaseOrders?.lastReset || new Date()
        },
        apiCalls: {
          count: user.usage.apiCalls?.count || 0,
          limit: getApiCallLimitForPlan(user.billing.subscription.plan),
          lastReset: user.usage.apiCalls?.lastReset || new Date()
        },
        storage: {
          used: user.usage.storage?.used || 0,
          limit: getStorageLimitForPlan(user.billing.subscription.plan)
        }
      };
    } catch (error) {
      console.error('Error getting user usage:', error);
      return null;
    }
  }
}

// Helper functions (same as in middleware)
function getPOLimitForPlan(planName) {
  const limits = {
    trial: 10,
    starter: 50,
    professional: 1000,
    enterprise: 100000
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
    trial: 100,
    starter: 1000,
    professional: 10000,
    enterprise: 100000
  };
  return limits[planName] || 100;
}

module.exports = UsageService;