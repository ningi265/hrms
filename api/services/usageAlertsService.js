// services/usageAlertService.js
const User = require('../../models/user');
const nodemailer = require('nodemailer');
const { getPOLimitForPlan, getApiCallLimitForPlan, getStorageLimitForPlan } = require('./usageService');

class UsageAlertService {
  static transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  // Check all users for usage nearing limits
  static async checkUsageLimits() {
    try {
      const users = await User.find({
        $or: [
          { 'usage.purchaseOrders.count': { $gt: 0 } },
          { 'usage.apiCalls.count': { $gt: 0 } },
          { 'usage.storage.used': { $gt: 0 } }
        ]
      });

      for (const user of users) {
        const usage = {
          plan: user.billing.subscription.plan,
          purchaseOrders: {
            count: user.usage.purchaseOrders?.count || 0,
            limit: getPOLimitForPlan(user.billing.subscription.plan)
          },
          apiCalls: {
            count: user.usage.apiCalls?.count || 0,
            limit: getApiCallLimitForPlan(user.billing.subscription.plan)
          },
          storage: {
            used: user.usage.storage?.used || 0,
            limit: getStorageLimitForPlan(user.billing.subscription.plan)
          }
        };

        const alerts = [];
        
        // Check PO usage
        const poPercentage = (usage.purchaseOrders.count / usage.purchaseOrders.limit) * 100;
        if (poPercentage > 80) {
          alerts.push({
            type: 'purchaseOrders',
            percentage: poPercentage,
            current: usage.purchaseOrders.count,
            limit: usage.purchaseOrders.limit
          });
        }

        // Check API usage
        const apiPercentage = (usage.apiCalls.count / usage.apiCalls.limit) * 100;
        if (apiPercentage > 80) {
          alerts.push({
            type: 'apiCalls',
            percentage: apiPercentage,
            current: usage.apiCalls.count,
            limit: usage.apiCalls.limit
          });
        }

        // Check storage usage
        const storagePercentage = (usage.storage.used / usage.storage.limit) * 100;
        if (storagePercentage > 80) {
          alerts.push({
            type: 'storage',
            percentage: storagePercentage,
            current: usage.storage.used,
            limit: usage.storage.limit
          });
        }

        // Send alerts if any
        if (alerts.length > 0) {
          await this.sendUsageAlert(user, alerts);
        }
      }

      console.log('Usage limit check completed');
      return true;
    } catch (error) {
      console.error('Error checking usage limits:', error);
      return false;
    }
  }

  // Send email alert to user
  static async sendUsageAlert(user, alerts) {
    try {
      const alertItems = alerts.map(alert => {
        return `
          <li>
            <strong>${alert.type.replace(/([A-Z])/g, ' $1').trim()}:</strong>
            ${alert.current} of ${alert.limit} (${Math.round(alert.percentage)}% used)
          </li>
        `;
      }).join('');

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: 'Usage Alert: You\'re approaching your plan limits',
        html: `
          <h2>Usage Alert</h2>
          <p>Dear ${user.firstName},</p>
          <p>You're approaching the usage limits of your ${user.billing.subscription.plan} plan:</p>
          <ul>${alertItems}</ul>
          <p>Consider upgrading your plan to avoid service interruptions.</p>
          <a href="${process.env.FRONTEND_URL}/billing" style="display: inline-block; background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px;">
            Upgrade Your Plan
          </a>
          <p style="margin-top: 20px;">Best regards,<br>Your Procurement Team</p>
        `
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Usage alert sent to ${user.email}`);
      return true;
    } catch (error) {
      console.error('Error sending usage alert:', error);
      return false;
    }
  }
}

// Schedule daily usage alerts
const scheduleUsageAlerts = () => {
  const cron = require('node-cron');
  
  // Run at 9 AM every day
  cron.schedule('0 9 * * *', async () => {
    console.log('Running daily usage limit checks...');
    await UsageAlertService.checkUsageLimits();
  });
  
  console.log('Scheduled daily usage alerts job initialized');
};

module.exports = { UsageAlertService, scheduleUsageAlerts };