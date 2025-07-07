const Notification = require("../../models/notification");
const User = require("../../models/user");

// SendGrid setup (replacing Nodemailer)
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Send email notification using SendGrid
const sendEmailNotification = async (userEmail, subject, message, isHtml = true) => {
    try {
        // Detect if message contains HTML tags
        const containsHtml = /<[a-z][\s\S]*>/i.test(message);
        
        const msg = {
            to: userEmail,
            from: {
                name: process.env.EMAIL_FROM_NAME || 'NexusMWI',
                email: process.env.SENDGRID_FROM_EMAIL || 'noreply@nexusmwi.com' // Must be verified in SendGrid
            },
            subject: subject,
        };

        if (isHtml || containsHtml) {
            // Send as HTML email
            msg.html = message;
            // Also provide a plain text version for better compatibility
            msg.text = message.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        } else {
            // Send as plain text
            msg.text = message;
        }

        const [response] = await sgMail.send(msg);
        console.log(`SendGrid email sent to ${userEmail} (${isHtml || containsHtml ? 'HTML' : 'Text'} format)`);
        return response;
    } catch (error) {
        console.error("SendGrid email sending error:", error);
        if (error.response) {
            console.error('SendGrid Error details:', {
                statusCode: error.response.statusCode,
                body: error.response.body
            });
        }
        throw error; // Re-throw so we can handle it in the calling function
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

// Enhanced email content creators for different notification types

// Create selected vendor email content
const createSelectedVendorEmailContent = (vendor, rfq) => {
    const textContent = `
🎉 CONGRATULATIONS! YOUR QUOTE HAS BEEN SELECTED 🎉

Dear ${vendor.firstName} ${vendor.lastName},

We are delighted to inform you that your quotation has been selected for the following RFQ:

SELECTED RFQ DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Item: ${rfq.itemName}
🔢 Quantity: ${rfq.quantity}
🆔 RFQ ID: ${rfq._id}
⭐ Status: SELECTED - WINNER

NEXT STEPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. You will receive a Purchase Order within 2-3 business days
2. Please prepare for order fulfillment as per your quoted specifications
3. Our procurement team will contact you with delivery arrangements
4. Ensure all compliance documents are ready for submission

WHAT THIS MEANS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Your quote was the winning bid
✓ Contract award is being processed
✓ Payment terms as per your quotation will be honored
✓ This strengthens our partnership for future opportunities

Thank you for your competitive pricing and commitment to quality. We look forward to a successful delivery and continued partnership.

Best regards,
${process.env.EMAIL_FROM_NAME || 'NexusMWI'} Procurement Team

For questions, contact: ${process.env.SENDGRID_FROM_EMAIL}
`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Congratulations - Quote Selected!</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 800px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 40px; text-align: center; }
        .header h1 { margin: 0; font-size: 32px; font-weight: 300; }
        .celebration { font-size: 48px; margin: 20px 0; }
        .content { padding: 40px; }
        .winner-badge { background: linear-gradient(135deg, #ffd700 0%, #ffed4a 100%); color: #333; padding: 15px 30px; border-radius: 25px; display: inline-block; font-weight: bold; margin: 20px 0; box-shadow: 0 4px 8px rgba(255,215,0,0.3); }
        .rfq-details { background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 25px; margin: 25px 0; border-radius: 8px; }
        .detail-item { margin: 12px 0; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; color: #28a745; }
        .next-steps { background-color: #e8f5e8; padding: 25px; border-radius: 8px; margin: 25px 0; }
        .step { display: flex; align-items: center; margin: 15px 0; }
        .step-number { background-color: #28a745; color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 20px; font-weight: bold; }
        .benefits { background-color: #fff3cd; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107; }
        .benefit-item { margin: 10px 0; display: flex; align-items: center; }
        .checkmark { color: #28a745; font-weight: bold; margin-right: 10px; font-size: 18px; }
        .footer { background-color: #343a40; color: white; padding: 30px; text-align: center; }
        .cta-button { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="celebration">🎉 🏆 🎉</div>
            <h1>Congratulations!</h1>
            <p style="font-size: 18px; margin: 20px 0;">Your Quote Has Been Selected</p>
            <div class="winner-badge">🏆 WINNING VENDOR 🏆</div>
        </div>
        
        <div class="content">
            <h2>Dear ${vendor.firstName} ${vendor.lastName},</h2>
            <p style="font-size: 18px; color: #28a745; font-weight: 500;">We are delighted to inform you that your quotation has been selected! Your competitive pricing and quality proposal made you our preferred partner.</p>
            
            <div class="rfq-details">
                <h3>🎯 Selected RFQ Details</h3>
                <div class="detail-item">
                    <span class="detail-label">📦 Item:</span> ${rfq.itemName}
                </div>
                <div class="detail-item">
                    <span class="detail-label">🔢 Quantity:</span> ${rfq.quantity}
                </div>
                <div class="detail-item">
                    <span class="detail-label">🆔 RFQ ID:</span> ${rfq._id}
                </div>
                <div class="detail-item">
                    <span class="detail-label">⭐ Status:</span> <strong style="color: #28a745;">SELECTED - WINNER</strong>
                </div>
            </div>
            
            <div class="next-steps">
                <h3>🚀 Next Steps</h3>
                <div class="step">
                    <div class="step-number">1</div>
                    <div>You will receive a Purchase Order within 2-3 business days</div>
                </div>
                <div class="step">
                    <div class="step-number">2</div>
                    <div>Please prepare for order fulfillment as per your quoted specifications</div>
                </div>
                <div class="step">
                    <div class="step-number">3</div>
                    <div>Our procurement team will contact you with delivery arrangements</div>
                </div>
                <div class="step">
                    <div class="step-number">4</div>
                    <div>Ensure all compliance documents are ready for submission</div>
                </div>
            </div>
            
            <div class="benefits">
                <h3>🌟 What This Means for You</h3>
                <div class="benefit-item">
                    <span class="checkmark">✓</span>
                    <span>Your quote was the winning bid among all submissions</span>
                </div>
                <div class="benefit-item">
                    <span class="checkmark">✓</span>
                    <span>Contract award is being processed</span>
                </div>
                <div class="benefit-item">
                    <span class="checkmark">✓</span>
                    <span>Payment terms as per your quotation will be honored</span>
                </div>
                <div class="benefit-item">
                    <span class="checkmark">✓</span>
                    <span>This strengthens our partnership for future opportunities</span>
                </div>
            </div>
            
            <center>
                <a href="${process.env.VENDOR_PORTAL_URL || '#'}" class="cta-button">
                    📋 Access Vendor Portal
                </a>
            </center>
            
            <p style="font-style: italic; color: #666;">Thank you for your competitive pricing and commitment to quality. We look forward to a successful delivery and continued partnership.</p>
        </div>
        
        <div class="footer">
            <p><strong>${process.env.EMAIL_FROM_NAME || 'NexusMWI'}</strong><br>
            Procurement Department</p>
            <p style="font-size: 14px; margin-top: 15px;">
                For questions, contact: ${process.env.SENDGRID_FROM_EMAIL}
            </p>
        </div>
    </div>
</body>
</html>
`;

    return { text: textContent.trim(), html: htmlContent.trim() };
};

// Create PO created email content
const createPOCreatedEmailContent = (vendor, po) => {
    const totalValue = po.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const formattedTotal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalValue);
    
    const textContent = `
📋 NEW PURCHASE ORDER CREATED

Dear ${vendor.firstName} ${vendor.lastName},

A new Purchase Order has been created and assigned to your company. Please review the details below and confirm your acceptance.

PURCHASE ORDER DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🆔 PO Number: #${po._id}
📦 Total Items: ${po.items.length}
💰 Total Value: ${formattedTotal}
📅 Order Date: ${new Date(po.createdAt || Date.now()).toLocaleDateString()}
⏰ Expected Delivery: ${po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString() : 'To be confirmed'}
📍 Delivery Address: ${po.deliveryAddress || 'As specified in agreement'}

ITEMS ORDERED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${po.items.map((item, index) => `
${index + 1}. ${item.itemName || item.description}
   Quantity: ${item.quantity}
   Unit Price: $${item.unitPrice}
   Total: $${(item.quantity * item.unitPrice).toFixed(2)}
`).join('')}

REQUIRED ACTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Review the purchase order details carefully
2. Confirm acceptance and delivery timeline
3. Begin order processing and preparation
4. Update order status through our vendor portal
5. Submit any required compliance documentation

Please confirm receipt and acceptance within 24 hours. If you have any questions or concerns, contact our procurement team immediately.

Best regards,
${process.env.EMAIL_FROM_NAME || 'NexusMWI'} Procurement Team
`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Purchase Order Created</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 900px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
        .po-badge { background-color: rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 20px; display: inline-block; margin: 15px 0; }
        .content { padding: 30px; }
        .po-summary { background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-left: 4px solid #007bff; padding: 25px; margin: 25px 0; border-radius: 8px; }
        .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
        .summary-item { background-color: rgba(255,255,255,0.8); padding: 15px; border-radius: 8px; }
        .summary-label { font-weight: bold; color: #007bff; font-size: 14px; }
        .summary-value { font-size: 18px; margin-top: 5px; }
        .items-table { width: 100%; border-collapse: collapse; margin: 25px 0; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .items-table th { background-color: #007bff; color: white; padding: 15px; text-align: left; }
        .items-table td { padding: 15px; border-bottom: 1px solid #eee; }
        .items-table tr:nth-child(even) { background-color: #f8f9fa; }
        .total-row { background-color: #e3f2fd !important; font-weight: bold; }
        .actions { background-color: #fff3cd; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107; }
        .action-item { margin: 12px 0; display: flex; align-items: center; }
        .action-number { background-color: #ffc107; color: #333; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-weight: bold; }
        .urgent-notice { background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .footer { background-color: #343a40; color: white; padding: 30px; text-align: center; }
        .cta-button { background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 New Purchase Order</h1>
            <div class="po-badge">PO #${po._id}</div>
            <p>Purchase order ready for your review and processing</p>
        </div>
        
        <div class="content">
            <h2>Dear ${vendor.firstName} ${vendor.lastName},</h2>
            <p>A new Purchase Order has been created and assigned to your company. Please review the details below and confirm your acceptance within 24 hours.</p>
            
            <div class="po-summary">
                <h3>📊 Purchase Order Summary</h3>
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-label">🆔 PO Number</div>
                        <div class="summary-value">#${po._id}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">💰 Total Value</div>
                        <div class="summary-value" style="color: #28a745; font-weight: bold;">${formattedTotal}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">📦 Total Items</div>
                        <div class="summary-value">${po.items.length} items</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">📅 Order Date</div>
                        <div class="summary-value">${new Date(po.createdAt || Date.now()).toLocaleDateString()}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">⏰ Expected Delivery</div>
                        <div class="summary-value">${po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString() : 'To be confirmed'}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">📍 Delivery Address</div>
                        <div class="summary-value">${po.deliveryAddress || 'As specified in agreement'}</div>
                    </div>
                </div>
            </div>
            
            <h3>📦 Items Ordered</h3>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Item Description</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${po.items.map((item, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td><strong>${item.itemName || item.description}</strong></td>
                        <td>${item.quantity}</td>
                        <td>$${item.unitPrice.toFixed(2)}</td>
                        <td>$${(item.quantity * item.unitPrice).toFixed(2)}</td>
                    </tr>
                    `).join('')}
                    <tr class="total-row">
                        <td colspan="4"><strong>TOTAL ORDER VALUE</strong></td>
                        <td><strong>${formattedTotal}</strong></td>
                    </tr>
                </tbody>
            </table>
            
            <div class="urgent-notice">
                <strong>⚠️ Action Required:</strong> Please confirm receipt and acceptance within 24 hours to avoid delays in processing.
            </div>
            
            <div class="actions">
                <h3>📋 Required Actions</h3>
                <div class="action-item">
                    <div class="action-number">1</div>
                    <div>Review the purchase order details carefully</div>
                </div>
                <div class="action-item">
                    <div class="action-number">2</div>
                    <div>Confirm acceptance and delivery timeline</div>
                </div>
                <div class="action-item">
                    <div class="action-number">3</div>
                    <div>Begin order processing and preparation</div>
                </div>
                <div class="action-item">
                    <div class="action-number">4</div>
                    <div>Update order status through our vendor portal</div>
                </div>
                <div class="action-item">
                    <div class="action-number">5</div>
                    <div>Submit any required compliance documentation</div>
                </div>
            </div>
            
            <center>
                <a href="${process.env.VENDOR_PORTAL_URL || '#'}" class="cta-button">
                    ✅ Confirm Purchase Order
                </a>
            </center>
        </div>
        
        <div class="footer">
            <p><strong>${process.env.EMAIL_FROM_NAME || 'NexusMWI'}</strong><br>
            Procurement Department</p>
            <p style="font-size: 14px; margin-top: 15px;">
                Questions? Contact: ${process.env.SENDGRID_FROM_EMAIL}
            </p>
        </div>
    </div>
</body>
</html>
`;

    return { text: textContent.trim(), html: htmlContent.trim() };
};

// Create PO approval email content
const createPOApprovalEmailContent = (recipient, po, isVendor = false) => {
    const totalValue = po.items?.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) || 0;
    const formattedTotal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalValue);
    
    const title = isVendor ? "Purchase Order Approved - Ready for Processing" : "Purchase Order Approval Confirmation";
    const greeting = isVendor ? "Great news! Your purchase order has been approved." : "The purchase order has been successfully approved.";
    
    const textContent = `
${isVendor ? '🎉' : '✅'} PURCHASE ORDER APPROVED

Dear ${recipient.firstName} ${recipient.lastName},

${greeting}

APPROVED PURCHASE ORDER:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🆔 PO Number: #${po._id}
💰 Total Value: ${formattedTotal}
📅 Approval Date: ${new Date().toLocaleDateString()}
⭐ Status: APPROVED
${isVendor ? '🚀 Ready for: Order Processing & Fulfillment' : '📋 Action: Monitoring & Tracking'}

${isVendor ? `
VENDOR NEXT STEPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Begin order processing immediately
2. Confirm delivery timeline through vendor portal
3. Prepare items according to specifications
4. Submit shipping notifications when ready
5. Provide tracking information once dispatched

ORDER FULFILLMENT REQUIREMENTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ All items must meet specified quality standards
✓ Packaging must comply with our requirements
✓ Include all compliance certificates and documentation
✓ Notify us immediately of any potential delays
✓ Follow our delivery scheduling protocols
` : `
PROCUREMENT TEAM ACTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Monitor vendor confirmation and processing
2. Track delivery timeline and milestones
3. Coordinate with receiving department
4. Ensure compliance documentation is complete
5. Process payment upon successful delivery

APPROVAL DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Budget allocation confirmed
✓ Vendor compliance verified
✓ Delivery terms accepted
✓ Payment authorization processed
✓ Order officially activated
`}

This approval moves the order into active fulfillment status. ${isVendor ? 'You can now begin processing the order.' : 'The vendor has been notified to begin processing.'}

Best regards,
${process.env.EMAIL_FROM_NAME || 'NexusMWI'} Procurement Team
`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 800px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 35px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
        .approval-badge { background-color: rgba(255,255,255,0.2); padding: 12px 24px; border-radius: 25px; display: inline-block; margin: 15px 0; font-weight: bold; }
        .content { padding: 30px; }
        .po-info { background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); border-left: 4px solid #28a745; padding: 25px; margin: 25px 0; border-radius: 8px; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .info-item { background-color: rgba(255,255,255,0.8); padding: 15px; border-radius: 8px; text-align: center; }
        .info-label { font-weight: bold; color: #28a745; font-size: 14px; }
        .info-value { font-size: 18px; margin-top: 8px; }
        .next-steps { background-color: ${isVendor ? '#fff3cd' : '#e2e3e5'}; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid ${isVendor ? '#ffc107' : '#6c757d'}; }
        .step { display: flex; align-items: center; margin: 15px 0; }
        .step-number { background-color: ${isVendor ? '#ffc107' : '#6c757d'}; color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 20px; font-weight: bold; }
        .requirements { background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #007bff; }
        .requirement-item { margin: 10px 0; display: flex; align-items: center; }
        .checkmark { color: #28a745; font-weight: bold; margin-right: 12px; font-size: 18px; }
        .status-indicator { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; margin: 10px 0; }
        .footer { background-color: #343a40; color: white; padding: 30px; text-align: center; }
        .cta-button { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${isVendor ? '🎉' : '✅'} Purchase Order Approved</h1>
            <div class="approval-badge">PO #${po._id}</div>
            <p>${isVendor ? 'Ready for processing and fulfillment' : 'Approval confirmed - order activated'}</p>
        </div>
        
        <div class="content">
            <h2>Dear ${recipient.firstName} ${recipient.lastName},</h2>
            <p style="font-size: 18px; color: #28a745; font-weight: 500;">${greeting}</p>
            
            <div class="po-info">
                <h3>📋 Approved Purchase Order Details</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">🆔 PO Number</div>
                        <div class="info-value">#${po._id}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">💰 Total Value</div>
                        <div class="info-value" style="color: #28a745; font-weight: bold;">${formattedTotal}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">📅 Approval Date</div>
                        <div class="info-value">${new Date().toLocaleDateString()}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">⭐ Status</div>
                        <div class="status-indicator">APPROVED</div>
                    </div>
                </div>
            </div>
            
            <div class="next-steps">
                <h3>${isVendor ? '🚀 Your Next Steps' : '📋 Procurement Actions'}</h3>
                ${isVendor ? `
                <div class="step">
                    <div class="step-number">1</div>
                    <div>Begin order processing immediately</div>
                </div>
                <div class="step">
                    <div class="step-number">2</div>
                    <div>Confirm delivery timeline through vendor portal</div>
                </div>
                <div class="step">
                    <div class="step-number">3</div>
                    <div>Prepare items according to specifications</div>
                </div>
                <div class="step">
                    <div class="step-number">4</div>
                    <div>Submit shipping notifications when ready</div>
                </div>
                <div class="step">
                    <div class="step-number">5</div>
                    <div>Provide tracking information once dispatched</div>
                </div>
                ` : `
                <div class="step">
                    <div class="step-number">1</div>
                    <div>Monitor vendor confirmation and processing</div>
                </div>
                <div class="step">
                    <div class="step-number">2</div>
                    <div>Track delivery timeline and milestones</div>
                </div>
                <div class="step">
                    <div class="step-number">3</div>
                    <div>Coordinate with receiving department</div>
                </div>
                <div class="step">
                    <div class="step-number">4</div>
                    <div>Ensure compliance documentation is complete</div>
                </div>
                <div class="step">
                    <div class="step-number">5</div>
                    <div>Process payment upon successful delivery</div>
                </div>
                `}
            </div>
            
            ${isVendor ? `
            <div class="requirements">
                <h3>📋 Order Fulfillment Requirements</h3>
                <div class="requirement-item">
                    <span class="checkmark">✓</span>
                    <span>All items must meet specified quality standards</span>
                </div>
                <div class="requirement-item">
                    <span class="checkmark">✓</span>
                    <span>Packaging must comply with our requirements</span>
                </div>
                <div class="requirement-item">
                    <span class="checkmark">✓</span>
                    <span>Include all compliance certificates and documentation</span>
                </div>
                <div class="requirement-item">
                    <span class="checkmark">✓</span>
                    <span>Notify us immediately of any potential delays</span>
                </div>
                <div class="requirement-item">
                    <span class="checkmark">✓</span>
                    <span>Follow our delivery scheduling protocols</span>
                </div>
            </div>
            ` : `
            <div class="requirements">
                <h3>✅ Approval Confirmation Details</h3>
                <div class="requirement-item">
                    <span class="checkmark">✓</span>
                    <span>Budget allocation confirmed</span>
                </div>
                <div class="requirement-item">
                    <span class="checkmark">✓</span>
                    <span>Vendor compliance verified</span>
                </div>
                <div class="requirement-item">
                    <span class="checkmark">✓</span>
                    <span>Delivery terms accepted</span>
                </div>
                <div class="requirement-item">
                    <span class="checkmark">✓</span>
                    <span>Payment authorization processed</span>
                </div>
                <div class="requirement-item">
                    <span class="checkmark">✓</span>
                    <span>Order officially activated</span>
                </div>
            </div>
            `}
            
            <center>
                <a href="${process.env.VENDOR_PORTAL_URL || '#'}" class="cta-button">
                    ${isVendor ? '🚀 Start Processing Order' : '📊 View Order Status'}
                </a>
            </center>
            
            <p style="font-style: italic; color: #666;">This approval moves the order into active fulfillment status. ${isVendor ? 'You can now begin processing the order.' : 'The vendor has been notified to begin processing.'}</p>
        </div>
        
        <div class="footer">
            <p><strong>${process.env.EMAIL_FROM_NAME || 'NexusMWI'}</strong><br>
            Procurement Department</p>
            <p style="font-size: 14px; margin-top: 15px;">
                Questions? Contact: ${process.env.SENDGRID_FROM_EMAIL}
            </p>
        </div>
    </div>
</body>
</html>
`;

    return { text: textContent.trim(), html: htmlContent.trim() };
};

// Create shipping notification email content
const createShippingEmailContent = (officer, po) => {
    const totalValue = po.items?.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) || 0;
    const formattedTotal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalValue);
    
    const textContent = `
🚚 PURCHASE ORDER SHIPPED

Dear ${officer.firstName} ${officer.lastName},

Your purchase order has been shipped and is now in transit. Here are the shipping details:

SHIPPING INFORMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🆔 Purchase Order: #${po._id}
💰 Order Value: ${formattedTotal}
📦 Total Items: ${po.items?.length || 0}
🚚 Ship Date: ${new Date().toLocaleDateString()}
📍 Delivery Address: ${po.deliveryAddress || 'As specified'}
📅 Expected Delivery: ${po.estimatedDelivery ? new Date(po.estimatedDelivery).toLocaleDateString() : '2-3 business days'}
🔢 Tracking Number: ${po.trackingNumber || 'Will be provided separately'}

SHIPMENT CONTENTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${po.items?.map((item, index) => `
${index + 1}. ${item.itemName || item.description}
   Quantity: ${item.quantity}
   Status: Shipped
`).join('') || 'Items details will be provided with tracking information'}

NEXT STEPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Monitor tracking information for delivery updates
2. Coordinate with receiving department for arrival
3. Prepare inspection and acceptance procedures
4. Notify finance team for payment processing
5. Update order status upon successful receipt

You will receive tracking information and delivery notifications. Please ensure someone is available at the delivery location during business hours.

Best regards,
${process.env.EMAIL_FROM_NAME || 'NexusMWI'} Procurement Team
`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Purchase Order Shipped</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 800px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); color: white; padding: 35px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
        .truck-icon { font-size: 48px; margin: 15px 0; }
        .shipping-badge { background-color: rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 20px; display: inline-block; margin: 15px 0; }
        .content { padding: 30px; }
        .shipping-info { background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%); border-left: 4px solid #17a2b8; padding: 25px; margin: 25px 0; border-radius: 8px; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 20px 0; }
        .info-card { background-color: rgba(255,255,255,0.9); padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .info-label { font-weight: bold; color: #17a2b8; font-size: 14px; margin-bottom: 8px; }
        .info-value { font-size: 18px; }
        .tracking-highlight { background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; text-align: center; }
        .items-list { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #dee2e6; }
        .item:last-child { border-bottom: none; }
        .item-name { font-weight: 500; }
        .shipped-status { background-color: #28a745; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        .next-steps { background-color: #e2e3e5; padding: 25px; border-radius: 8px; margin: 25px 0; }
        .step { display: flex; align-items: center; margin: 15px 0; }
        .step-number { background-color: #6c757d; color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 20px; font-weight: bold; }
        .delivery-notice { background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .footer { background-color: #343a40; color: white; padding: 30px; text-align: center; }
        .cta-button { background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="truck-icon">🚚</div>
            <h1>Purchase Order Shipped</h1>
            <div class="shipping-badge">PO #${po._id} - In Transit</div>
        </div>
        
        <div class="content">
            <h2>Dear ${officer.firstName} ${officer.lastName},</h2>
            <p style="font-size: 18px; color: #17a2b8; font-weight: 500;">Great news! Your purchase order has been shipped and is now on its way to you.</p>
            
            <div class="shipping-info">
                <h3>📦 Shipping Information</h3>
                <div class="info-grid">
                    <div class="info-card">
                        <div class="info-label">🆔 Purchase Order</div>
                        <div class="info-value">#${po._id}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">💰 Order Value</div>
                        <div class="info-value" style="color: #28a745; font-weight: bold;">${formattedTotal}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">📦 Total Items</div>
                        <div class="info-value">${po.items?.length || 0} items</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">🚚 Ship Date</div>
                        <div class="info-value">${new Date().toLocaleDateString()}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">📍 Delivery Address</div>
                        <div class="info-value">${po.deliveryAddress || 'As specified'}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">📅 Expected Delivery</div>
                        <div class="info-value">${po.estimatedDelivery ? new Date(po.estimatedDelivery).toLocaleDateString() : '2-3 business days'}</div>
                    </div>
                </div>
            </div>
            
            ${po.trackingNumber ? `
            <div class="tracking-highlight">
                <h3>📍 Tracking Information</h3>
                <p style="font-size: 24px; font-weight: bold; color: #007bff; margin: 10px 0;">${po.trackingNumber}</p>
                <p>Use this tracking number to monitor your shipment progress</p>
            </div>
            ` : `
            <div class="tracking-highlight">
                <h3>📍 Tracking Information</h3>
                <p style="color: #856404;">Tracking number will be provided separately via email and SMS</p>
            </div>
            `}
            
            <div class="items-list">
                <h3>📋 Shipment Contents</h3>
                ${po.items?.map((item, index) => `
                <div class="item">
                    <div>
                        <div class="item-name">${item.itemName || item.description}</div>
                        <div style="color: #6c757d; font-size: 14px;">Quantity: ${item.quantity}</div>
                    </div>
                    <div class="shipped-status">Shipped</div>
                </div>
                `).join('') || '<p>Items details will be provided with tracking information</p>'}
            </div>
            
            <div class="delivery-notice">
                <strong>📋 Delivery Notice:</strong> Please ensure someone is available at the delivery location during business hours to receive the shipment.
            </div>
            
            <div class="next-steps">
                <h3>📋 Next Steps</h3>
                <div class="step">
                    <div class="step-number">1</div>
                    <div>Monitor tracking information for delivery updates</div>
                </div>
                <div class="step">
                    <div class="step-number">2</div>
                    <div>Coordinate with receiving department for arrival</div>
                </div>
                <div class="step">
                    <div class="step-number">3</div>
                    <div>Prepare inspection and acceptance procedures</div>
                </div>
                <div class="step">
                    <div class="step-number">4</div>
                    <div>Notify finance team for payment processing</div>
                </div>
                <div class="step">
                    <div class="step-number">5</div>
                    <div>Update order status upon successful receipt</div>
                </div>
            </div>
            
            <center>
                <a href="${process.env.TRACKING_URL || '#'}" class="cta-button">
                    📍 Track Your Shipment
                </a>
            </center>
        </div>
        
        <div class="footer">
            <p><strong>${process.env.EMAIL_FROM_NAME || 'NexusMWI'}</strong><br>
            Procurement Department</p>
            <p style="font-size: 14px; margin-top: 15px;">
                Questions? Contact: ${process.env.SENDGRID_FROM_EMAIL}
            </p>
        </div>
    </div>
</body>
</html>
`;

    return { text: textContent.trim(), html: htmlContent.trim() };
};

// Create delivery notification email content
const createDeliveryEmailContent = (officer, po) => {
    const totalValue = po.items?.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) || 0;
    const formattedTotal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalValue);
    
    const textContent = `
✅ PURCHASE ORDER DELIVERED

Dear ${officer.firstName} ${officer.lastName},

Your purchase order has been successfully delivered! Please verify receipt and confirm acceptance.

DELIVERY CONFIRMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🆔 Purchase Order: #${po._id}
💰 Order Value: ${formattedTotal}
📦 Items Delivered: ${po.items?.length || 0}
📅 Delivery Date: ${new Date().toLocaleDateString()}
⏰ Delivery Time: ${new Date().toLocaleTimeString()}
📍 Delivered To: ${po.deliveryAddress || 'Specified location'}

DELIVERED ITEMS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${po.items?.map((item, index) => `
${index + 1}. ${item.itemName || item.description}
   Quantity: ${item.quantity}
   Status: Delivered
`).join('') || 'All ordered items have been delivered'}

IMMEDIATE ACTIONS REQUIRED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. INSPECT all delivered items within 24 hours
2. VERIFY quantities match the purchase order
3. CHECK quality and condition of items
4. CONFIRM acceptance in procurement system
5. REPORT any discrepancies immediately

PAYMENT PROCESSING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Upon your confirmation of satisfactory delivery:
✓ Invoice will be processed for payment
✓ Vendor payment will be initiated
✓ Order will be marked as completed
✓ Performance metrics will be updated

Please confirm receipt within 48 hours to ensure timely payment processing.

Best regards,
${process.env.EMAIL_FROM_NAME || 'NexusMWI'} Procurement Team
`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Purchase Order Delivered</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 800px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 35px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
        .delivery-icon { font-size: 48px; margin: 15px 0; }
        .delivered-badge { background-color: rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 20px; display: inline-block; margin: 15px 0; font-weight: bold; }
        .content { padding: 30px; }
        .delivery-info { background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); border-left: 4px solid #28a745; padding: 25px; margin: 25px 0; border-radius: 8px; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 20px 0; }
        .info-card { background-color: rgba(255,255,255,0.9); padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .info-label { font-weight: bold; color: #28a745; font-size: 14px; margin-bottom: 8px; }
        .info-value { font-size: 18px; }
        .items-delivered { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #dee2e6; }
        .item:last-child { border-bottom: none; }
        .item-name { font-weight: 500; }
        .delivered-status { background-color: #28a745; color: white; padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        .urgent-actions { background-color: #fff3cd; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107; }
        .action { display: flex; align-items: center; margin: 15px 0; }
        .action-number { background-color: #ffc107; color: #333; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 20px; font-weight: bold; }
        .payment-process { background-color: #e3f2fd; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2196f3; }
        .process-item { margin: 10px 0; display: flex; align-items: center; }
        .checkmark { color: #28a745; font-weight: bold; margin-right: 12px; font-size: 18px; }
        .deadline-notice { background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; font-weight: bold; }
        .footer { background-color: #343a40; color: white; padding: 30px; text-align: center; }
        .cta-button { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="delivery-icon">📦✅</div>
            <h1>Order Delivered Successfully</h1>
            <div class="delivered-badge">PO #${po._id} - Delivered</div>
        </div>
        
        <div class="content">
            <h2>Dear ${officer.firstName} ${officer.lastName},</h2>
            <p style="font-size: 18px; color: #28a745; font-weight: 500;">Excellent news! Your purchase order has been successfully delivered. Please verify receipt and confirm acceptance.</p>
            
            <div class="delivery-info">
                <h3>📋 Delivery Confirmation</h3>
                <div class="info-grid">
                    <div class="info-card">
                        <div class="info-label">🆔 Purchase Order</div>
                        <div class="info-value">#${po._id}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">💰 Order Value</div>
                        <div class="info-value" style="color: #28a745; font-weight: bold;">${formattedTotal}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">📦 Items Delivered</div>
                        <div class="info-value">${po.items?.length || 0} items</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">📅 Delivery Date</div>
                        <div class="info-value">${new Date().toLocaleDateString()}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">⏰ Delivery Time</div>
                        <div class="info-value">${new Date().toLocaleTimeString()}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">📍 Delivered To</div>
                        <div class="info-value">${po.deliveryAddress || 'Specified location'}</div>
                    </div>
                </div>
            </div>
            
            <div class="items-delivered">
                <h3>📦 Delivered Items</h3>
                ${po.items?.map((item, index) => `
                <div class="item">
                    <div>
                        <div class="item-name">${item.itemName || item.description}</div>
                        <div style="color: #6c757d; font-size: 14px;">Quantity: ${item.quantity}</div>
                    </div>
                    <div class="delivered-status">Delivered</div>
                </div>
                `).join('') || '<p>All ordered items have been delivered successfully</p>'}
            </div>
            
            <div class="deadline-notice">
                ⚠️ Action Required: Please confirm receipt within 48 hours to ensure timely payment processing
            </div>
            
            <div class="urgent-actions">
                <h3>🚨 Immediate Actions Required</h3>
                <div class="action">
                    <div class="action-number">1</div>
                    <div><strong>INSPECT</strong> all delivered items within 24 hours</div>
                </div>
                <div class="action">
                    <div class="action-number">2</div>
                    <div><strong>VERIFY</strong> quantities match the purchase order</div>
                </div>
                <div class="action">
                    <div class="action-number">3</div>
                    <div><strong>CHECK</strong> quality and condition of items</div>
                </div>
                <div class="action">
                    <div class="action-number">4</div>
                    <div><strong>CONFIRM</strong> acceptance in procurement system</div>
                </div>
                <div class="action">
                    <div class="action-number">5</div>
                    <div><strong>REPORT</strong> any discrepancies immediately</div>
                </div>
            </div>
            
            <div class="payment-process">
                <h3>💳 Payment Processing</h3>
                <p style="font-weight: 500; margin-bottom: 15px;">Upon your confirmation of satisfactory delivery:</p>
                <div class="process-item">
                    <span class="checkmark">✓</span>
                    <span>Invoice will be processed for payment</span>
                </div>
                <div class="process-item">
                    <span class="checkmark">✓</span>
                    <span>Vendor payment will be initiated</span>
                </div>
                <div class="process-item">
                    <span class="checkmark">✓</span>
                    <span>Order will be marked as completed</span>
                </div>
                <div class="process-item">
                    <span class="checkmark">✓</span>
                    <span>Performance metrics will be updated</span>
                </div>
            </div>
            
            <center>
                <a href="${process.env.PROCUREMENT_SYSTEM_URL || '#'}" class="cta-button">
                    ✅ Confirm Receipt & Acceptance
                </a>
            </center>
        </div>
        
        <div class="footer">
            <p><strong>${process.env.EMAIL_FROM_NAME || 'NexusMWI'}</strong><br>
            Procurement Department</p>
            <p style="font-size: 14px; margin-top: 15px;">
                Questions? Contact: ${process.env.SENDGRID_FROM_EMAIL}
            </p>
        </div>
    </div>
</body>
</html>
`;

    return { text: textContent.trim(), html: htmlContent.trim() };
};

// Create PO confirmation email content
const createPOConfirmationEmailContent = (vendor, po) => {
    const totalValue = po.items?.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) || 0;
    const formattedTotal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalValue);
    
    const textContent = `
🎉 PURCHASE ORDER CONFIRMED BY PROCUREMENT

Dear ${vendor.firstName} ${vendor.lastName},

Excellent news! Your purchase order has been confirmed by our procurement officer. The order is now officially completed.

CONFIRMED PURCHASE ORDER:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🆔 PO Number: #${po._id}
💰 Total Value: ${formattedTotal}
📅 Confirmation Date: ${new Date().toLocaleDateString()}
✅ Status: CONFIRMED & COMPLETED
⭐ Performance: Successful Delivery

ORDER COMPLETION SUMMARY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ All items delivered successfully
✓ Quality standards met
✓ Delivery timeline achieved
✓ Customer satisfaction confirmed
✓ Order officially completed

DELIVERED ITEMS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${po.items?.map((item, index) => `
${index + 1}. ${item.itemName || item.description}
   Quantity: ${item.quantity}
   Status: ✅ Confirmed & Accepted
`).join('') || 'All ordered items confirmed and accepted'}

PAYMENT & BUSINESS IMPACT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Invoice approved for payment processing
✓ Payment will be issued according to terms
✓ Vendor performance rating updated positively
✓ Partnership strength enhanced
✓ Future opportunity eligibility maintained

This successful completion strengthens our business relationship and positions you favorably for future procurement opportunities.

Best regards,
${process.env.EMAIL_FROM_NAME || 'NexusMWI'} Procurement Team
`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Purchase Order Confirmed</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 800px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 40px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
        .celebration { font-size: 48px; margin: 15px 0; }
        .confirmed-badge { background-color: rgba(255,255,255,0.2); padding: 12px 24px; border-radius: 25px; display: inline-block; margin: 15px 0; font-weight: bold; }
        .content { padding: 30px; }
        .confirmation-info { background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); border-left: 4px solid #28a745; padding: 25px; margin: 25px 0; border-radius: 8px; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .info-card { background-color: rgba(255,255,255,0.9); padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .info-label { font-weight: bold; color: #28a745; font-size: 14px; margin-bottom: 8px; }
        .info-value { font-size: 18px; }
        .completion-summary { background-color: #e8f5e8; padding: 25px; border-radius: 8px; margin: 25px 0; }
        .summary-item { margin: 12px 0; display: flex; align-items: center; }
        .checkmark { color: #28a745; font-weight: bold; margin-right: 15px; font-size: 20px; }
        .items-confirmed { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #dee2e6; }
        .item:last-child { border-bottom: none; }
        .item-name { font-weight: 500; }
        .confirmed-status { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        .business-impact { background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107; }
        .impact-item { margin: 12px 0; display: flex; align-items: center; }
        .star { color: #ffc107; font-weight: bold; margin-right: 12px; font-size: 18px; }
        .partnership-note { background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3; font-style: italic; text-align: center; }
        .footer { background-color: #343a40; color: white; padding: 30px; text-align: center; }
        .cta-button { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="celebration">🎉 ✅ 🎉</div>
            <h1>Order Confirmed & Completed!</h1>
            <div class="confirmed-badge">PO #${po._id} - CONFIRMED</div>
            <p>Successful delivery confirmed by procurement</p>
        </div>
        
        <div class="content">
            <h2>Dear ${vendor.firstName} ${vendor.lastName},</h2>
            <p style="font-size: 18px; color: #28a745; font-weight: 500;">Excellent news! Your purchase order has been confirmed by our procurement officer. The order is now officially completed with full satisfaction.</p>
            
            <div class="confirmation-info">
                <h3>📋 Confirmed Purchase Order</h3>
                <div class="info-grid">
                    <div class="info-card">
                        <div class="info-label">🆔 PO Number</div>
                        <div class="info-value">#${po._id}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">💰 Total Value</div>
                        <div class="info-value" style="color: #28a745; font-weight: bold;">${formattedTotal}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">📅 Confirmation Date</div>
                        <div class="info-value">${new Date().toLocaleDateString()}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">✅ Status</div>
                        <div style="color: #28a745; font-weight: bold; font-size: 16px;">CONFIRMED & COMPLETED</div>
                    </div>
                </div>
            </div>
            
            <div class="completion-summary">
                <h3>🏆 Order Completion Summary</h3>
                <div class="summary-item">
                    <span class="checkmark">✓</span>
                    <span>All items delivered successfully</span>
                </div>
                <div class="summary-item">
                    <span class="checkmark">✓</span>
                    <span>Quality standards met and exceeded</span>
                </div>
                <div class="summary-item">
                    <span class="checkmark">✓</span>
                    <span>Delivery timeline achieved</span>
                </div>
                <div class="summary-item">
                    <span class="checkmark">✓</span>
                    <span>Customer satisfaction confirmed</span>
                </div>
                <div class="summary-item">
                    <span class="checkmark">✓</span>
                    <span>Order officially completed</span>
                </div>
            </div>
            
            <div class="items-confirmed">
                <h3>📦 Delivered & Confirmed Items</h3>
                ${po.items?.map((item, index) => `
                <div class="item">
                    <div>
                        <div class="item-name">${item.itemName || item.description}</div>
                        <div style="color: #6c757d; font-size: 14px;">Quantity: ${item.quantity}</div>
                    </div>
                    <div class="confirmed-status">✅ Confirmed</div>
                </div>
                `).join('') || '<p>All ordered items confirmed and accepted</p>'}
            </div>
            
            <div class="business-impact">
                <h3>💼 Payment & Business Impact</h3>
                <div class="impact-item">
                    <span class="star">⭐</span>
                    <span>Invoice approved for payment processing</span>
                </div>
                <div class="impact-item">
                    <span class="star">⭐</span>
                    <span>Payment will be issued according to terms</span>
                </div>
                <div class="impact-item">
                    <span class="star">⭐</span>
                    <span>Vendor performance rating updated positively</span>
                </div>
                <div class="impact-item">
                    <span class="star">⭐</span>
                    <span>Partnership strength enhanced</span>
                </div>
                <div class="impact-item">
                    <span class="star">⭐</span>
                    <span>Future opportunity eligibility maintained</span>
                </div>
            </div>
            
            <div class="partnership-note">
                <h4>🤝 Partnership Success</h4>
                <p>This successful completion strengthens our business relationship and positions you favorably for future procurement opportunities. Thank you for your excellent service and reliability.</p>
            </div>
            
            <center>
                <a href="${process.env.VENDOR_PORTAL_URL || '#'}" class="cta-button">
                    📊 View Performance Dashboard
                </a>
            </center>
        </div>
        
        <div class="footer">
            <p><strong>${process.env.EMAIL_FROM_NAME || 'NexusMWI'}</strong><br>
            Procurement Department</p>
            <p style="font-size: 14px; margin-top: 15px;">
                Partnership inquiries: ${process.env.SENDGRID_FROM_EMAIL}
            </p>
        </div>
    </div>
</body>
</html>
`;

    return { text: textContent.trim(), html: htmlContent.trim() };
};

// Create invoice submission email content
const createInvoiceSubmissionEmailContent = (officer, invoice) => {
    const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(invoice.amount || 0);
    
    const textContent = `
📄 NEW INVOICE SUBMITTED FOR APPROVAL

Dear ${officer.firstName} ${officer.lastName},

A new invoice has been submitted and requires your approval for payment processing.

INVOICE DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧾 Invoice Number: #${invoice.invoiceNumber}
💰 Invoice Amount: ${formattedAmount}
📅 Submission Date: ${new Date().toLocaleDateString()}
🏢 Vendor: ${invoice.vendorName || 'Vendor details in system'}
📋 Related PO: ${invoice.poNumber || 'See invoice details'}
⏰ Payment Terms: ${invoice.paymentTerms || 'As per agreement'}

INVOICE SUMMARY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${invoice.items?.map((item, index) => `
${index + 1}. ${item.description || 'Item description'}
   Quantity: ${item.quantity || 'N/A'}
   Unit Price: $${item.unitPrice || '0.00'}
   Total: $${(item.quantity * item.unitPrice).toFixed(2) || '0.00'}
`).join('') || 'Invoice details available in the procurement system'}

APPROVAL ACTIONS REQUIRED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Review invoice details and supporting documentation
2. Verify amounts against purchase order and delivery receipts
3. Check compliance with company policies
4. Approve or request modifications through the system
5. Process payment authorization if approved

Please review and take action within your standard approval timeframe to ensure timely vendor payments.

Best regards,
${process.env.EMAIL_FROM_NAME || 'NexusMWI'} Finance Team
`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice Submitted for Approval</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 800px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #ffc107 0%, #ff8f00 100%); color: #333; padding: 35px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
        .invoice-icon { font-size: 48px; margin: 15px 0; }
        .pending-badge { background-color: rgba(255,255,255,0.8); padding: 10px 20px; border-radius: 20px; display: inline-block; margin: 15px 0; font-weight: bold; color: #856404; }
        .content { padding: 30px; }
        .invoice-info { background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); border-left: 4px solid #ffc107; padding: 25px; margin: 25px 0; border-radius: 8px; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 20px 0; }
        .info-card { background-color: rgba(255,255,255,0.9); padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .info-label { font-weight: bold; color: #856404; font-size: 14px; margin-bottom: 8px; }
        .info-value { font-size: 18px; }
        .amount-highlight { background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border-left: 4px solid #28a745; }
        .invoice-items { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #dee2e6; }
        .item:last-child { border-bottom: none; }
        .item-name { font-weight: 500; }
        .approval-actions { background-color: #e3f2fd; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2196f3; }
        .action { display: flex; align-items: center; margin: 15px 0; }
        .action-number { background-color: #2196f3; color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 20px; font-weight: bold; }
        .urgency-notice { background-color: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .footer { background-color: #343a40; color: white; padding: 30px; text-align: center; }
        .cta-button { background: linear-gradient(135deg, #ffc107 0%, #ff8f00 100%); color: #333; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="invoice-icon">📄💼</div>
            <h1>Invoice Awaiting Approval</h1>
            <div class="pending-badge">Invoice #${invoice.invoiceNumber} - PENDING</div>
        </div>
        
        <div class="content">
            <h2>Dear ${officer.firstName} ${officer.lastName},</h2>
            <p style="font-size: 18px; color: #856404; font-weight: 500;">A new invoice has been submitted and requires your approval for payment processing.</p>
            
            <div class="amount-highlight">
                <h3 style="margin: 0; color: #28a745;">Invoice Amount</h3>
                <div style="font-size: 32px; font-weight: bold; color: #28a745; margin: 10px 0;">${formattedAmount}</div>
                <p style="margin: 0; color: #6c757d;">Awaiting your approval</p>
            </div>
            
            <div class="invoice-info">
                <h3>📋 Invoice Details</h3>
                <div class="info-grid">
                    <div class="info-card">
                        <div class="info-label">🧾 Invoice Number</div>
                        <div class="info-value">#${invoice.invoiceNumber}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">📅 Submission Date</div>
                        <div class="info-value">${new Date().toLocaleDateString()}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">🏢 Vendor</div>
                        <div class="info-value">${invoice.vendorName || 'Vendor details in system'}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">📋 Related PO</div>
                        <div class="info-value">${invoice.poNumber || 'See invoice details'}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">⏰ Payment Terms</div>
                        <div class="info-value">${invoice.paymentTerms || 'As per agreement'}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">📊 Status</div>
                        <div style="color: #856404; font-weight: bold;">PENDING APPROVAL</div>
                    </div>
                </div>
            </div>
            
            ${invoice.items && invoice.items.length > 0 ? `
            <div class="invoice-items">
                <h3>📦 Invoice Line Items</h3>
                ${invoice.items.map((item, index) => `
                <div class="item">
                    <div>
                        <div class="item-name">${item.description || 'Item description'}</div>
                        <div style="color: #6c757d; font-size: 14px;">Qty: ${item.quantity || 'N/A'} × $${item.unitPrice || '0.00'}</div>
                    </div>
                    <div style="font-weight: bold;">$${(item.quantity * item.unitPrice).toFixed(2) || '0.00'}</div>
                </div>
                `).join('')}
            </div>
            ` : `
            <div class="invoice-items">
                <h3>📦 Invoice Details</h3>
                <p>Complete invoice details are available in the procurement system for your review.</p>
            </div>
            `}
            
            <div class="urgency-notice">
                📅 Please review and take action within your standard approval timeframe to ensure timely vendor payments
            </div>
            
            <div class="approval-actions">
                <h3>✅ Approval Actions Required</h3>
                <div class="action">
                    <div class="action-number">1</div>
                    <div>Review invoice details and supporting documentation</div>
                </div>
                <div class="action">
                    <div class="action-number">2</div>
                    <div>Verify amounts against purchase order and delivery receipts</div>
                </div>
                <div class="action">
                    <div class="action-number">3</div>
                    <div>Check compliance with company policies</div>
                </div>
                <div class="action">
                    <div class="action-number">4</div>
                    <div>Approve or request modifications through the system</div>
                </div>
                <div class="action">
                    <div class="action-number">5</div>
                    <div>Process payment authorization if approved</div>
                </div>
            </div>
            
            <center>
                <a href="${process.env.PROCUREMENT_SYSTEM_URL || '#'}" class="cta-button">
                    📋 Review & Approve Invoice
                </a>
            </center>
        </div>
        
        <div class="footer">
            <p><strong>${process.env.EMAIL_FROM_NAME || 'NexusMWI'}</strong><br>
            Finance Department</p>
            <p style="font-size: 14px; margin-top: 15px;">
                Questions? Contact: ${process.env.SENDGRID_FROM_EMAIL}
            </p>
        </div>
    </div>
</body>
</html>
`;

    return { text: textContent.trim(), html: htmlContent.trim() };
};

// Create invoice approval email content
const createInvoiceApprovalEmailContent = (vendor, invoice) => {
    const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(invoice.amount || 0);
    
    const textContent = `
✅ INVOICE APPROVED - PAYMENT PROCESSING

Dear ${vendor.firstName} ${vendor.lastName},

Great news! Your invoice has been approved and is now being processed for payment.

APPROVED INVOICE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧾 Invoice Number: #${invoice.invoiceNumber}
💰 Approved Amount: ${formattedAmount}
📅 Approval Date: ${new Date().toLocaleDateString()}
✅ Status: APPROVED & PROCESSING
💳 Payment Method: ${invoice.paymentMethod || 'As per agreement'}
📅 Expected Payment: ${invoice.expectedPaymentDate ? new Date(invoice.expectedPaymentDate).toLocaleDateString() : '5-7 business days'}

PAYMENT PROCESSING DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Invoice verified and approved by procurement team
✓ Payment authorization processed
✓ Finance team notified for payment processing
✓ Payment will be issued according to agreed terms
✓ Payment confirmation will be sent upon completion

APPROVED ITEMS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${invoice.items?.map((item, index) => `
${index + 1}. ${item.description || 'Item description'}
   Quantity: ${item.quantity || 'N/A'}
   Unit Price: ${item.unitPrice || '0.00'}
   Total: ${(item.quantity * item.unitPrice).toFixed(2) || '0.00'}
`).join('') || 'All invoice items have been approved for payment'}

WHAT HAPPENS NEXT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Payment processing initiated in finance system
2. Payment scheduled according to your terms
3. Bank transfer/check preparation in progress
4. Payment confirmation email will be sent
5. Receipt and payment details will be provided

Thank you for your excellent service and prompt invoicing. We value our partnership and look forward to continued collaboration.

Best regards,
${process.env.EMAIL_FROM_NAME || 'NexusMWI'} Finance Team
`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice Approved for Payment</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 800px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 35px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
        .approval-icon { font-size: 48px; margin: 15px 0; }
        .approved-badge { background-color: rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 20px; display: inline-block; margin: 15px 0; font-weight: bold; }
        .content { padding: 30px; }
        .approval-info { background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); border-left: 4px solid #28a745; padding: 25px; margin: 25px 0; border-radius: 8px; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 20px 0; }
        .info-card { background-color: rgba(255,255,255,0.9); padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .info-label { font-weight: bold; color: #28a745; font-size: 14px; margin-bottom: 8px; }
        .info-value { font-size: 18px; }
        .amount-highlight { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 25px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .processing-steps { background-color: #e8f5e8; padding: 25px; border-radius: 8px; margin: 25px 0; }
        .step-item { margin: 12px 0; display: flex; align-items: center; }
        .checkmark { color: #28a745; font-weight: bold; margin-right: 15px; font-size: 20px; }
        .invoice-items { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #dee2e6; }
        .item:last-child { border-bottom: none; }
        .item-name { font-weight: 500; }
        .next-steps { background-color: #fff3cd; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107; }
        .step { display: flex; align-items: center; margin: 15px 0; }
        .step-number { background-color: #ffc107; color: #333; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 20px; font-weight: bold; }
        .partnership-note { background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3; font-style: italic; text-align: center; }
        .footer { background-color: #343a40; color: white; padding: 30px; text-align: center; }
        .cta-button { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="approval-icon">✅💰</div>
            <h1>Invoice Approved</h1>
            <div class="approved-badge">Invoice #${invoice.invoiceNumber} - APPROVED</div>
            <p>Payment processing initiated</p>
        </div>
        
        <div class="content">
            <h2>Dear ${vendor.firstName} ${vendor.lastName},</h2>
            <p style="font-size: 18px; color: #28a745; font-weight: 500;">Excellent news! Your invoice has been approved and is now being processed for payment.</p>
            
            <div class="amount-highlight">
                <h3 style="margin: 0;">Approved Payment Amount</h3>
                <div style="font-size: 36px; font-weight: bold; margin: 15px 0;">${formattedAmount}</div>
                <p style="margin: 0; opacity: 0.9;">Processing for payment</p>
            </div>
            
            <div class="approval-info">
                <h3>📋 Approved Invoice Details</h3>
                <div class="info-grid">
                    <div class="info-card">
                        <div class="info-label">🧾 Invoice Number</div>
                        <div class="info-value">#${invoice.invoiceNumber}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">📅 Approval Date</div>
                        <div class="info-value">${new Date().toLocaleDateString()}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">💳 Payment Method</div>
                        <div class="info-value">${invoice.paymentMethod || 'As per agreement'}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">📅 Expected Payment</div>
                        <div class="info-value">${invoice.expectedPaymentDate ? new Date(invoice.expectedPaymentDate).toLocaleDateString() : '5-7 business days'}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">✅ Status</div>
                        <div style="color: #28a745; font-weight: bold;">APPROVED & PROCESSING</div>
                    </div>
                </div>
            </div>
            
            <div class="processing-steps">
                <h3>🔄 Payment Processing Status</h3>
                <div class="step-item">
                    <span class="checkmark">✓</span>
                    <span>Invoice verified and approved by procurement team</span>
                </div>
                <div class="step-item">
                    <span class="checkmark">✓</span>
                    <span>Payment authorization processed</span>
                </div>
                <div class="step-item">
                    <span class="checkmark">✓</span>
                    <span>Finance team notified for payment processing</span>
                </div>
                <div class="step-item">
                    <span class="checkmark">⏳</span>
                    <span>Payment will be issued according to agreed terms</span>
                </div>
                <div class="step-item">
                    <span class="checkmark">⏳</span>
                    <span>Payment confirmation will be sent upon completion</span>
                </div>
            </div>
            
            ${invoice.items && invoice.items.length > 0 ? `
            <div class="invoice-items">
                <h3>📦 Approved Items</h3>
                ${invoice.items.map((item, index) => `
                <div class="item">
                    <div>
                        <div class="item-name">${item.description || 'Item description'}</div>
                        <div style="color: #6c757d; font-size: 14px;">Qty: ${item.quantity || 'N/A'} × ${item.unitPrice || '0.00'}</div>
                    </div>
                    <div style="font-weight: bold; color: #28a745;">${(item.quantity * item.unitPrice).toFixed(2) || '0.00'}</div>
                </div>
                `).join('')}
            </div>
            ` : `
            <div class="invoice-items">
                <h3>📦 Invoice Summary</h3>
                <p>All invoice items have been approved for payment according to the submitted invoice details.</p>
            </div>
            `}
            
            <div class="next-steps">
                <h3>💼 What Happens Next</h3>
                <div class="step">
                    <div class="step-number">1</div>
                    <div>Payment processing initiated in finance system</div>
                </div>
                <div class="step">
                    <div class="step-number">2</div>
                    <div>Payment scheduled according to your terms</div>
                </div>
                <div class="step">
                    <div class="step-number">3</div>
                    <div>Bank transfer/check preparation in progress</div>
                </div>
                <div class="step">
                    <div class="step-number">4</div>
                    <div>Payment confirmation email will be sent</div>
                </div>
                <div class="step">
                    <div class="step-number">5</div>
                    <div>Receipt and payment details will be provided</div>
                </div>
            </div>
            
            <div class="partnership-note">
                <h4>🤝 Thank You</h4>
                <p>Thank you for your excellent service and prompt invoicing. We value our partnership and look forward to continued collaboration.</p>
            </div>
            
            <center>
                <a href="${process.env.VENDOR_PORTAL_URL || '#'}" class="cta-button">
                    📊 Track Payment Status
                </a>
            </center>
        </div>
        
        <div class="footer">
            <p><strong>${process.env.EMAIL_FROM_NAME || 'NexusMWI'}</strong><br>
            Finance Department</p>
            <p style="font-size: 14px; margin-top: 15px;">
                Payment inquiries: ${process.env.SENDGRID_FROM_EMAIL}
            </p>
        </div>
    </div>
</body>
</html>
`;

    return { text: textContent.trim(), html: htmlContent.trim() };
};

// Create invoice payment email content
const createInvoicePaymentEmailContent = (vendor, invoice) => {
    const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(invoice.amount || 0);
    
    const textContent = `
💰 INVOICE PAYMENT COMPLETED

Dear ${vendor.firstName} ${vendor.lastName},

Your invoice has been successfully paid! Payment has been processed and should reflect in your account soon.

PAYMENT CONFIRMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧾 Invoice Number: #${invoice.invoiceNumber}
💰 Payment Amount: ${formattedAmount}
📅 Payment Date: ${new Date().toLocaleDateString()}
🏦 Payment Method: ${invoice.paymentMethod || 'Bank Transfer'}
🆔 Transaction ID: ${invoice.transactionId || 'Available in payment portal'}
📧 Payment Reference: ${invoice.paymentReference || invoice.invoiceNumber}

PAYMENT DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💳 Payment Type: ${invoice.paymentType || 'Electronic Transfer'}
🏦 Bank: ${invoice.bankName || 'As per your banking details'}
💼 Account: ${invoice.accountReference || '****ending in your registered account'}
⏰ Processing Time: 1-3 business days
📄 Tax Documentation: Available in vendor portal

INVOICE SUMMARY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${invoice.items?.map((item, index) => `
${index + 1}. ${item.description || 'Item description'}
   Quantity: ${item.quantity || 'N/A'}
   Unit Price: ${item.unitPrice || '0.00'}
   Total: ${(item.quantity * item.unitPrice).toFixed(2) || '0.00'}
`).join('') || 'Payment completed for all invoice items'}

Subtotal: ${invoice.subtotal ? `${invoice.subtotal.toFixed(2)}` : 'Included in total'}
Tax: ${invoice.tax ? `${invoice.tax.toFixed(2)}` : 'As applicable'}
Total Paid: ${formattedAmount}

IMPORTANT INFORMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Payment confirmation and receipt available in vendor portal
• Tax documents will be sent separately if applicable
• Contact finance team for any payment-related queries
• This transaction closes invoice #${invoice.invoiceNumber}
• Thank you for your continued partnership

If you have any questions about this payment or need additional documentation, please contact our finance team.

Best regards,
${process.env.EMAIL_FROM_NAME || 'NexusMWI'} Finance Team
`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice Payment Completed</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 800px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 40px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
        .payment-icon { font-size: 48px; margin: 15px 0; }
        .paid-badge { background-color: rgba(255,255,255,0.2); padding: 12px 24px; border-radius: 25px; display: inline-block; margin: 15px 0; font-weight: bold; }
        .content { padding: 30px; }
        .payment-confirmation { background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); border-left: 4px solid #28a745; padding: 25px; margin: 25px 0; border-radius: 8px; }
        .amount-highlight { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 20px 0; }
        .info-card { background-color: rgba(255,255,255,0.9); padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .info-label { font-weight: bold; color: #28a745; font-size: 14px; margin-bottom: 8px; }
        .info-value { font-size: 18px; }
        .payment-details { background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0; }
        .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #dee2e6; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { font-weight: 500; color: #6c757d; }
        .detail-value { font-weight: bold; }
        .invoice-summary { background-color: #fff; border: 1px solid #dee2e6; border-radius: 8px; margin: 20px 0; overflow: hidden; }
        .summary-header { background-color: #f8f9fa; padding: 15px; border-bottom: 1px solid #dee2e6; font-weight: bold; }
        .item-row { padding: 12px 15px; border-bottom: 1px solid #f8f9fa; display: flex; justify-content: space-between; align-items: center; }
        .item-row:last-child { border-bottom: none; }
        .item-name { font-weight: 500; }
        .total-section { background-color: #f8f9fa; padding: 15px; }
        .total-row { display: flex; justify-content: space-between; margin: 5px 0; }
        .final-total { font-size: 20px; font-weight: bold; color: #28a745; border-top: 2px solid #28a745; padding-top: 10px; margin-top: 10px; }
        .important-info { background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
        .info-item { margin: 8px 0; display: flex; align-items: flex-start; }
        .bullet { color: #ffc107; font-weight: bold; margin-right: 10px; }
        .footer { background-color: #343a40; color: white; padding: 30px; text-align: center; }
        .cta-button { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="payment-icon">💰✅</div>
            <h1>Payment Completed</h1>
            <div class="paid-badge">Invoice #${invoice.invoiceNumber} - PAID</div>
            <p>Your payment has been successfully processed</p>
        </div>
        
        <div class="content">
            <h2>Dear ${vendor.firstName} ${vendor.lastName},</h2>
            <p style="font-size: 18px; color: #28a745; font-weight: 500;">Excellent news! Your invoice has been successfully paid. Payment has been processed and should reflect in your account soon.</p>
            
            <div class="amount-highlight">
                <h3 style="margin: 0;">Payment Amount</h3>
                <div style="font-size: 42px; font-weight: bold; margin: 15px 0;">${formattedAmount}</div>
                <p style="margin: 0; opacity: 0.9;">Successfully transferred to your account</p>
            </div>
            
            <div class="payment-confirmation">
                <h3>📋 Payment Confirmation</h3>
                <div class="info-grid">
                    <div class="info-card">
                        <div class="info-label">🧾 Invoice Number</div>
                        <div class="info-value">#${invoice.invoiceNumber}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">📅 Payment Date</div>
                        <div class="info-value">${new Date().toLocaleDateString()}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">🏦 Payment Method</div>
                        <div class="info-value">${invoice.paymentMethod || 'Bank Transfer'}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">🆔 Transaction ID</div>
                        <div class="info-value">${invoice.transactionId || 'In payment portal'}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">📧 Payment Reference</div>
                        <div class="info-value">${invoice.paymentReference || invoice.invoiceNumber}</div>
                    </div>
                </div>
            </div>
            
            <div class="payment-details">
                <h3>💳 Payment Details</h3>
                <div class="detail-row">
                    <span class="detail-label">Payment Type</span>
                    <span class="detail-value">${invoice.paymentType || 'Electronic Transfer'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Bank</span>
                    <span class="detail-value">${invoice.bankName || 'As per your banking details'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Account</span>
                    <span class="detail-value">${invoice.accountReference || '****ending in your registered account'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Processing Time</span>
                    <span class="detail-value">1-3 business days</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Tax Documentation</span>
                    <span class="detail-value">Available in vendor portal</span>
                </div>
            </div>
            
            <div class="invoice-summary">
                <div class="summary-header">📦 Invoice Summary</div>
                ${invoice.items && invoice.items.length > 0 ? 
                    invoice.items.map((item, index) => `
                    <div class="item-row">
                        <div>
                            <div class="item-name">${item.description || 'Item description'}</div>
                            <div style="color: #6c757d; font-size: 14px;">Qty: ${item.quantity || 'N/A'} × ${item.unitPrice || '0.00'}</div>
                        </div>
                        <div style="font-weight: bold;">${(item.quantity * item.unitPrice).toFixed(2) || '0.00'}</div>
                    </div>
                    `).join('') 
                    : '<div class="item-row">Payment completed for all invoice items</div>'
                }
                <div class="total-section">
                    <div class="total-row">
                        <span>Subtotal:</span>
                        <span>${invoice.subtotal ? `${invoice.subtotal.toFixed(2)}` : 'Included in total'}</span>
                    </div>
                    <div class="total-row">
                        <span>Tax:</span>
                        <span>${invoice.tax ? `${invoice.tax.toFixed(2)}` : 'As applicable'}</span>
                    </div>
                    <div class="total-row final-total">
                        <span>Total Paid:</span>
                        <span>${formattedAmount}</span>
                    </div>
                </div>
            </div>
            
            <div class="important-info">
                <h3>📋 Important Information</h3>
                <div class="info-item">
                    <span class="bullet">•</span>
                    <span>Payment confirmation and receipt available in vendor portal</span>
                </div>
                <div class="info-item">
                    <span class="bullet">•</span>
                    <span>Tax documents will be sent separately if applicable</span>
                </div>
                <div class="info-item">
                    <span class="bullet">•</span>
                    <span>Contact finance team for any payment-related queries</span>
                </div>
                <div class="info-item">
                    <span class="bullet">•</span>
                    <span>This transaction closes invoice #${invoice.invoiceNumber}</span>
                </div>
                <div class="info-item">
                    <span class="bullet">•</span>
                    <span>Thank you for your continued partnership</span>
                </div>
            </div>
            
            <center>
                <a href="${process.env.VENDOR_PORTAL_URL || '#'}" class="cta-button">
                    📄 Download Payment Receipt
                </a>
            </center>
            
            <p style="font-style: italic; color: #666; text-align: center;">If you have any questions about this payment or need additional documentation, please contact our finance team.</p>
        </div>
        
        <div class="footer">
            <p><strong>${process.env.EMAIL_FROM_NAME || 'NexusMWI'}</strong><br>
            Finance Department</p>
            <p style="font-size: 14px; margin-top: 15px;">
                Payment inquiries: ${process.env.SENDGRID_FROM_EMAIL}
            </p>
        </div>
    </div>
</body>
</html>
`;

    return { text: textContent.trim(), html: htmlContent.trim() };
};