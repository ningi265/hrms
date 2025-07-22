// utils/usageUtils.js
const UsageService = require('../api/services/usageService');

// Middleware to update usage after successful request
exports.updateUsageAfterResponse = async (req, res, next) => {
  // Only proceed if the response was successful (2xx status)
  if (res.statusCode >= 200 && res.statusCode < 300 && req.usageData) {
    try {
      await UsageService.updateUsage(req.usageData.userId, req.usageData);
    } catch (error) {
      console.error('Error updating usage after response:', error);
      // Don't fail the request, just log the error
    }
  }
  
  // For file uploads, we might want to clean up if storage update fails
  if (res.statusCode >= 400 && req.file && req.file.path) {
    // Clean up the uploaded file if the request failed
    try {
      const fs = require('fs');
      fs.unlinkSync(req.file.path);
    } catch (error) {
      console.error('Error cleaning up failed upload:', error);
    }
  }
  
  next();
};

// Schedule monthly usage reset
exports.scheduleMonthlyReset = () => {
  const cron = require('node-cron');
  
  // Run at midnight on the first day of every month
  cron.schedule('0 0 1 * *', async () => {
    console.log('Running scheduled monthly usage reset...');
    await UsageService.resetMonthlyUsage();
  });
  
  console.log('Scheduled monthly usage reset job initialized');
};