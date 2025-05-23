const nodemailer = require('nodemailer');
const Notification = require("../../models/notification");
const User = require("../../models/user");



// Nodemailer transport setup for Gmail with App Password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD, // Use app password for Gmail
  },
});

// Send email notification using Nodemailer
const sendEmailNotification = async (userEmail, subject, message) => {
    try {
        await transporter.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_USER}>`,
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
{/*const notifyVendorsAboutRFQ = async (vendorIds, rfq) => {
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
}; */}


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

// Enhanced email notification function for RFQ vendor notifications
const sendRFQNotificationToVendors = async (vendors, rfqData) => {
  try {
    // Create email promises for all vendors
    const emailPromises = vendors.map(vendor => 
      sendRFQEmailToVendor(vendor, rfqData)
    );

    // Send all emails concurrently
    const results = await Promise.allSettled(emailPromises);
    
    // Log results
    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;
    
    console.log(`RFQ Notifications: ${successful} sent successfully, ${failed} failed`);
    
    // Log any failures for debugging
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to send RFQ notification to ${vendors[index].name}:`, result.reason);
      }
    });

    return {
      successful,
      failed,
      total: vendors.length
    };

  } catch (error) {
    console.error("Error sending RFQ notifications:", error);
    throw error;
  }
};

// Individual vendor email notification
const sendRFQEmailToVendor = async (vendor, rfqData) => {
  try {
    const subject = `New RFQ Opportunity: ${rfqData.itemName} - Quote Required`;
    
    // Create detailed email content
    const emailContent = createRFQEmailContent(vendor, rfqData);
    
    await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_USER}>`,
      to: vendor.email,
      subject: subject,
      text: emailContent.text,
      html: emailContent.html
    });

    console.log(`RFQ notification sent to ${vendor.name} (${vendor.email})`);
    return { success: true, vendor: vendor.name };

  } catch (error) {
    console.error(`Failed to send RFQ notification to ${vendor.name}:`, error);
    throw error;
  }
};

// Create comprehensive email content
const createRFQEmailContent = (vendor, rfqData) => {
  const {
    itemName,
    quantity,
    deadline,
    description,
    specifications,
    priority,
    deliveryLocation,
    estimatedBudget,
    procurementOfficer,
    _id: rfqId
  } = rfqData;

  // Format deadline
  const deadlineFormatted = deadline 
    ? new Date(deadline).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'Not specified';

  // Calculate days until deadline
  const daysUntilDeadline = deadline 
    ? Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  // Priority indicator
  const priorityText = priority === 'high' ? '🔴 HIGH PRIORITY' : 
                      priority === 'medium' ? '🟡 MEDIUM PRIORITY' : 
                      '🟢 LOW PRIORITY';

  // Plain text version
  const textContent = `
Dear ${vendor.name},

${priorityText}

We are pleased to invite you to submit a quotation for the following requirement:

RFQ DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Item: ${itemName}
🔢 Quantity: ${quantity}
⏰ Deadline: ${deadlineFormatted}${daysUntilDeadline ? ` (${daysUntilDeadline} days remaining)` : ''}
📍 Delivery Location: ${deliveryLocation || 'To be discussed'}
💰 Estimated Budget: ${estimatedBudget ? `$${estimatedBudget}` : 'Please provide your best quote'}
🎯 Priority Level: ${priority.toUpperCase()}

${description ? `
📋 DESCRIPTION:
${description}
` : ''}

${specifications ? `
🔧 TECHNICAL SPECIFICATIONS:
${specifications}
` : ''}

SUBMISSION REQUIREMENTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please include the following in your quotation:
• Unit price and total cost
• Delivery timeframe
• Payment terms
• Product specifications and compliance certifications
• Warranty information
• Any additional services included

NEXT STEPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Review the requirements carefully
2. Prepare your competitive quotation
3. Submit your quote through our vendor portal
4. Contact us if you have any questions

RFQ ID: ${rfqId}
Procurement Officer: ${procurementOfficer?.name || 'Not specified'}
Contact Email: ${procurementOfficer?.email || process.env.EMAIL_USER}

We value your partnership and look forward to receiving your competitive quotation.

Best regards,
${process.env.EMAIL_FROM_NAME}
Procurement Department

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated message. Please do not reply directly to this email.
For questions, contact: ${procurementOfficer?.email || process.env.EMAIL_USER}
`;

  // HTML version for better formatting
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New RFQ Opportunity</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 800px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
        .priority-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
        .priority-high { background-color: #dc3545; color: white; }
        .priority-medium { background-color: #ffc107; color: #212529; }
        .priority-low { background-color: #28a745; color: white; }
        .content { padding: 30px; }
        .rfq-details { background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .detail-item { margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; color: #667eea; }
        .requirements { background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .steps { background-color: #f1f8e9; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .step { display: flex; align-items: center; margin: 10px 0; }
        .step-number { background-color: #667eea; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-weight: bold; }
        .footer { background-color: #343a40; color: white; padding: 20px; text-align: center; }
        .cta-button { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold; }
        .contact-info { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 New RFQ Opportunity</h1>
            <p>Request for Quotation - ${rfqId}</p>
            <div class="priority-badge priority-${priority}">
                ${priorityText}
            </div>
        </div>
        
        <div class="content">
            <h2>Dear ${vendor.name},</h2>
            <p>We are pleased to invite you to submit a quotation for the following requirement. Your expertise makes you an ideal partner for this opportunity.</p>
            
            <div class="rfq-details">
                <h3>📋 RFQ Details</h3>
                <div class="detail-item">
                    <span class="detail-label">📦 Item:</span> ${itemName}
                </div>
                <div class="detail-item">
                    <span class="detail-label">🔢 Quantity:</span> ${quantity}
                </div>
                <div class="detail-item">
                    <span class="detail-label">⏰ Deadline:</span> ${deadlineFormatted}
                    ${daysUntilDeadline ? `<strong style="color: #dc3545;"> (${daysUntilDeadline} days remaining)</strong>` : ''}
                </div>
                <div class="detail-item">
                    <span class="detail-label">📍 Delivery Location:</span> ${deliveryLocation || 'To be discussed'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">💰 Estimated Budget:</span> ${estimatedBudget ? `$${estimatedBudget}` : 'Please provide your best quote'}
                </div>
                ${description ? `
                <div class="detail-item">
                    <span class="detail-label">📋 Description:</span><br>
                    <div style="margin-top: 10px; padding: 10px; background-color: white; border-radius: 4px;">${description}</div>
                </div>
                ` : ''}
                ${specifications ? `
                <div class="detail-item">
                    <span class="detail-label">🔧 Technical Specifications:</span><br>
                    <div style="margin-top: 10px; padding: 10px; background-color: white; border-radius: 4px;">${specifications}</div>
                </div>
                ` : ''}
            </div>
            
            <div class="requirements">
                <h3>📝 Submission Requirements</h3>
                <p>Please include the following in your quotation:</p>
                <ul>
                    <li>✓ Unit price and total cost breakdown</li>
                    <li>✓ Delivery timeframe and logistics</li>
                    <li>✓ Payment terms and conditions</li>
                    <li>✓ Product specifications and compliance certifications</li>
                    <li>✓ Warranty and support information</li>
                    <li>✓ Any additional services or value-adds included</li>
                </ul>
            </div>
            
            <div class="steps">
                <h3>🚀 Next Steps</h3>
                <div class="step">
                    <div class="step-number">1</div>
                    <div>Review the requirements carefully</div>
                </div>
                <div class="step">
                    <div class="step-number">2</div>
                    <div>Prepare your competitive quotation</div>
                </div>
                <div class="step">
                    <div class="step-number">3</div>
                    <div>Submit your quote through our vendor portal</div>
                </div>
                <div class="step">
                    <div class="step-number">4</div>
                    <div>Contact us if you have any questions</div>
                </div>
            </div>
            
            <center>
                <a href="${process.env.VENDOR_PORTAL_URL || '#'}" class="cta-button">
                    📤 Submit Your Quote Now
                </a>
            </center>
            
            <div class="contact-info">
                <h4>📞 Contact Information</h4>
                <p><strong>RFQ ID:</strong> ${rfqId}</p>
                <p><strong>Procurement Officer:</strong> ${procurementOfficer?.name || 'Not specified'}</p>
                <p><strong>Email:</strong> ${procurementOfficer?.email || process.env.EMAIL_USER}</p>
            </div>
            
            <p><em>We value your partnership and look forward to receiving your competitive quotation.</em></p>
        </div>
        
        <div class="footer">
            <p><strong>${process.env.EMAIL_FROM_NAME}</strong><br>
            Procurement Department</p>
            <p style="font-size: 12px; margin-top: 15px;">
                This is an automated message. Please do not reply directly to this email.<br>
                For questions, contact: ${procurementOfficer?.email || process.env.EMAIL_USER}
            </p>
        </div>
    </div>
</body>
</html>
`;

  return {
    text: textContent.trim(),
    html: htmlContent.trim()
  };
};

// Function to be called from your RFQ controller
const notifyVendorsAboutRFQ = async (vendors, rfqData) => {
  try {
    console.log(`Sending RFQ notifications to ${vendors.length} vendors for: ${rfqData.itemName}`);
    
    const results = await sendRFQNotificationToVendors(vendors, rfqData);
    
    console.log(`RFQ Notification Summary:
      - Total vendors: ${results.total}
      - Successfully notified: ${results.successful}
      - Failed notifications: ${results.failed}
    `);
    
    return results;
  } catch (error) {
    console.error('Error in notifyVendorsAboutRFQ:', error);
    throw error;
  }
};

// Export the main function
module.exports = {
 
};

module.exports = { 
    sendNotifications, 
    notifyVendorsAboutRFQ, 
    notifyInvoicePayment,
    notifyInvoiceApproval,
    notifySelectedVendor,
    notifyInvoiceSubmitted, 
    notifyVendorPOCreated, 
    notifyPOApproval, 
    notifyPOShipped, 
    notifyPOConfirmed,
    notifyPODelivered, 
    notifyVendorsAboutRFQ,
  sendRFQNotificationToVendors,
  sendRFQEmailToVendor
};