const Invitation = require("../../models/invitation");
const User = require("../../models/user");
const crypto = require('crypto');

// Email service (using existing pattern from authController)
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Enhanced email notification function
const sendEmailNotification = async (userEmail, subject, message, isHtml = true) => {
    try {
        const mailOptions = {
            from: {
                name: process.env.EMAIL_FROM_NAME || 'NexusMWI',
                email: 'noreply@nexusmwi.com'
            },
            to: userEmail,
            subject: subject,
        };

        const containsHtml = /<[a-z][\s\S]*>/i.test(message);
        
        if (isHtml || containsHtml) {
            mailOptions.html = message;
            mailOptions.text = message.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        } else {
            mailOptions.text = message;
        }

        const [response] = await sgMail.send(mailOptions);
        console.log(`Email sent to ${userEmail}`);
        return response;
    } catch (error) {
        console.error("Email sending error:", error);
        throw error;
    }
};

// Helper function to extract device info from user agent
const parseUserAgent = (userAgent) => {
    if (!userAgent) return {};
    
    return {
        browser: userAgent.includes('Chrome') ? 'Chrome' : 
                userAgent.includes('Firefox') ? 'Firefox' : 
                userAgent.includes('Safari') ? 'Safari' : 'Other',
        os: userAgent.includes('Windows') ? 'Windows' :
            userAgent.includes('Mac') ? 'macOS' :
            userAgent.includes('Linux') ? 'Linux' :
            userAgent.includes('Android') ? 'Android' :
            userAgent.includes('iOS') ? 'iOS' : 'Other',
        device: userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'
    };
};

// Create new beta invitation
exports.createInvitation = async (req, res) => {
    try {
        console.log('Beta invitation request received:', req.body);
        
        const { 
            firstName, 
            lastName, 
            email, 
            company, 
            role, 
            useCase,
            industry,
            companySize,
            source,
            referralCode,
            utmSource,
            utmMedium,
            utmCampaign
        } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !company || !role) {
            return res.status(400).json({ 
                success: false,
                message: "All required fields must be provided",
                requiredFields: ['firstName', 'lastName', 'email', 'company', 'role']
            });
        }

        // Check if invitation already exists
        const existingInvitation = await Invitation.findOne({ email: email.toLowerCase() });
        if (existingInvitation) {
            return res.status(400).json({ 
                success: false,
                message: "An invitation with this email already exists",
                status: existingInvitation.status,
                createdAt: existingInvitation.createdAt
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ 
                success: false,
                message: "A user with this email already exists. Please sign in instead."
            });
        }

        // Get next queue position
        const queuePosition = await Invitation.getNextQueuePosition();

        // Extract device and location info
        const deviceInfo = parseUserAgent(req.headers['user-agent']);
        const ipAddress = req.ip || req.connection.remoteAddress;

        // Create new invitation
        const newInvitation = new Invitation({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.toLowerCase().trim(),
            company: company.trim(),
            role,
            useCase: useCase?.trim(),
            industry: industry?.trim(),
            companySize: companySize || '11-50',
            queuePosition,
            source: source || 'website',
            referralCode: referralCode?.trim(),
            utmSource: utmSource?.trim(),
            utmMedium: utmMedium?.trim(),
            utmCampaign: utmCampaign?.trim(),
            ipAddress,
            userAgent: req.headers['user-agent'],
            deviceInfo
        });

        // Set priority based on role and company size
        if (['ceo', 'cfo'].includes(role) || ['201-1000', '1000+'].includes(companySize)) {
            newInvitation.priority = 'high';
        } else if (['procurement', 'finance'].includes(role)) {
            newInvitation.priority = 'medium';
        } else {
            newInvitation.priority = 'low';
        }

        await newInvitation.save();

        // Send confirmation email
        try {
            const confirmationSubject = 'Thank you for your interest in NexusMWI Beta!';
            const confirmationMessage = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #3B82F6; margin-bottom: 10px;">Welcome to NexusMWI Beta!</h1>
                        <p style="color: #6B7280; font-size: 16px;">You're now on our exclusive waiting list</p>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
                        <h2 style="margin: 0 0 10px 0;">You're #${queuePosition} in line!</h2>
                        <p style="margin: 0; opacity: 0.9;">We'll notify you as soon as your beta access is ready</p>
                    </div>
                    
                    <div style="background-color: #F3F4F6; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                        <h3 style="color: #374151; margin-top: 0;">Your Application Details:</h3>
                        <ul style="color: #6B7280; line-height: 1.6;">
                            <li><strong>Name:</strong> ${firstName} ${lastName}</li>
                            <li><strong>Company:</strong> ${company}</li>
                            <li><strong>Role:</strong> ${role}</li>
                            <li><strong>Queue Position:</strong> #${queuePosition}</li>
                            <li><strong>Priority:</strong> ${newInvitation.priority.charAt(0).toUpperCase() + newInvitation.priority.slice(1)}</li>
                        </ul>
                    </div>
                    
                    <div style="border-left: 4px solid #10B981; padding-left: 20px; margin-bottom: 30px;">
                        <h3 style="color: #374151; margin-top: 0;">What happens next?</h3>
                        <ul style="color: #6B7280; line-height: 1.8;">
                            <li>Our team will review your application</li>
                            <li>You'll receive updates on your queue position</li>
                            <li>Beta access will be granted based on priority and availability</li>
                            <li>You'll get early access to cutting-edge procurement features</li>
                        </ul>
                    </div>
                    
                    <div style="text-align: center; padding: 20px; background-color: #F9FAFB; border-radius: 10px;">
                        <p style="color: #6B7280; margin: 0;">Questions? Reply to this email or contact us at <a href="mailto:beta@nexusmwi.com" style="color: #3B82F6;">beta@nexusmwi.com</a></p>
                    </div>
                </div>
            `;

            await sendEmailNotification(email, confirmationSubject, confirmationMessage);
            
            // Add email to history
            newInvitation.addEmailToHistory('confirmation', confirmationSubject, confirmationMessage);
            await newInvitation.save();

        } catch (emailError) {
            console.error('Failed to send confirmation email:', emailError);
            // Don't fail the invitation creation if email fails
        }

        // Send admin notification for high priority invitations
        if (newInvitation.priority === 'high') {
            try {
                const adminEmail = process.env.ADMIN_EMAIL || 'admin@nexusmwi.com';
                const adminSubject = `High Priority Beta Invitation - ${company}`;
                const adminMessage = `
                    <h2>High Priority Beta Invitation Received</h2>
                    <p><strong>Name:</strong> ${firstName} ${lastName}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Company:</strong> ${company}</p>
                    <p><strong>Role:</strong> ${role}</p>
                    <p><strong>Queue Position:</strong> #${queuePosition}</p>
                    <p><strong>Use Case:</strong> ${useCase || 'Not provided'}</p>
                    <p><a href="${process.env.ADMIN_DASHBOARD_URL}/invitations/${newInvitation._id}">Review Application</a></p>
                `;
                
                await sendEmailNotification(adminEmail, adminSubject, adminMessage);
            } catch (adminEmailError) {
                console.error('Failed to send admin notification:', adminEmailError);
            }
        }

        res.status(201).json({
            success: true,
            message: "Beta invitation submitted successfully! Check your email for confirmation.",
            data: {
                id: newInvitation._id,
                queuePosition: queuePosition,
                priority: newInvitation.priority,
                status: newInvitation.status,
                estimatedWaitTime: `${Math.ceil(queuePosition / 10)} weeks`
            }
        });

    } catch (error) {
        console.error("Error creating beta invitation:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to submit beta invitation",
            error: error.message 
        });
    }
};

// Get invitations with filtering and pagination
exports.getInvitations = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            priority,
            role,
            company,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object
        const filter = {};
        
        if (status) filter.status = status;
        if (priority) filter.priority = priority;
        if (role) filter.role = role;
        if (company) filter.company = new RegExp(company, 'i');
        
        if (search) {
            filter.$or = [
                { firstName: new RegExp(search, 'i') },
                { lastName: new RegExp(search, 'i') },
                { email: new RegExp(search, 'i') },
                { company: new RegExp(search, 'i') }
            ];
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Execute query with pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [invitations, totalCount] = await Promise.all([
            Invitation.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .populate('approvedBy', 'firstName lastName email')
                .populate('rejectedBy', 'firstName lastName email'),
            Invitation.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(totalCount / parseInt(limit));

        res.status(200).json({
            success: true,
            data: {
                invitations,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalCount,
                    hasNextPage: parseInt(page) < totalPages,
                    hasPrevPage: parseInt(page) > 1
                }
            }
        });

    } catch (error) {
        console.error("Error fetching invitations:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to fetch invitations",
            error: error.message 
        });
    }
};

// Get single invitation by ID
exports.getInvitationById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const invitation = await Invitation.findById(id)
            .populate('approvedBy', 'firstName lastName email')
            .populate('rejectedBy', 'firstName lastName email')
            .populate('convertedUserId', 'firstName lastName email');

        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: "Invitation not found"
            });
        }

        res.status(200).json({
            success: true,
            data: invitation
        });

    } catch (error) {
        console.error("Error fetching invitation:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to fetch invitation",
            error: error.message 
        });
    }
};

// Update invitation (admin only)
exports.updateInvitation = async (req, res) => {
    try {
        const { id } = req.params;
        const { priority, adminNotes, queuePosition } = req.body;
        
        const invitation = await Invitation.findById(id);
        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: "Invitation not found"
            });
        }

        // Update allowed fields
        if (priority) invitation.priority = priority;
        if (adminNotes !== undefined) invitation.adminNotes = adminNotes;
        if (queuePosition) invitation.queuePosition = queuePosition;

        await invitation.save();

        res.status(200).json({
            success: true,
            message: "Invitation updated successfully",
            data: invitation
        });

    } catch (error) {
        console.error("Error updating invitation:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to update invitation",
            error: error.message 
        });
    }
};

// Approve invitation and grant beta access
exports.approveInvitation = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user._id; // From auth middleware
        
        const invitation = await Invitation.findById(id);
        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: "Invitation not found"
            });
        }

        if (invitation.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot approve invitation with status: ${invitation.status}`
            });
        }

        // Update invitation status
        invitation.status = 'approved';
        invitation.approvedBy = adminId;
        invitation.approvedAt = new Date();
        invitation.betaAccessGranted = true;
        
        // Generate beta access token
        invitation.generateBetaAccessToken();
        
        await invitation.save();

        // Send approval email with beta access instructions
        try {
            const approvalSubject = 'Welcome to NexusMWI Beta - Your Access is Ready!';
            const betaAccessUrl = `${process.env.FRONTEND_URL}/beta-access?token=${invitation.betaAccessToken}`;
            
            const approvalMessage = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #10B981; margin-bottom: 10px;">🎉 You're In!</h1>
                        <p style="color: #6B7280; font-size: 18px;">Your NexusMWI Beta access is now active</p>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
                        <h2 style="margin: 0 0 15px 0;">Welcome to the Future of Procurement!</h2>
                        <p style="margin: 0 0 20px 0; opacity: 0.9;">You now have exclusive access to our beta platform</p>
                        <a href="${betaAccessUrl}" style="display: inline-block; background: white; color: #10B981; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Access Beta Platform</a>
                    </div>
                    
                    <div style="background-color: #F3F4F6; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                        <h3 style="color: #374151; margin-top: 0;">Your Beta Access Details:</h3>
                        <ul style="color: #6B7280; line-height: 1.6;">
                            <li><strong>Access Token:</strong> ${invitation.betaAccessToken}</li>
                            <li><strong>Valid Until:</strong> ${invitation.betaAccessExpires.toLocaleDateString()}</li>
                            <li><strong>Support Email:</strong> beta-support@nexusmwi.com</li>
                        </ul>
                    </div>
                    
                    <div style="border-left: 4px solid #3B82F6; padding-left: 20px; margin-bottom: 30px;">
                        <h3 style="color: #374151; margin-top: 0;">What's included in your beta access:</h3>
                        <ul style="color: #6B7280; line-height: 1.8;">
                            <li>Full access to the procurement platform</li>
                            <li>Advanced analytics and reporting</li>
                            <li>Priority customer support</li>
                            <li>Direct feedback channel to our product team</li>
                            <li>Early access to new features</li>
                            <li>Exclusive beta user community</li>
                        </ul>
                    </div>
                    
                    <div style="background-color: #FEF3C7; padding: 20px; border-radius: 10px; border-left: 4px solid #F59E0B;">
                        <h3 style="color: #92400E; margin-top: 0;">Important Notes:</h3>
                        <ul style="color: #92400E; line-height: 1.6;">
                            <li>This is a beta version - please report any issues</li>
                            <li>Your feedback is crucial for our development</li>
                            <li>Beta access expires on ${invitation.betaAccessExpires.toLocaleDateString()}</li>
                            <li>Keep your access token secure and don't share it</li>
                        </ul>
                    </div>
                </div>
            `;

            await sendEmailNotification(invitation.email, approvalSubject, approvalMessage);
            
            // Add email to history
            invitation.addEmailToHistory('approval', approvalSubject, approvalMessage);
            await invitation.save();

        } catch (emailError) {
            console.error('Failed to send approval email:', emailError);
        }

        res.status(200).json({
            success: true,
            message: "Invitation approved and beta access granted successfully",
            data: {
                id: invitation._id,
                status: invitation.status,
                betaAccessToken: invitation.betaAccessToken,
                betaAccessExpires: invitation.betaAccessExpires
            }
        });

    } catch (error) {
        console.error("Error approving invitation:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to approve invitation",
            error: error.message 
        });
    }
};

// Reject invitation
exports.rejectInvitation = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;
        const adminId = req.user._id;
        
        const invitation = await Invitation.findById(id);
        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: "Invitation not found"
            });
        }

        if (invitation.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot reject invitation with status: ${invitation.status}`
            });
        }

        // Update invitation status
        invitation.status = 'rejected';
        invitation.rejectedBy = adminId;
        invitation.rejectedAt = new Date();
        invitation.rejectionReason = rejectionReason;
        
        await invitation.save();

        // Send rejection email
        try {
            const rejectionSubject = 'Update on Your NexusMWI Beta Application';
            const rejectionMessage = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #374151;">Thank you for your interest in NexusMWI Beta</h2>
                    <p>Dear ${invitation.firstName},</p>
                    <p>Thank you for applying to our beta program. After careful review, we're unable to approve your application at this time.</p>
                    ${rejectionReason ? `<p><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
                    <p>We encourage you to apply again in the future when we open our next beta phase.</p>
                    <p>Stay updated on our public launch by following us on social media.</p>
                    <p>Best regards,<br/>The NexusMWI Team</p>
                </div>
            `;

            await sendEmailNotification(invitation.email, rejectionSubject, rejectionMessage);
            
            // Add email to history
            invitation.addEmailToHistory('rejection', rejectionSubject, rejectionMessage);
            await invitation.save();

        } catch (emailError) {
            console.error('Failed to send rejection email:', emailError);
        }

        res.status(200).json({
            success: true,
            message: "Invitation rejected successfully",
            data: invitation
        });

    } catch (error) {
        console.error("Error rejecting invitation:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to reject invitation",
            error: error.message 
        });
    }
};

// Get invitation statistics
exports.getStatistics = async (req, res) => {
    try {
        const stats = await Invitation.getStatistics();
        
        // Additional metrics
        const totalInvitations = await Invitation.countDocuments();
        const todayInvitations = await Invitation.countDocuments({
            createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        });
        const thisWeekInvitations = await Invitation.countDocuments({
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        });
        
        // Conversion rate
        const convertedCount = await Invitation.countDocuments({ convertedToUser: true });
        const conversionRate = totalInvitations > 0 ? (convertedCount / totalInvitations * 100).toFixed(2) : 0;
        
        // Queue metrics
        const avgQueuePosition = await Invitation.aggregate([
            { $match: { status: 'pending' } },
            { $group: { _id: null, avgPosition: { $avg: '$queuePosition' } } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                ...stats,
                summary: {
                    total: totalInvitations,
                    today: todayInvitations,
                    thisWeek: thisWeekInvitations,
                    conversionRate: `${conversionRate}%`,
                    avgQueuePosition: avgQueuePosition[0]?.avgPosition || 0
                }
            }
        });

    } catch (error) {
        console.error("Error fetching statistics:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to fetch statistics",
            error: error.message 
        });
    }
};

// Verify beta access token
exports.verifyBetaAccess = async (req, res) => {
    try {
        const { token } = req.params;
        
        const invitation = await Invitation.findOne({ betaAccessToken: token });
        
        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: "Invalid beta access token"
            });
        }

        if (!invitation.isBetaAccessValid()) {
            return res.status(400).json({
                success: false,
                message: "Beta access token has expired or is not active"
            });
        }

        res.status(200).json({
            success: true,
            message: "Beta access token is valid",
            data: {
                firstName: invitation.firstName,
                lastName: invitation.lastName,
                email: invitation.email,
                company: invitation.company,
                expiresAt: invitation.betaAccessExpires
            }
        });

    } catch (error) {
        console.error("Error verifying beta access:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to verify beta access",
            error: error.message 
        });
    }
};

// Cleanup expired beta access (cron job endpoint)
exports.cleanupExpiredAccess = async (req, res) => {
    try {
        const result = await Invitation.cleanupExpiredBetaAccess();
        
        res.status(200).json({
            success: true,
            message: `Cleaned up ${result.modifiedCount} expired beta access invitations`,
            data: result
        });

    } catch (error) {
        console.error("Error cleaning up expired access:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to cleanup expired access",
            error: error.message 
        });
    }
};

// Bulk approve invitations (admin only)
exports.bulkApprove = async (req, res) => {
    try {
        const { invitationIds } = req.body;
        const adminId = req.user._id;
        
        if (!Array.isArray(invitationIds) || invitationIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invitation IDs array is required"
            });
        }

        const results = [];
        
        for (const id of invitationIds) {
            try {
                const invitation = await Invitation.findById(id);
                if (invitation && invitation.status === 'pending') {
                    invitation.status = 'approved';
                    invitation.approvedBy = adminId;
                    invitation.approvedAt = new Date();
                    invitation.betaAccessGranted = true;
                    invitation.generateBetaAccessToken();
                    
                    await invitation.save();
                    results.push({ id, status: 'approved' });
                } else {
                    results.push({ id, status: 'skipped', reason: 'Not found or not pending' });
                }
            } catch (error) {
                results.push({ id, status: 'error', reason: error.message });
            }
        }

        res.status(200).json({
            success: true,
            message: "Bulk approval completed",
            data: results
        });

    } catch (error) {
        console.error("Error in bulk approval:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to process bulk approval",
            error: error.message 
        });
    }
};