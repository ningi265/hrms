const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const Notification = require("../../models/notification");
const User = require("../../models/user");

// Set up OAuth2 client
const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

// Create reusable transporter object
async function createTransporter() {
  const accessToken = await oAuth2Client.getAccessToken();

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_ADDRESS,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      accessToken: accessToken.token
    }
  });
}

// Send email notification using Nodemailer
const sendEmailNotification = async (userEmail, subject, message) => {
    try {
        const transporter = await createTransporter();
        await transporter.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.GMAIL_ADDRESS}>`,
            to: userEmail,
            subject: subject,
            text: message,
            // You could also add html: '<p>HTML version</p>' if needed
        });
        console.log(`Email sent to ${userEmail}`); 
    } catch (error) {
        console.error("Nodemailer email sending error:", error);
    }
};

// Create in-app notification
const createInAppNotification = async (userId, message) => {
    try {
        await Notification.create({ user: userId, message });
    } catch (error) {
        console.error("In-app notification error:", error);
    }
};

// Send RFQ invitation notification to vendors
const notifyVendorsAboutRFQ = async (vendorIds, rfq) => {
    try {
        const vendors = await User.find({ _id: { $in: vendorIds }, role: "vendor" });

        for (const vendor of vendors) {
            const message = `You have been invited to submit a quote for RFQ: ${rfq.itemName}. Quantity: ${rfq.quantity}.`;
            await sendEmailNotification(vendor.email, "New RFQ Invitation", message);
            await createInAppNotification(vendor._id, message);
        }
    } catch (error) {
        console.error("RFQ Invitation Notification Error:", error);
    }
};

// Notify selected vendor
const notifySelectedVendor = async (vendorId, rfq) => {
    try {
        const vendor = await User.findById(vendorId);
        if (!vendor) return;

        const message = `Congratulations! Your quote has been selected for RFQ: ${rfq.itemName}.`;
        await sendEmailNotification(vendor.email, "RFQ Selection", message);
        await createInAppNotification(vendor._id, message);
    } catch (error) {
        console.error("Vendor Selection Notification Error:", error);
    }
};

// Send notifications (both email & in-app)
const sendNotifications = async (userId, subject, message) => {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        await sendEmailNotification(user.email, subject, message);
        await createInAppNotification(userId, message);
    } catch (error) {
        console.error("Notification error:", error);
    }
};

const notifyVendorPOCreated = async (vendorId, po) => {
    try {
        const vendor = await User.findById(vendorId);
        if (!vendor) return;

        const message = `A new Purchase Order (#${po._id}) has been created for ${po.items.length} items.`;
        await sendEmailNotification(vendor.email, "New Purchase Order", message);
        await createInAppNotification(vendor._id, message);
    } catch (error) {
        console.error("Vendor PO Notification Error:", error);
    }
};

const notifyPOApproval = async (procurementOfficerId, vendorId, po) => {
    try {
        const procurementOfficer = await User.findById(procurementOfficerId);
        const vendor = await User.findById(vendorId);
        if (!procurementOfficer || !vendor) return;

        const message = `Purchase Order (#${po._id}) has been approved.`;
        await sendEmailNotification(procurementOfficer.email, "Purchase Order Approved", message);
        await createInAppNotification(procurementOfficer._id, message);

        await sendEmailNotification(vendor.email, "Purchase Order Approved", message);
        await createInAppNotification(vendor._id, message);
    } catch (error) {
        console.error("PO Approval Notification Error:", error);
    }
};

const notifyPOShipped = async (procurementOfficerId, po) => {
    try {
        const officer = await User.findById(procurementOfficerId);
        if (!officer) return;

        const message = `Purchase Order (#${po._id}) has been shipped.`;
        await sendEmailNotification(officer.email, "PO Shipped", message);
        await createInAppNotification(officer._id, message);
    } catch (error) {
        console.error("PO Shipped Notification Error:", error);
    }
};

const notifyPODelivered = async (procurementOfficerId, po) => {
    try {
        const officer = await User.findById(procurementOfficerId);
        if (!officer) return;

        const message = `Purchase Order (#${po._id}) has been delivered.`;
        await sendEmailNotification(officer.email, "PO Delivered", message);
        await createInAppNotification(officer._id, message);
    } catch (error) {
        console.error("PO Delivered Notification Error:", error);
    }
};

const notifyPOConfirmed = async (vendorId, po) => {
    try {
        const vendor = await User.findById(vendorId);
        if (!vendor) return;

        const message = `Purchase Order (#${po._id}) has been confirmed by the procurement officer.`;
        await sendEmailNotification(vendor.email, "PO Confirmed", message);
        await createInAppNotification(vendor._id, message);
    } catch (error) {
        console.error("PO Confirmation Notification Error:", error);
    }
};

const notifyInvoiceSubmitted = async (procurementOfficerId, invoice) => {
    try {
        const officer = await User.findById(procurementOfficerId);
        if (!officer) return;

        const message = `An invoice (#${invoice.invoiceNumber}) has been submitted for approval.`;
        await sendEmailNotification(officer.email, "Invoice Submitted", message);
        await createInAppNotification(officer._id, message);
    } catch (error) {
        console.error("Invoice Submission Notification Error:", error);
    }
};

const notifyInvoiceApproval = async (vendorId, invoice) => {
    try {
        const vendor = await User.findById(vendorId);
        if (!vendor) return;

        const message = `Your invoice (#${invoice.invoiceNumber}) has been approved.`;
        await sendEmailNotification(vendor.email, "Invoice Approved", message);
        await createInAppNotification(vendor._id, message);
    } catch (error) {
        console.error("Invoice Approval Notification Error:", error);
    }
};

const notifyInvoicePayment = async (vendorId, invoice) => {
    try {
        const vendor = await User.findById(vendorId);
        if (!vendor) return;

        const message = `Your invoice (#${invoice.invoiceNumber}) has been paid.`;
        await sendEmailNotification(vendor.email, "Invoice Paid", message);
        await createInAppNotification(vendor._id, message);
    } catch (error) {
        console.error("Invoice Payment Notification Error:", error);
    }
};



module.exports = { sendNotifications, notifyVendorsAboutRFQ, notifyInvoicePayment,notifyInvoiceApproval,notifySelectedVendor,notifyInvoiceSubmitted, notifyVendorPOCreated, notifyPOApproval, notifyPOShipped, notifyPOConfirmed,notifyPODelivered};
