const cron = require("node-cron");
const sgMail = require("@sendgrid/mail");
const RFQ = require("../../models/RFQ");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Utility: send email via SendGrid
 */
const sendEmail = async (to, subject, html, text) => {
  const msg = {
    to,
    from: {
      name: "NexusMWI Procurement",
      email: "noreply@nexusmwi.com" 
    },
    subject,
    html,
    text
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Email sent to ${to} | Subject: ${subject}`);
  } catch (err) {
    console.error(`❌ Failed to send email to ${to}:`, err.message);
  }
};

/**
 * Send reminder to PO & idle vendors
 */
const sendRFQIdleReminder = async (rfq) => {
  console.log(`📨 Sending idle reminder for RFQ ${rfq._id}`);

  const vendorIdsWithQuotes = rfq.quotes?.map(q => q.vendor?.toString()) || [];
  const idleVendors = rfq.vendors.filter(
    v => !vendorIdsWithQuotes.includes(v._id.toString())
  );

  // Email Procurement Officer
  if (rfq.procurementOfficer?.email) {
    await sendEmail(
      rfq.procurementOfficer.email,
      `Reminder: RFQ "${rfq.itemName}" is idle`,
      `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2>Action Required: Idle RFQ</h2>
          <p>Hello ${rfq.procurementOfficer.firstName || "Procurement Officer"},</p>
          <p>The RFQ <strong>${rfq.itemName}</strong> (Quantity: ${rfq.quantity}) is approaching its deadline of <strong>${new Date(rfq.deadline).toLocaleDateString()}</strong>.</p>
          <p>No vendor quotes have been submitted yet.</p>
        </div>
      `,
      `Your RFQ "${rfq.itemName}" is idle. Deadline: ${new Date(rfq.deadline).toLocaleDateString()}. No vendor quotes received.`
    );
  }

  // Email Idle Vendors
  for (let vendor of idleVendors) {
    await sendEmail(
      vendor.email,
      `Reminder: Submit your quote for RFQ "${rfq.itemName}"`,
      `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2>Reminder to Submit Quote</h2>
          <p>Hello ${vendor.firstName || "Vendor"},</p>
          <p>You were invited to RFQ <strong>${rfq.itemName}</strong> (Quantity: ${rfq.quantity}).</p>
          <p>The deadline is <strong>${new Date(rfq.deadline).toLocaleDateString()}</strong>. Please submit your quote before it expires.</p>
        </div>
      `,
      `Reminder: Please submit your quote for RFQ "${rfq.itemName}" before ${new Date(rfq.deadline).toLocaleDateString()}.`
    );
  }
};

/**
 * Send deadline approaching reminder to vendors who haven't submitted quotes
 */
const sendDeadlineApproachingReminder = async (rfq) => {
  console.log(`📨 Sending deadline approaching reminder for RFQ ${rfq._id}`);

  const vendorIdsWithQuotes = rfq.quotes?.map(q => q.vendor?.toString()) || [];
  const vendorsWithoutQuotes = rfq.vendors.filter(
    v => !vendorIdsWithQuotes.includes(v._id.toString())
  );

  // Email Procurement Officer
  if (rfq.procurementOfficer?.email) {
    let poMessage = "";
    if (rfq.quotes.length === 0) {
      poMessage = "<p>No vendor quotes have been submitted yet.</p>";
    } else if (!rfq.selectedVendor) {
      poMessage = `<p>${rfq.quotes.length} vendor quote(s) have been submitted, but no vendor has been selected yet.</p>`;
    } else {
      poMessage = `<p>${rfq.quotes.length} vendor quote(s) have been submitted and a vendor has been selected.</p>`;
    }

    await sendEmail(
      rfq.procurementOfficer.email,
      `Reminder: RFQ "${rfq.itemName}" closing in 24 hours`,
      `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2>RFQ Closing Soon</h2>
          <p>Hello ${rfq.procurementOfficer.firstName || "Procurement Officer"},</p>
          <p>The RFQ <strong>${rfq.itemName}</strong> (Quantity: ${rfq.quantity}) is closing in 24 hours on <strong>${new Date(rfq.deadline).toLocaleDateString()}</strong>.</p>
          ${poMessage}
          ${!rfq.selectedVendor && rfq.quotes.length > 0 ? '<p>Please remember to select a vendor before the deadline.</p>' : ''}
        </div>
      `,
      `Your RFQ "${rfq.itemName}" is closing in 24 hours. ${rfq.quotes.length} quote(s) received. ${!rfq.selectedVendor && rfq.quotes.length > 0 ? 'Please remember to select a vendor.' : ''}`
    );
  }

  // Email Vendors who haven't submitted quotes
  for (let vendor of vendorsWithoutQuotes) {
    await sendEmail(
      vendor.email,
      `Final Reminder: RFQ "${rfq.itemName}" closing in 24 hours`,
      `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2>Final Reminder: Submit Your Quote</h2>
          <p>Hello ${vendor.firstName || "Vendor"},</p>
          <p>The RFQ <strong>${rfq.itemName}</strong> (Quantity: ${rfq.quantity}) is closing in 24 hours on <strong>${new Date(rfq.deadline).toLocaleDateString()}</strong>.</p>
          <p>You haven't submitted your quote yet. Please submit it before the deadline.</p>
        </div>
      `,
      `Final reminder: RFQ "${rfq.itemName}" is closing in 24 hours. Please submit your quote before the deadline.`
    );
  }
};

/**
 * Send auto-close notification
 */
const sendRFQClosedNotification = async (rfq) => {
  console.log(`❌ Auto-closing RFQ ${rfq._id}`);

  // Notify PO
  if (rfq.procurementOfficer?.email) {
    await sendEmail(
      rfq.procurementOfficer.email,
      `RFQ "${rfq.itemName}" closed automatically`,
      `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2>RFQ Closed</h2>
          <p>Hello ${rfq.procurementOfficer.firstName || "Procurement Officer"},</p>
          <p>Your RFQ <strong>${rfq.itemName}</strong> (Quantity: ${rfq.quantity}) was closed automatically because it expired without any vendor quotes or selections.</p>
        </div>
      `,
      `RFQ "${rfq.itemName}" closed automatically because no quotes were submitted and the deadline passed.`
    );
  }

  // Notify Vendors
  for (let vendor of rfq.vendors) {
    await sendEmail(
      vendor.email,
      `RFQ "${rfq.itemName}" closed`,
      `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2>RFQ Closed</h2>
          <p>Hello ${vendor.firstName || "Vendor"},</p>
          <p>The RFQ <strong>${rfq.itemName}</strong> (Quantity: ${rfq.quantity}) has been closed because it expired without any quotes.</p>
        </div>
      `,
      `The RFQ "${rfq.itemName}" has been closed automatically because it expired without any quotes.`
    );
  }
};

/**
 * Core job logic (can be run manually or from cron)
 */
const runRFQReminderJob = async () => {
  console.log("⏰ Running RFQ reminder & auto-close job...");
  const now = new Date();

  try {
    const rfqs = await RFQ.find({ status: "open" })
      .populate("vendors", "firstName lastName email")
      .populate("procurementOfficer", "firstName lastName email")
      .exec();

    for (let rfq of rfqs) {
      const timeToDeadline = new Date(rfq.deadline) - now;

      // First reminder (24h before deadline, no quotes, no vendor selected)
      if (
        timeToDeadline <= 24 * 60 * 60 * 1000 &&
        timeToDeadline > 0 &&
        rfq.quotes.length === 0 &&
        !rfq.selectedVendor &&
        rfq.remindersSent === 0
      ) {
        await sendRFQIdleReminder(rfq);
        rfq.remindersSent = 1;
        await rfq.save();
      }

      // Deadline approaching reminder (24h before deadline, for all open RFQs)
      if (
        timeToDeadline <= 24 * 60 * 60 * 1000 &&
        timeToDeadline > 0 &&
        rfq.remindersSent < 2
      ) {
        await sendDeadlineApproachingReminder(rfq);
        rfq.remindersSent = 2; // Mark as second reminder sent
        await rfq.save();
      }

      // Auto-close (deadline passed, no quotes, no vendor selected)
      if (
        timeToDeadline <= 0 &&
        rfq.quotes.length === 0 &&
        !rfq.selectedVendor
      ) {
        rfq.status = "closed";
        rfq.closedAt = now;
        await rfq.save();
        await sendRFQClosedNotification(rfq);
      }
      
      // Auto-close (deadline passed, quotes received but no vendor selected within 48h)
      if (
        timeToDeadline <= 0 &&
        rfq.quotes.length > 0 &&
        !rfq.selectedVendor &&
        (!rfq.closedAt || (now - rfq.closedAt) >= 48 * 60 * 60 * 1000)
      ) {
        rfq.status = "closed";
        rfq.closedAt = now;
        await rfq.save();
        await sendRFQClosedNotification(rfq);
      }
    }
  } catch (err) {
    console.error("❌ Error in RFQ reminder job:", err.message);
  }
};

/**
 * Start cron schedule (every hour in production, every minute in dev/test)
 */
const startRFQReminderJob = () => {
  const schedule = "0 * * * *";
  cron.schedule(schedule, runRFQReminderJob);
  console.log(`📌 RFQ reminder job scheduled (${schedule})`);
};

module.exports = { startRFQReminderJob, runRFQReminderJob };