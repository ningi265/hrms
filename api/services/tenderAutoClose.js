const cron = require('node-cron');
const Tenders = require('../../models/tenders');
const mongoose = require('mongoose');

// Function to close expired tenders
const closeExpiredTenders = async () => {
  try {
    const now = new Date();
    
    // Find all open tenders where deadline has passed
    const result = await Tenders.updateMany(
      {
        status: 'open',
        deadline: { $lte: now }
      },
      {
        $set: { 
          status: 'closed',
          closedAt: now
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`[${new Date().toISOString()}] Auto-closed ${result.modifiedCount} expired tenders`);
    }

    return result.modifiedCount;
  } catch (error) {
    console.error('Error closing expired tenders:', error);
    throw error;
  }
};

// Schedule the cron job to run every minute
const startTenderAutoCloseCron = () => {
  // Run every minute: '* * * * *'
  // For production, you might want to run less frequently, like every 5 minutes: '*/5 * * * *'
  cron.schedule('* * * * *', async () => {
    try {
      await closeExpiredTenders();
    } catch (error) {
      console.error('Cron job error:', error);
    }
  });

  console.log('Tender auto-close cron job started');
};

// Manual trigger for testing
const manualCloseExpiredTenders = async () => {
  return await closeExpiredTenders();
};

module.exports = {
  startTenderAutoCloseCron,
  closeExpiredTenders: manualCloseExpiredTenders
};