const User = require("../../models/user");
const Department = require('../../models/departments');
const Company = require("../../models/company");
const jwt = require("jsonwebtoken");
const twilio = require('twilio');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const postmark = require('postmark');     
//const {sendEmailNotification} = require("../services/notificationService");


function generatedSecurePassword() {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
  let password = "";
  for (let i = 0; i < 16; i++) { // 16 characters for better security
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
}

// Twilio setup
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);


const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);


const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate password reset token (expires in 1 hour)
const generatePasswordResetToken = (user) => {
    return jwt.sign(
        { id: user._id },
        process.env.JWT_RESET_SECRET,
        { expiresIn: '1h' }
    );
};

// Generate JWT
const generateToken = (user) => {
    return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// Generate Access Token (short expiry)
const generateAccessToken = (user) => {
    return jwt.sign(
        { id: user._id, role: user.role }, 
        process.env.JWT_SECRET, 
        { expiresIn: "15m" } // 15 minutes
    );
};

// Generate Refresh Token (long expiry)
const generateRefreshToken = (user) => {
    return jwt.sign(
        { id: user._id, role: user.role }, 
        process.env.JWT_REFRESH_SECRET, 
        { expiresIn: "7d" } // 7 days
    );
};

// Configure storage for avatars
const avatarStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    const dir = './uploads/avatars';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    const userId = req.user.id;
    const timestamp = Date.now();
    const fileExt = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar_${userId}_${timestamp}${fileExt}`);
  }
});

// File filter for avatars
const avatarFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg', 
    'image/png', 
    'image/gif', 
    'image/webp',
    'image/jpg'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Please upload JPEG, PNG, GIF, or WebP files only.'), false);
  }
};

// Multer middleware for avatar upload
const uploadAvatarMiddleware = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  },
  fileFilter: avatarFileFilter,
}).single('avatar');


// Send password reset email
const sendPasswordResetEmail = async (user, resetToken) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'NyasaTech'}" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: 'Password Reset Request',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
                <h2 style="color: #333;">Password Reset Request</h2>
                <p>Hello ${user.firstName || 'there'},</p>
                <p>We received a request to reset your password. Click the button below to reset it:</p>
                <div style="margin: 20px 0; text-align: center;">
                    <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
                </div>
                <p>This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.</p>
                <p>Alternatively, you can copy and paste this link into your browser:</p>
                <p style="word-break: break-all;">${resetUrl}</p>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
};

const sendEmailNotification = async (userEmail, subject, message, isHtml = true) => {
    try {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: subject,
        };

        // Detect if message contains HTML tags
        const containsHtml = /<[a-z][\s\S]*>/i.test(message);
        
        if (isHtml || containsHtml) {
            // Send as HTML email
            mailOptions.html = message;
            
            // Also provide a plain text version for better compatibility
            mailOptions.text = message.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        } else {
            // Send as plain text
            mailOptions.text = message;
        }

        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${userEmail} (${isHtml || containsHtml ? 'HTML' : 'Text'} format)`); 
    } catch (error) {
        console.error("Nodemailer email sending error:", error);
        throw error; // Re-throw so we can handle it in the calling function
    }
};


// =======================
// PROFILE MANAGEMENT ENDPOINTS
// =======================

// Get user profile
exports.getProfile = async (req, res) => {
    try {
        const userId = req.user._id; // From auth middleware
        
        const user = await User.findById(userId).select('-password -verificationCode -emailVerificationCode -refreshToken');
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        res.status(200).json({
            success: true,
            user: user // Remove .getPublicProfile() call
        });
        
    } catch (err) {
        console.error("Error in getProfile:", err);
        res.status(500).json({ 
            message: "Failed to fetch profile", 
            error: err.message 
        });
    }
};

// Update user profile
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user._id; // From auth middleware
        const updateData = req.body;
        console.log(req.body);
        
        // Fields that can be updated
        const allowedUpdates = [
            'firstName', 'lastName', 'phone', 'address', 'city', 'state', 
            'zipCode', 'country', 'company', 'jobTitle', 'bio', 'website', 
            'linkedin', 'twitter'
        ];
        
        // Filter out non-allowed fields
        const filteredUpdates = {};
        allowedUpdates.forEach(field => {
            if (updateData[field] !== undefined) {
                filteredUpdates[field] = updateData[field];
            }
        });
        
        // Add updatedAt timestamp
        filteredUpdates.updatedAt = Date.now();
        
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            filteredUpdates,
            { 
                new: true, 
                runValidators: true,
                select: '-password -verificationCode -emailVerificationCode -refreshToken'
            }
        );
        
        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }
        
        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user: updatedUser // Remove .getPublicProfile() call
        });
        
    } catch (err) {
        console.error("Error in updateProfile:", err);
        res.status(500).json({ 
            message: "Failed to update profile", 
            error: err.message 
        });
    }
};

// Update security settings
exports.updateSecuritySettings = async (req, res) => {
    try {
        const userId = req.user._id;
        const { twoFactorEnabled, loginNotifications, activityNotifications } = req.body;
        
        const updateData = {};
        
        if (typeof twoFactorEnabled === 'boolean') {
            updateData.twoFactorEnabled = twoFactorEnabled;
        }
        if (typeof loginNotifications === 'boolean') {
            updateData.loginNotifications = loginNotifications;
        }
        if (typeof activityNotifications === 'boolean') {
            updateData.activityNotifications = activityNotifications;
        }
        
        updateData.updatedAt = Date.now();
        
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { 
                new: true,
                select: '-password -verificationCode -emailVerificationCode -refreshToken'
            }
        );
        
        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }
        
        res.status(200).json({
            success: true,
            message: "Security settings updated successfully",
            user: updatedUser // Remove .getPublicProfile() call
        });
        
    } catch (err) {
        console.error("Error in updateSecuritySettings:", err);
        res.status(500).json({ 
            message: "Failed to update security settings", 
            error: err.message 
        });
    }
};

// Change password
exports.changePassword = async (req, res) => {
  console.log(req.body);
    try {
        const userId = req.user._id;
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                message: "Current password and new password are required" 
            });
        }
        
        // Find user with password field
        const user = await User.findById(userId).select('+password');
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Verify current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }
        
        // Validate new password strength
        if (newPassword.length < 8) {
            return res.status(400).json({ 
                message: "New password must be at least 8 characters long" 
            });
        }
        
        // Update password
        user.password = newPassword;
        user.updatedAt = Date.now();
        await user.save();
        
        // Optionally send notification email
        try {
            await sendEmailNotification(
                user.email,
                "Password Changed Successfully",
                "Your password has been successfully updated."
            );
        } catch (emailError) {
            console.error("Password change notification email failed:", emailError);
        }
        
        res.status(200).json({
            success: true,
            message: "Password changed successfully"
        });
        
    } catch (err) {
        console.error("Error in changePassword:", err);
        res.status(500).json({ 
            message: "Failed to change password", 
            error: err.message 
        });
    }
};

// Update email (requires verification)
exports.updateEmail = async (req, res) => {
    try {
        const userId = req.user._id;
        const { newEmail, password } = req.body;
        
        if (!newEmail || !password) {
            return res.status(400).json({ 
                message: "New email and password are required" 
            });
        }
        
        // Find user with password field
        const user = await User.findById(userId).select('+password');
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Verify password
        const isPasswordValid = await user.comparePassword(password);
        
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Password is incorrect" });
        }
        
        // Check if new email is already in use
        const existingUser = await User.findOne({ email: newEmail });
        if (existingUser && existingUser._id.toString() !== userId) {
            return res.status(400).json({ message: "Email is already in use" });
        }
        
        // Generate verification code for new email
        const verificationCode = generateVerificationCode();
        
        // Update user with new email (unverified) and verification code
        user.email = newEmail;
        user.isEmailVerified = false;
        user.emailVerificationCode = verificationCode;
        user.emailVerificationCodeExpires = Date.now() + 3600000; // 1 hour
        user.updatedAt = Date.now();
        
        await user.save();
        
        // Send verification email to new email address
        try {
            await sendVerificationEmail(user, verificationCode);
            
            res.status(200).json({
                success: true,
                message: "Email updated. Please verify your new email address.",
                email: newEmail
            });
        } catch (emailError) {
            console.error("Email verification sending failed:", emailError);
            res.status(500).json({ 
                message: "Email updated but verification email failed to send" 
            });
        }
        
    } catch (err) {
        console.error("Error in updateEmail:", err);
        res.status(500).json({ 
            message: "Failed to update email", 
            error: err.message 
        });
    }
};

// Get user statistics/analytics
exports.getUserStats = async (req, res) => {
    try {
        const userId = req.user._id;
        
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Mock stats - replace with actual data from your application
        const stats = {
            totalTransactions: 247,
            totalSpent: 125420,
            averageTransactionValue: 508,
            accountAge: Math.floor((Date.now() - user.createdAt) / (1000 * 60 * 60 * 24)), // days
            completedProjects: 32,
            successRate: 98.5,
            currentStreak: 45,
            achievementPoints: 2840,
            lastLoginAt: user.lastLoginAt,
            memberSince: user.createdAt
        };
        
        res.status(200).json({
            success: true,
            stats
        });
        
    } catch (err) {
        console.error("Error in getUserStats:", err);
        res.status(500).json({ 
            message: "Failed to fetch user statistics", 
            error: err.message 
        });
    }
};

// Delete user account
exports.deleteAccount = async (req, res) => {
    try {
        const userId = req.user._id;
        const { password, confirmDeletion } = req.body;
        
        if (!password || confirmDeletion !== 'DELETE') {
            return res.status(400).json({ 
                message: "Password and deletion confirmation are required" 
            });
        }
        
        // Find user with password field
        const user = await User.findById(userId).select('+password');
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Verify password
        const isPasswordValid = await user.comparePassword(password);
        
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Password is incorrect" });
        }
        
        // Delete user account
        await User.findByIdAndDelete(userId);
        
        // Clean up uploaded files
        try {
            if (user.avatar && fs.existsSync(user.avatar)) {
                fs.unlinkSync(user.avatar);
            }
            if (user.companyLogo && fs.existsSync(user.companyLogo)) {
                fs.unlinkSync(user.companyLogo);
            }
            if (user.signature && fs.existsSync(user.signature)) {
                fs.unlinkSync(user.signature);
            }
        } catch (fileError) {
            console.error("Error cleaning up files:", fileError);
        }
        
        res.status(200).json({
            success: true,
            message: "Account deleted successfully"
        });
        
    } catch (err) {
        console.error("Error in deleteAccount:", err);
        res.status(500).json({ 
            message: "Failed to delete account", 
            error: err.message 
        });
    }
};


// Request password reset (sends email with reset link)
exports.requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            // For security, don't reveal if user doesn't exist
            return res.status(200).json({ 
                message: "If an account with that email exists, a password reset link has been sent"
            });
        }

        // Generate reset token
        const resetToken = generatePasswordResetToken(user);
        
        // Send email with reset link
        try {
            await sendPasswordResetEmail(user, resetToken);
            return res.status(200).json({ 
                message: "If an account with that email exists, a password reset link has been sent",
                email: email
            });
        } catch (emailError) {
            console.error("Password reset email error:", emailError);
            return res.status(500).json({ 
                message: "Failed to send password reset email" 
            });
        }

    } catch (err) {
        console.error("Error in requestPasswordReset:", err);
        res.status(500).json({ 
            message: err.message || "Failed to process password reset request" 
        });
    }
};


// Reset password (using token from email)
exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ 
                message: "Reset token and new password are required" 
            });
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_RESET_SECRET);
        } catch (error) {
            return res.status(400).json({ 
                message: "Invalid or expired reset token" 
            });
        }

        // Find user
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(400).json({ 
                message: "User not found" 
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        // Optionally send confirmation email
        try {
            await sendEmailNotification(
                user.email,
                "Password Changed Successfully",
                "Your password has been successfully updated."
            );
        } catch (emailError) {
            console.error("Password change confirmation email failed:", emailError);
            // Continue even if confirmation email fails
        }

        return res.status(200).json({ 
            message: "Password reset successfully" 
        });

    } catch (err) {
        console.error("Error in resetPassword:", err);
        res.status(500).json({ 
            message: err.message || "Failed to reset password" 
        });
    }
};

// Send verification email
const sendVerificationEmail = async (user, verificationCode) => {
  // Email template
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'NexusMWI'}" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: 'Email Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h2 style="color: #333;">Verify Your Email</h2>
        <p>Hello ${user.firstName || 'there'},</p>
        <p>Your verification code is:</p>
        <div style="padding: 10px; background-color: #f5f5f5; font-size: 24px; text-align: center; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${verificationCode}
        </div>
        <p>This code will expire in 1 hour.</p>
        <p>If you didn't request this code, please ignore this email.</p>
      </div>
    `
  };

  // Send the email
  return transporter.sendMail(mailOptions);
};

// Send verification SMS
exports.sendVerification = async (req, res) => {
    try {
      const { phoneNumber } = req.body;
  
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }
  
      // Find the user by phone number
      const user = await User.findOne({ phoneNumber }).select('phoneNumber verificationCode');
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      // Generate verification code
      const verificationCode = generateVerificationCode();
      user.verificationCode = verificationCode;
      await user.save({ validateBeforeSave: false });
  
      // Send SMS via Twilio
      try {
        await twilioClient.messages.create({
          body: `Your verification code is: ${verificationCode}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber
        });
  
        res.status(200).json({ 
          message: "Verification code sent successfully",
          phoneNumber: phoneNumber 
        });
      } catch (smsError) {
        console.error("Twilio SMS error:", smsError);
        throw new Error("Failed to send SMS");
      }
  
    } catch (err) {
      console.error("Error in sendVerification:", err);
      res.status(500).json({ 
        message: err.message || "Failed to send verification code" 
      });
    }
};

// Send verification email
exports.sendEmailVerification = async (req, res) => {
  try {
    console.log('\n🐛 DEBUG: Email verification request started');
    console.log('📨 Request body:', req.body);
    
    const { email } = req.body;

    if (!email) {
      console.log('❌ DEBUG: No email provided in request');
      return res.status(400).json({ message: "Email is required" });
    }

    console.log('📧 DEBUG: Target email:', email);

    // Verify environment variables
    console.log('🔍 DEBUG: Environment variables check:');
    console.log('- SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? 'SET' : 'NOT SET');

    if (!process.env.SENDGRID_API_KEY) {
      console.log('❌ DEBUG: SendGrid API key missing');
      return res.status(500).json({ 
        message: "Email service not configured properly",
        debug: {
          sendGridConfigured: !!process.env.SENDGRID_API_KEY
        }
      });
    }

    // Find the user by email
    console.log('🔍 DEBUG: Looking for user with email:', email);
    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ DEBUG: User not found with email:', email);
      return res.status(404).json({ message: "User not found" });
    }

    console.log('✅ DEBUG: User found:', user.firstName, user.lastName);

    // Generate verification code
    const verificationCode = generateVerificationCode();
    console.log('🔑 DEBUG: Generated verification code:', verificationCode);
    
    user.emailVerificationCode = verificationCode;
    user.emailVerificationExpires = Date.now() + 3600000; // 1 hour
    await user.save({ validateBeforeSave: false });

    console.log('💾 DEBUG: User updated with verification code');

    // Prepare email
    const msg = {
      to: email,
      from: {
        name: 'NexusMWI',
        email: 'noreply@nexusmwi.com' // Must be verified in SendGrid
      },
      subject: 'Email Verification Code - NexusMWI',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <h2 style="color: #333;">Verify Your Email</h2>
          <p>Hello ${user.firstName || 'there'},</p>
          <p>Your verification code is:</p>
          <div style="padding: 15px; background-color: #f5f5f5; font-size: 32px; text-align: center; font-weight: bold; letter-spacing: 8px; margin: 30px 0; border-radius: 8px; border: 2px solid #007bff;">
            ${verificationCode}
          </div>
          <p>This code will expire in 1 hour.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `,
      text: `Your verification code is: ${verificationCode}\nThis code will expire in 1 hour.`
    };

    console.log('📤 DEBUG: Sending email with options:', {
      to: msg.to,
      subject: msg.subject
    });

    // Send email via SendGrid API
    try {
      const [response] = await sgMail.send(msg);
      
      console.log('✅ DEBUG: Email sent successfully!');
      console.log('📨 SendGrid Response:', {
        statusCode: response.statusCode,
        headers: response.headers,
        body: response.body
      });

      res.status(200).json({ 
        message: "Verification code sent to your email successfully",
        email: email,
        debug: {
          method: 'SendGrid API',
          status: response.statusCode
        }
      });

    } catch (sendGridError) {
      console.error('❌ DEBUG: SendGrid failed with error:', sendGridError.message);
      console.error('📊 SendGrid Error details:', {
        code: sendGridError.code,
        response: sendGridError.response,
        stack: sendGridError.stack
      });

      // Clean up verification code since email failed
      user.emailVerificationCode = undefined;
      user.emailVerificationExpires = undefined;
      await user.save({ validateBeforeSave: false });
      
      res.status(500).json({
        message: "Failed to send verification email",
        error: sendGridError.message,
        debug: {
          sendGridError: {
            code: sendGridError.code,
            response: sendGridError.response
          }
        }
      });
    }

  } catch (err) {
    console.error("❌ DEBUG: General error in sendEmailVerification:", err);
    console.error("📊 Error stack:", err.stack);
    
    res.status(500).json({ 
      message: err.message || "Failed to send email verification code",
      debug: {
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      }
    });
  }
};

// Verify email with code
exports.verifyEmail = async (req, res) => {
  try {
    console.log("Incoming Email Verification Request:", req.body);
    console.log("Request body:", req.body);
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: "Email and verification code are required" });
    }

    // Find user by email
    const user = await User.findOne({ 
      email,
      emailVerificationCode: code,
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }
    

    // Mark email as verified and clear verification code
    user.isEmailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    // Generate JWT token (if needed)
    const token = generateToken(user);

    res.status(200).json({ 
      message: "Email verified successfully",
      isEmailVerified: true,
      user: { id: user._id, email: user.email },
      token 
    });

  } catch (err) {
    console.error("Error in verifyEmail:", err);
    res.status(500).json({ 
      message: err.message || "Failed to verify email" 
    });
  }
};

// Resend email verification code
exports.resendEmailVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate a new verification code
    const verificationCode = generateVerificationCode();
    user.emailVerificationCode = verificationCode;
    user.emailVerificationExpires = Date.now() + 3600000; // 1 hour
    await user.save({ validateBeforeSave: false });

    // Send email
    try {
      await sendVerificationEmail(user, verificationCode);

      res.status(200).json({ 
        message: "New verification code sent to your email",
        email: email
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      throw new Error("Failed to send verification email");
    }

  } catch (err) {
    console.error("Error in resendEmailVerification:", err);
    res.status(500).json({ 
      message: err.message || "Failed to resend email verification code" 
    });
  }
};

exports.resendVerification = async (req, res) => {
    try {
      const { phoneNumber } = req.body;
  
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }
  
      // Find the user by phone number
      const user = await User.findOne({ phoneNumber });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      // Generate a new verification code
      const verificationCode = generateVerificationCode();
  
      // Update the user document with new code
      user.verificationCode = verificationCode;
      await user.save();
  
      // Send SMS via Twilio
      try {
        await twilioClient.messages.create({
          body: `Your new verification code is: ${verificationCode}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber
        });
  
        res.status(200).json({ 
          message: "New verification code sent successfully",
          phoneNumber: phoneNumber
        });
      } catch (smsError) {
        console.error("Twilio SMS error:", smsError);
        throw new Error("Failed to resend SMS");
      }
  
    } catch (err) {
      console.error("Error in resendVerification:", err);
      res.status(500).json({ 
        message: err.message || "Failed to resend verification code" 
      });
    }
};

// Verify the phone number with the code
exports.verifyPhone = async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
      return res.status(400).json({ message: "Phone number and code are required" });
    }

    // ✅ Find user by phoneNumber (not by ID)
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if code matches
    if (user.verificationCode !== code) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    // Mark user as verified and clear the verification code
    user.isVerified = true;
    user.verificationCode = null;
    await user.save({ validateBeforeSave: false });

    // Generate JWT token (if needed)
    const token = generateToken(user); // Ensure `generateToken` is defined

    res.status(200).json({ 
      message: "Phone number verified successfully",
      isVerified: true,
      user: { id: user._id, email: user.email },
      token // Include token if generated
    });

  } catch (err) {
    console.error("Error in verifyPhone:", err);
    res.status(500).json({ 
      message: err.message || "Failed to verify phone number" 
    });
  }
};

// Send verification SMS (Simulation)
exports.sendVerificationTest = async (req, res) => {
  console.log(req.body);
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Find the user by phone number - changed from findById to findOne
    const user = await User.findOne({ phoneNumber }).select('phoneNumber verificationCode');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    user.verificationCode = verificationCode;
    await user.save({ validateBeforeSave: false });

    // Simulate sending SMS
    console.log(`Simulated SMS to ${phoneNumber}: Your verification code is ${verificationCode}`);

    res.status(200).json({
      message: "Verification code 'sent' successfully (simulation)",
      verificationCode, // Send it back in response for testing only
      phoneNumber
    });

  } catch (err) {
    console.error("Error in sendVerification (simulation):", err);
    res.status(500).json({
      message: err.message || "Failed to send verification code (simulation)"
    });
  }
};

// Email verification test (Simulation)
exports.sendEmailVerificationTest = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    user.emailVerificationCode = verificationCode;
    user.emailVerificationExpires = Date.now() + 3600000; // 1 hour
    await user.save({ validateBeforeSave: false });

    // Simulate sending email
    console.log(`Simulated Email to ${email}: Your verification code is ${verificationCode}`);

    res.status(200).json({
      message: "Email verification code 'sent' successfully (simulation)",
      verificationCode, // Send it back in response for testing only
      email
    });

  } catch (err) {
    console.error("Error in sendEmailVerification (simulation):", err);
    res.status(500).json({
      message: err.message || "Failed to send email verification code (simulation)"
    });
  }
};

// Register endpoint for enterprise users
exports.register = async (req, res) => {
  try {
    console.log("Incoming Register Request:", req.body);

    const {
      firstName,
      lastName,
      email,
      password,
      companyName,
      industry,
      domain,
      phoneNumber,
      role,
      isGoogleSignup = false
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !companyName || !industry || !phoneNumber || !role) {
      return res.status(400).json({
        message: "All fields are required",
        requiredFields: [
          'firstName',
          'lastName',
          'email',
          'companyName',
          'industry',
          'phoneNumber',
          'role'
        ]
      });
    }

    // For non-Google signups, password is required
    if (!isGoogleSignup && !password) {
      return res.status(400).json({ message: "Password is required" });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Validate phone number format
    if (!/^\+?\d{10,15}$/.test(phoneNumber)) {
      return res.status(400).json({ message: "Invalid phone number format" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Check if company exists
    let company = await Company.findOne({ 
      $or: [
        { name: companyName },
        { domain }
      ]
    });

    if (!company) {
      // Create new company
      company = await Company.create({
        name: companyName,
        industry,
        domain: domain || companyName.toLowerCase().replace(/\s+/g, '-') + '.com'
      });
    }

    // Calculate trial dates
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(now.getDate() + 7);

    let userPassword = password;
    let generatedPassword = null;

    if (isGoogleSignup) {
      // Generate a random password for Google signups
      generatedPassword = generateSecurePassword();
      userPassword = generatedPassword;
    }

    // Create new user - DIFFERENT VERIFICATION STATUS BASED ON SIGNUP TYPE
    const isFirstUser = company.usersCount === 0;
    const newUser = await User.create({
      firstName,
      lastName,
      email,
      password: userPassword,
      phoneNumber,
      company: company._id,
      companyName,
      industry,
      role,
      isEnterpriseAdmin: isFirstUser,
      // ✅ Google users are auto-verified, normal users need email verification
      isVerified: isGoogleSignup, // Google users are verified immediately
      isEmailVerified: isGoogleSignup, // Google users have verified email
      verificationCode: null,
      // Normal users need email verification code
      emailVerificationCode: isGoogleSignup ? null : generateVerificationCode(),
      emailVerificationExpires: isGoogleSignup ? null : Date.now() + 3600000, // 1 hour
      billing: {
        subscription: {
          plan: 'trial',
          status: 'trialing'
        },
        trialStartDate: now,
        trialEndDate: trialEnd
      }
    });

    // Update company with new user count
    await Company.findByIdAndUpdate(company._id, {
      $inc: { usersCount: 1 }
    });

    // Generate token
    const token = generateToken(newUser);

    // Handle different flows based on signup type
    if (isGoogleSignup) {
      // Google signup: Send password email and auto-login
      if (generatedPassword) {
        try {
          await sendGoogleSignupPasswordEmail(email, firstName, generatedPassword);
          console.log("✅ Google signup password email sent successfully");
        } catch (emailError) {
          console.error("❌ Google signup email failed:", emailError);
          // Don't fail registration if email fails
        }
      }

      // Respond for Google signup - immediate access
      return res.status(201).json({
        message: "Registration successful. Your password has been sent to your email.",
        user: {
          id: newUser._id,
          firstName,
          lastName,
          email,
          company: company.name,
          role: newUser.role,
          isEnterpriseAdmin: newUser.isEnterpriseAdmin,
          isVerified: true,
          isEmailVerified: true
        },
        token,
        nextStep: "complete_onboarding"
      });

    } else {
      // Normal signup: Send email verification
      try {
        await sendVerificationEmail(newUser, newUser.emailVerificationCode);
        console.log("✅ Normal signup verification email sent");

        // Respond for normal signup - needs verification
        return res.status(201).json({
          message: "Registration successful. Verification code sent to your email.",
          user: {
            id: newUser._id,
            firstName,
            lastName,
            email,
            company: company.name,
            role: newUser.role,
            isEnterpriseAdmin: newUser.isEnterpriseAdmin,
            isVerified: false,
            isEmailVerified: false
          },
          token,
          nextStep: "verify_email"
        });

      } catch (emailError) {
        console.error("❌ Normal signup verification email failed:", emailError);
        
        // Even if email fails, user is created but needs manual verification
        return res.status(201).json({
          message: "Registration successful but verification email failed. Please contact support.",
          user: {
            id: newUser._id,
            firstName,
            lastName,
            email,
            company: company.name,
            role: newUser.role,
            isEnterpriseAdmin: newUser.isEnterpriseAdmin,
            isVerified: false,
            isEmailVerified: false
          },
          token,
          nextStep: "verify_email"
        });
      }
    }

  } catch (err) {
    console.error("Error during registration:", err);
    
    // Handle duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ 
        message: `${field} already exists`,
        field
      });
    }
    
    res.status(500).json({ 
      message: "Server error during registration",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

async function sendGoogleSignupPasswordEmail(email, firstName, password) {
  console.log('📧 Starting email send process...');
  
  // Check if required environment variables are set
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Email credentials not configured');
    throw new Error('Email service not configured');
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@yourdomain.com',
    to: email,
    subject: 'Your Account Password - Google Signup',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .password-box { background: #fff; border: 2px dashed #667eea; padding: 15px; margin: 20px 0; text-align: center; font-family: monospace; font-size: 18px; font-weight: bold; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Our Platform!</h1>
          </div>
          <div class="content">
            <h2>Hello ${firstName},</h2>
            <p>Thank you for signing up using Google authentication. Your account has been successfully created!</p>
            
            <p>We've generated a secure password for your account that you can use to log in with your email and password in the future:</p>
            
            <div class="password-box">
              ${password}
            </div>
            
            <div class="warning">
              <strong>Important:</strong> Please save this password securely. You can change it later in your account settings.
            </div>
            
            <p>You can use this password to:</p>
            <ul>
              <li>Log in with email and password</li>
              <li>Access your account if Google sign-in is unavailable</li>
              <li>Change to a password you prefer in account settings</li>
            </ul>
            
            <p>To get started, you can:</p>
            <ol>
              <li>Continue using Google Sign-in for quick access</li>
              <li>Use your email and the password above</li>
              <li>Change your password in Account Settings for better security</li>
            </ol>
            
            <p>If you have any questions, please contact our support team.</p>
            
            <p>Best regards,<br>The Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    console.log('📧 Creating email transporter...');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    console.log('📧 Sending email...');
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    throw error;
  }
}

exports.googleLogin = async (req, res) => {
  try {
    console.log("Incoming Google Login Request:", req.body);

    const { email, firstName, lastName, googleId, companyName, industry, role } = req.body;

    // Validate required field (email at minimum)
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      // ✅ User already exists → login
      const token = generateToken(user);
      return res.status(200).json({
        exists: true,
        message: "Login successful",
        user,
        token,
      });
    }

    // ❌ User does not exist → let frontend continue registration
    // If you want backend to auto-create user directly, uncomment the block below
    /*
    let company = await Company.findOne({ name: companyName });
    if (!company && companyName) {
      company = await Company.create({
        name: companyName,
        industry,
        domain: companyName.toLowerCase().replace(/\s+/g, "-") + ".com",
      });
    }

    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(now.getDate() + 14);

    user = await User.create({
      firstName,
      lastName,
      email,
      googleId,
      company: company ? company._id : null,
      companyName: company ? company.name : null,
      industry,
      role: role || "Other",
      isEnterpriseAdmin: company ? company.usersCount === 0 : false,
      isVerified: true, // ✅ Google verified
      isEmailVerified: true,
      billing: {
        subscription: {
          plan: "trial",
          status: "trialing",
        },
        trialStartDate: now,
        trialEndDate: trialEnd,
      },
    });

    if (company) {
      await Company.findByIdAndUpdate(company._id, { $inc: { usersCount: 1 } });
    }

    const token = generateToken(user);

    return res.status(201).json({
      exists: true,
      message: "Google signup successful",
      user: {
        id: user._id,
        firstName,
        lastName,
        email,
        company: user.companyName,
        role: user.role,
        isEnterpriseAdmin: user.isEnterpriseAdmin,
      },
      token,
    });
    */

    return res.status(200).json({
      exists: false,
      message: "User not found. Continue registration",
    });
  } catch (err) {
    console.error("Error during Google login:", err);
    res.status(500).json({
      message: "Server error during Google login",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// authController.js - Enhanced login with debugging
exports.login = async (req, res) => {
  try {
      console.log('Login request received');
      console.log('Request body:', req.body);
      
      const { email, password } = req.body;
      
      if (!email || !password) {
          console.log('Missing credentials');
          return res.status(400).json({ message: "Email and password are required" });
      }
      
      console.log('Looking for user with email:', email);
      
      // Explicitly select the password field
      const user = await User.findOne({ email }).select('+password +isEnterpriseAdmin +company');

      
      console.log('User found:', !!user);
      
      if (!user) {
          console.log('User not found');
          return res.status(401).json({ message: "Invalid credentials" });
      }

      console.log('User details:');
      console.log('- Email:', user.email);
      console.log('- Role:', user.role);
      console.log('- Has password:', !!user.password);
      console.log('- Password hash:', user.password);
      console.log('- Is verified:', user.isVerified);
      console.log('- Is email verified:', user.isEmailVerified);

      // Add validation
      if (!user.password) {
          console.log('User password missing');
          return res.status(401).json({ 
              message: "Account not properly configured" 
          });
      }

      console.log('Comparing passwords...');
      const isMatch = await user.comparePassword(password);
       console.log('Input password:', password);
      console.log('Password match result:', isMatch);
      
      if (!isMatch) {
          console.log('Password does not match');
          // Additional debug - try manual comparison
          try {
              const manualMatch = await bcrypt.compare(password, user.password);
              console.log('Manual bcrypt.compare result:', manualMatch);
          } catch (bcryptError) {
              console.error('Bcrypt compare error:', bcryptError);
          }
          return res.status(401).json({ message: "Invalid credentials" });
      }

      console.log('Login successful, generating token...');
      
      // Generate token
      const token = generateToken(user);
      console.log('Token generated');

      // Remove password from response
      user.password = undefined;
      
      console.log('Sending response...');
      res.status(200).json({ token,  user: {
        // Include all necessary fields
        ...user.toObject(),
        isEnterpriseAdmin: user.isEnterpriseAdmin,
        company: user.company
      } });
      
  } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ 
          message: "Login failed", 
          error: err.message 
      });
  }
};

// Refresh Token Endpoint
exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(401).json({ message: "Refresh token required" });
        }

        // Verify refresh token
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        } catch (error) {
            return res.status(401).json({ message: "Invalid refresh token" });
        }

        // Find user and check if refresh token matches
        const user = await User.findById(decoded.id);
        if (!user || user.refreshToken !== refreshToken) {
            return res.status(401).json({ message: "Invalid refresh token" });
        }

        // Generate new access token
        const newAccessToken = generateAccessToken(user);
        
        res.status(200).json({ 
            accessToken: newAccessToken
        });
        
    } catch (err) {
        res.status(500).json({ 
            message: "Token refresh failed", 
            error: err.message 
        });
    }
};

// Logout - Clear refresh token
exports.logout = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (refreshToken) {
            // Find user and clear refresh token
            const decoded = jwt.decode(refreshToken);
            if (decoded && decoded.id) {
                await User.findByIdAndUpdate(
                    decoded.id, 
                    { refreshToken: null }
                );
            }
        }

        res.status(200).json({ message: "Logged out successfully" });
        
    } catch (err) {
        res.status(500).json({ 
            message: "Logout failed", 
            error: err.message 
        });
    }
};

exports.getDrivers = async (req, res) => {
    try {
        const drivers = await User.find({ role: "Driver" }).populate("firstName", "firstName email");
        res.json(drivers);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.getEmployeesAdmin = async (req, res) => {
  try {
  const employees = await User.find({
    role: { $in: ['Sales/Marketing', 'IT/Technical', 'Operations', 'Driver', 'Accounting/Finance'] }
  })
    .populate('departmentId', 'name departmentCode')
    .populate('manager', 'firstName lastName email')
    .populate('directReports', 'firstName lastName email position')
    .sort({ createdAt: -1 });

  console.log(`Fetched ${employees.length} employees`);
  res.status(200).json(employees);
} catch (error) {
  console.error('Error fetching employees:', error);
  res.status(500).json({ message: 'Server error while fetching employees' });
}
};

exports.getEmployees = async (req, res) => {
  try {
    // Check authentication and get user company
    if (!req.user || !req.user._id) {
      return res.status(401).json({ 
        success: false,
        message: "Unauthorized: User not authenticated"
      });
    }

    // Get requesting user's company and admin status
    const requestingUser = await User.findById(req.user._id)
      .select('company isEnterpriseAdmin');
    
    if (!requestingUser) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }
    const allowedRoles = ['Sales/Marketing', 'IT/Technical', 'Operations', 'Driver', 'Accounting/Finance',"Software Engineer",
    "Senior Software Engineer", 
    "Lead Engineer",
    "Product Manager",
    "Senior Product Manager",
    "Data Scientist",
    "Data Analyst",
    "UI/UX Designer",
    "Senior Designer",
    "DevOps Engineer",
    "Quality Assurance Engineer",
    "Business Analyst",
    "Project Manager",
    "Scrum Master",
    "Sales Representative",
    "Sales Manager",
    "Marketing Specialist",
    "Marketing Manager",
    "HR Specialist",
    "HR Manager",
    "Finance Analyst",
    "Accountant",
    "Administrative Assistant",
    "Office Manager",
    "Customer Support Representative",
    "Customer Success Manager"];
    // Base query - filter by company unless enterprise admin requests all
   const baseQuery = requestingUser.role === 'Enterprise(CEO, CFO, etc.)' && req.query.allCompanies === 'true'
  ? { role: { $in: allowedRoles } }
  : { 
      company: requestingUser.company,
      role: { $in: allowedRoles }
    };


    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;

    // Sorting parameters
    const sortField = req.query.sortBy || 'lastName';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
    const sort = { [sortField]: sortOrder };

    // Filter parameters
    const statusFilter = req.query.status 
      ? { status: req.query.status } 
      : {};

    // Search parameter
    const searchQuery = req.query.search
      ? {
          $or: [
            { firstName: { $regex: req.query.search, $options: 'i' } },
            { lastName: { $regex: req.query.search, $options: 'i' } },
            { email: { $regex: req.query.search, $options: 'i' } },
            { employeeId: { $regex: req.query.search, $options: 'i' } }
          ]
        }
      : {};

    // Combine all query conditions
    const query = {
      ...baseQuery,
      ...statusFilter,
      ...searchQuery
    };

    // Get employees with pagination and sorting
    const employees = await User.find(query)
      .select('-password -verificationCode -refreshToken')
      .populate({
        path: 'departmentId',
        select: 'name departmentCode',
        match: { status: 'active' } // Only active departments
      })
      .populate({
        path: 'manager',
        select: 'firstName lastName email avatar position',
        match: { status: 'active' } // Only active managers
      })
      .populate({
        path: 'directReports',
        select: 'firstName lastName email position status',
        match: { status: 'active' } // Only active direct reports
      })
      .populate({
        path: 'company',
        select: 'name industry'
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalCount = await User.countDocuments(query);

    // Get status counts
    const statusCounts = await User.aggregate([
      { $match: baseQuery },
      { $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Convert status counts to object
    const statusStats = statusCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    console.log(`Fetched ${employees.length} employees from company ${requestingUser.company}`);

    res.status(200).json({
      success: true,
      data: employees,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        statusStats,
        sort: `${sortField}:${sortOrder === 1 ? 'asc' : 'desc'}`,
        filters: {
          search: req.query.search || null,
          status: req.query.status || null
        },
        context: {
          isEnterpriseAdmin: requestingUser.isEnterpriseAdmin,
          allCompanies: req.query.allCompanies === 'true'
        }
      }
    });

  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching employees',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get an employee by ID
// @route   GET /api/employees/:id
// @access  Private
exports.getEmployeeById = async (req, res) => {
  try {
    // Change this line from req.params._id to req.params.id
    const employee = await User.findById(req.params.id);
    console.log("Fetching employee with ID:", req.params.id);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.status(200).json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update employee
exports.updateEmployee = async (req, res) => {
  try {
    const employeeId = req.params.id;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.password;
    delete updateData.role;
    delete updateData.employeeId;
    delete updateData._id;

    // Update timestamp
    updateData.updatedAt = new Date();

    // If salary is being updated, convert to number
    if (updateData.salary) {
      updateData.salary = parseFloat(updateData.salary);
    }

    // If hireDate is being updated, convert to Date
    if (updateData.hireDate) {
      updateData.hireDate = new Date(updateData.hireDate);
    }

    const updatedEmployee = await User.findByIdAndUpdate(
      employeeId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    console.log(`Updated employee: ${updatedEmployee.firstName} ${updatedEmployee.lastName}`);
    res.status(200).json({
      message: 'Employee updated successfully',
      employee: updatedEmployee
    });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ message: 'Server error while updating employee' });
  }
};

// Create new employee within an enterprise
exports.createEmployee = async (req, res) => {
  console.log("Incoming Create Employee Request:", req.body);   
  try {
    // Verify the requesting user is an enterprise admin
    const requestingUser = await User.findById(req.user._id);
    if (!requestingUser.isEnterpriseAdmin && requestingUser.role !== "Enterprise(CEO, CFO, etc.)") {
      return res.status(403).json({
        message: "Only enterprise admins or executives can create employees",
        code: "ADMIN_ACCESS_REQUIRED"
      });
    }

    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      address,
      department,
      departmentId,
      position,
      hireDate,
      salary,
      emergencyContact,
      skills,
      employmentType,
      workLocation,
      manager
    } = req.body;

    // Validate required fields
    const requiredFields = ['firstName', 'lastName', 'email', 'phoneNumber', 'position'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        message: "Missing required fields",
        code: "MISSING_REQUIRED_FIELDS",
        requiredFields,
        missingFields
      });
    }

    // Check if employee with email already exists in this company
    const existingEmployee = await User.findOne({ 
      email: email.toLowerCase(),
      company: requestingUser.company 
    });
    
    if (existingEmployee) {
      return res.status(400).json({ 
        message: "Employee with this email already exists in your company",
        code: "DUPLICATE_EMPLOYEE_EMAIL"
      });
    }

    // Validate department exists in this company
    let validDepartmentId = null;
    if (department || departmentId) {
      const departmentQuery = departmentId ? 
        { _id: departmentId, company: requestingUser.company } : 
        { name: department, company: requestingUser.company };
      
      const departmentDoc = await Department.findOne(departmentQuery);
      
      if (!departmentDoc) {
        return res.status(400).json({ 
          message: "Department not found in your company",
          code: "DEPARTMENT_NOT_FOUND"
        });
      }
      validDepartmentId = departmentDoc._id;
    }

    // Get company's subscription details
    const companySubscription = requestingUser.billing?.subscription || {
      plan: 'trial',
      status: 'trialing'
    };

    // Calculate remaining subscription time
    let trialEndDate = requestingUser.billing?.trialEndDate || null;
    let subscriptionEndDate = companySubscription.currentPeriodEnd || null;
    let subscriptionStatus = companySubscription.status || 'trialing';

    // Set default storage limits based on plan
    let storageLimit = 100; // Default 100MB
    if (companySubscription.plan === 'enterprise') {
      storageLimit = 10240; // 10GB
    } else if (companySubscription.plan === 'professional') {
      storageLimit = 5120; // 5GB
    }

    // Generate URL-safe registration token
    const registrationToken = crypto.randomBytes(32).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    const registrationTokenExpires = Date.now() + 48 * 60 * 60 * 1000; // 48 hours

    // Create new employee with subscription details
    const newEmployee = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phoneNumber,
      address,
      department,
      departmentId: validDepartmentId,
      position,
      hireDate: hireDate ? new Date(hireDate) : new Date(),
      salary: salary ? parseFloat(salary) : null,
      status: 'pending',
      emergencyContact: emergencyContact || {},
      skills: skills || [],
      employmentType: employmentType || 'full-time',
      workLocation: workLocation || 'office',
      manager: manager || null,
      role: position,
      company: requestingUser.company,
      companyName: requestingUser.companyName,
      industry: requestingUser.industry,
      registrationStatus: 'pending',
      registrationToken,
      registrationTokenExpires,
      billing: {
        trialStartDate: requestingUser.billing?.trialStartDate || new Date(),
        trialEndDate: trialEndDate,
        subscription: {
          plan: companySubscription.plan,
          status: subscriptionStatus,
          currentPeriodStart: companySubscription.currentPeriodStart || new Date(),
          currentPeriodEnd: subscriptionEndDate,
          cancelAtPeriodEnd: companySubscription.cancelAtPeriodEnd || false,
          subscriptionId: companySubscription.subscriptionId || null,
          priceId: companySubscription.priceId || null
        }
      },
      usage: {
        apiCalls: {
          count: 0,
          lastReset: new Date()
        },
        storage: {
          used: 0,
          limit: storageLimit
        }
      }
    });

    const savedEmployee = await newEmployee.save();

    // Update department employee count if department is assigned
    if (validDepartmentId) {
      await Department.findByIdAndUpdate(validDepartmentId, {
        $addToSet: { employees: savedEmployee._id },
        $inc: { employeeCount: 1 }
      });
    }

    // Generate properly encoded registration link
    const registrationLink = `${process.env.FRONTEND_URL}/complete-registration?token=${encodeURIComponent(registrationToken)}&email=${encodeURIComponent(email)}`;
    
    // Prepare SendGrid email
    const msg = {
      to: email,
      from: {
        name: requestingUser.companyName || 'NexusMWI',
        email: process.env.SENDGRID_FROM_EMAIL || 'noreply@nexusmwi.com'
      },
      subject: `Complete Your Registration - ${requestingUser.companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <h2 style="color: #333;">Welcome to ${requestingUser.companyName}</h2>
          <p>Dear ${firstName} ${lastName},</p>
          <p>Your employee account has been created by ${requestingUser.firstName} ${requestingUser.lastName}.</p>
          <p>Please complete your registration by clicking the button below:</p>
          <div style="margin: 20px 0; text-align: center;">
            <a href="${registrationLink}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Complete Registration</a>
          </div>
          <p style="font-size: 12px; color: #777;">Or copy and paste this link into your browser: ${registrationLink}</p>
          <p><strong>Important:</strong> This link expires in 48 hours.</p>
          <p>If you didn't expect this email, please contact your administrator.</p>
          <p>Best regards,<br/>${requestingUser.companyName} Team</p>
        </div>
      `,
      text: `Welcome to ${requestingUser.companyName}\n\nDear ${firstName} ${lastName},\n\nYour employee account has been created by ${requestingUser.firstName} ${requestingUser.lastName}.\n\nPlease complete your registration by visiting this link:\n${registrationLink}\n\nImportant: This link expires in 48 hours.\n\nIf you didn't expect this email, please contact your administrator.\n\nBest regards,\n${requestingUser.companyName} Team`
    };

    try {
      // Send email via SendGrid API
      await sgMail.send(msg);
      console.log(`Registration email sent to ${email}`);
      
      res.status(201).json({
        success: true,
        message: 'Employee created successfully. Registration email sent.',
        code: "EMPLOYEE_CREATED",
        employee: {
          id: savedEmployee._id,
          firstName,
          lastName,
          email,
          position,
          status: 'pending',
          subscriptionPlan: companySubscription.plan,
          subscriptionEndDate: subscriptionEndDate || trialEndDate,
          registrationTokenExpires: new Date(registrationTokenExpires)
        },
        meta: {
          token: registrationToken, // For debugging purposes only
          emailSent: true
        }
      });
      
    } catch (sendGridError) {
      console.error('Failed to send registration email:', sendGridError);
      
      // Clean up the created employee record if email fails
      await User.findByIdAndDelete(savedEmployee._id);
      
      if (validDepartmentId) {
        await Department.findByIdAndUpdate(validDepartmentId, {
          $pull: { employees: savedEmployee._id },
          $inc: { employeeCount: -1 }
        });
      }
      
      res.status(500).json({
        success: false,
        message: "Employee created but failed to send registration email",
        code: "EMAIL_SEND_FAILED",
        error: process.env.NODE_ENV === 'development' ? sendGridError.message : undefined,
        debug: {
          emailAttempted: email,
          tokenGenerated: registrationToken
        }
      });
    }

  } catch (error) {
    console.error('Error creating employee:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        success: false,
        message: `An employee with this ${field} already exists`,
        code: "DUPLICATE_EMPLOYEE_DATA"
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Server error while creating employee',
      code: "SERVER_ERROR",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



// Verify registration token (new endpoint needed)
exports.verifyRegistration = async (req, res) => {
  try {
    console.log('\n=== VERIFY REGISTRATION DEBUG ===');
    console.log('🔍 Token from URL:', req.params.token);
    console.log('⏰ Current time:', new Date().toISOString());
    
    const { token } = req.params;

    if (!token) {
      console.log('❌ No token provided');
      return res.status(400).json({ 
        message: 'Registration token is required',
        code: 'TOKEN_REQUIRED'
      });
    }

    // Decode URL-encoded token
    const decodedToken = decodeURIComponent(token);

    // Find user with this token
    const user = await User.findOne({ 
      registrationToken: decodedToken 
    }).select('firstName lastName email position companyName department registrationTokenExpires registrationStatus');

    if (!user) {
      console.log('🚫 Token not found in database');
      return res.status(400).json({ 
        message: 'Invalid registration link. Please request a new registration email.',
        code: 'TOKEN_NOT_FOUND'
      });
    }

    console.log('👤 User details:');
    console.log('   - Name:', user.firstName, user.lastName);
    console.log('   - Email:', user.email);
    console.log('   - Registration Status:', user.registrationStatus);
    console.log('   - Token Expires:', user.registrationTokenExpires);
    
    // Calculate time remaining
    const isExpired = user.registrationTokenExpires < Date.now();
    const timeLeft = user.registrationTokenExpires - Date.now();
    const hoursLeft = Math.round(timeLeft / (1000 * 60 * 60) * 100) / 100;
    
    console.log('   - Token Expired?', isExpired);
    console.log('   - Hours left:', hoursLeft);

    if (isExpired) {
      console.log('💀 Token found but EXPIRED');
      return res.status(400).json({ 
        message: 'This registration link has expired. Please request a new registration email.',
        code: 'TOKEN_EXPIRED',
        debug: {
          expiredAt: user.registrationTokenExpires,
          hoursExpired: Math.abs(hoursLeft)
        }
      });
    }

    if (user.registrationStatus === 'completed') {
      console.log('⚠️ Registration already completed');
      return res.status(400).json({ 
        message: 'Your registration is already complete. Please log in instead.',
        code: 'ALREADY_COMPLETED'
      });
    }

    console.log('✅ Valid registration token found!');
    console.log('================================\n');

    res.status(200).json({
      success: true,
      message: 'Registration token is valid',
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        position: user.position,
        companyName: user.companyName,
        department: user.department
      },
      meta: {
        expiresAt: user.registrationTokenExpires,
        hoursRemaining: hoursLeft
      }
    });

  } catch (error) {
    console.error('❌ Error verifying registration token:', error);
    res.status(500).json({ 
      message: 'Error verifying registration token',
      code: 'SERVER_ERROR',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// Update the existing completeRegistration function to work with the frontend
exports.completeRegistration = async (req, res) => {
  try {
    const { token, username, password } = req.body;

    if (!token || !username || !password) {
      return res.status(400).json({ 
        message: 'Token, username, and password are required' 
      });
    }

    // Find user by registration token that hasn't expired
    const user = await User.findOne({
      registrationToken: token,
      registrationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        message: 'Invalid or expired registration link. Please contact your administrator.' 
      });
    }

    // Check if username is already taken
    const existingUser = await User.findOne({ username });
    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ 
        message: 'Password must be at least 8 characters long' 
      });
    }

    // Password strength validation
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasNumbers || !hasSpecialChar) {
      return res.status(400).json({ 
        message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' 
      });
    }

    // Update user with login credentials
    user.username = username;
    user.password = password; // This will be hashed by the pre-save middleware
    user.registrationStatus = 'completed';
    user.status = 'active';
    user.registrationToken = undefined;
    user.registrationTokenExpires = undefined;
    user.updatedAt = new Date();

    await user.save();

    // Send welcome email using SendGrid
    try {
      const welcomeSubject = `Welcome to ${process.env.EMAIL_FROM_NAME || 'the team'}!`;
      const welcomeHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Welcome aboard, ${user.firstName}!</h2>
          <p>Your account has been successfully set up. Here are your login details:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Username:</strong> ${username}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Position:</strong> ${user.position}</p>
          </div>
          <p>You can now log in to your account and start using the system.</p>
          <p>If you have any questions, please don't hesitate to contact your supervisor or HR department.</p>
          <p>Best regards,<br/>The ${process.env.EMAIL_FROM_NAME || 'Company'} Team</p>
        </div>
      `;

      const welcomeText = `Welcome to ${process.env.EMAIL_FROM_NAME || 'the team'}!\n\nDear ${user.firstName},\n\nYour account has been successfully set up.\n\nLogin details:\nUsername: ${username}\nEmail: ${user.email}\nPosition: ${user.position}\n\nYou can now log in to your account.\n\nIf you have any questions, please contact your supervisor or HR department.\n\nBest regards,\nThe ${process.env.EMAIL_FROM_NAME || 'Company'} Team`;

      const msg = {
        to: user.email,
        from: {
          name: process.env.EMAIL_FROM_NAME || 'NexusMWI',
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@nexusmwi.com'
        },
        subject: welcomeSubject,
        html: welcomeHtml,
        text: welcomeText
      };

      await sgMail.send(msg);
      console.log(`Welcome email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Welcome email failed:', emailError);
      // Don't fail the registration if email fails
    }

    res.status(200).json({ 
      message: 'Registration completed successfully. You can now login with your credentials.',
      success: true,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });

  } catch (error) {
    console.error('Error completing registration:', error);
    res.status(500).json({ 
      message: 'Server error while completing registration',
      error: error.message 
    });
  }
};



// Configure storage for logos
const logoStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    const dir = './uploads/logos';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    // Using JWT token to identify user instead of req.user.id
    // We'll extract the user ID after authentication in the controller
    const timestamp = Date.now();
    const fileExt = path.extname(file.originalname).toLowerCase();
    cb(null, `logo_${timestamp}${fileExt}`);
  }
});

// Configure storage for signatures
const signatureStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    const dir = './uploads/signatures';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    // Using timestamp for unique filename
    const timestamp = Date.now();
    const fileExt = path.extname(file.originalname).toLowerCase();
    cb(null, `signature_${timestamp}${fileExt}`);
  }
});

// File filters to ensure only standard image formats are accepted
const fileFilter = (req, file, cb) => {
  // Allow only standard image formats
  const allowedMimeTypes = [
    'image/jpeg', 
    'image/png', 
    'image/gif', 
    'image/svg+xml',
    'image/webp'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Please upload JPEG, PNG, GIF, SVG, or WebP files only.'), false);
  }
};

// Set up multer for logo uploads
const uploadLogoMiddleware = multer({
  storage: logoStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter: fileFilter,
}).single('logo');

// Set up multer for signature uploads
const uploadSignatureMiddleware = multer({
  storage: signatureStorage,
  limits: {
    fileSize: 1 * 1024 * 1024, // 1MB limit
  },
  fileFilter: fileFilter,
}).single('signature');

// Controller for logo upload
exports.uploadLogo = (req, res) => {
  uploadLogoMiddleware(req, res, async function(err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ 
        success: false, 
        message: `Upload error: ${err.message}` 
      });
    } else if (err) {
      return res.status(500).json({ 
        success: false, 
        message: err.message || 'An error occurred during upload' 
      });
    }
    
    // If no file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please upload a logo file' 
      });
    }
    
    try {
      // Check if email is available in the request body
      if (!req.body.email) {
        // Clean up the uploaded file if email is not available
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }
      
      // Debugging
      console.log("Request body:", req.body);
      console.log("Email from request:", req.body.email);
      
      // Find user by email
      const user = await User.findOne({ email: req.body.email });
      if (!user) {
        // Clean up the uploaded file if user not found
        fs.unlinkSync(req.file.path);
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Update user's logo URL in database
      const logoPath = `/uploads/logos/${req.file.filename}`;
      
      await User.findByIdAndUpdate(user._id, { 
        companyLogo: logoPath,
        updatedAt: Date.now()
      });
      
      return res.status(200).json({
        success: true,
        message: 'Logo uploaded successfully',
        logoUrl: logoPath
      });
    } catch (error) {
      // If database update fails, remove the uploaded file
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error saving logo information to database',
        error: error.message
      });
    }
  });
};

// Controller for signature upload
exports.uploadSignature = (req, res) => {
  uploadSignatureMiddleware(req, res, async function(err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ 
        success: false, 
        message: `Upload error: ${err.message}` 
      });
    } else if (err) {
      return res.status(500).json({ 
        success: false, 
        message: err.message || 'An error occurred during upload' 
      });
    }
    
    // If no file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please upload a signature file' 
      });
    }
    
    try {
      // Check if email is available in the request body
      if (!req.body.email) {
        // Clean up the uploaded file if email is not available
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }
      
      // Debugging
      console.log("Request body:", req.body);
      console.log("Email from request:", req.body.email);
      
      // Find user by email
      const user = await User.findOne({ email: req.body.email });
      if (!user) {
        // Clean up the uploaded file if user not found
        fs.unlinkSync(req.file.path);
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Update user's signatures URL in database
      const signaturePath = `/uploads/signatures/${req.file.filename}`;
      
      await User.findByIdAndUpdate(user._id, { 
        signature: signaturePath,
        updatedAt: Date.now()
      });
      
      return res.status(200).json({
        success: true,
        message: 'Signature uploaded successfully',
        signatureUrl: signaturePath
      });
    } catch (error) {
      // If database update fails, remove the uploaded file
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error saving signature information to database',
        error: error.message
      });
    }
  });
};

// =======================
// PAYMENT METHODS ENDPOINTS
// =======================

// Get user payment methods
exports.getPaymentMethods = async (req, res) => {
    try {
        const userId = req.user._id;
        
        const user = await User.findById(userId).select('paymentMethods');
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Filter out inactive payment methods
        const activeMethods = user.paymentMethods.filter(method => method.isActive);
        
        res.status(200).json({
            success: true,
            paymentMethods: activeMethods
        });
        
    } catch (err) {
        console.error("Error in getPaymentMethods:", err);
        res.status(500).json({ 
            message: "Failed to fetch payment methods", 
            error: err.message 
        });
    }
};

// Add new payment method
exports.addPaymentMethod = async (req, res) => {
    try {
        const userId = req.user._id;
        const { cardNumber, expiryDate, cvv, cardHolder, nickname, isDefault } = req.body;
        console.log(req.body);
        // Validate required fields
        if (!cardNumber || !expiryDate || !cvv || !cardHolder) {
            return res.status(400).json({ 
                message: "Card number, expiry date, CVV, and cardholder name are required" 
            });
        }
        
        // Validate card number (basic validation)
        const cleanCardNumber = cardNumber.replace(/\s/g, '');
        if (!/^\d{13,19}$/.test(cleanCardNumber)) {
            return res.status(400).json({ 
                message: "Invalid card number format" 
            });
        }
        
        // Validate expiry date
        const [month, year] = expiryDate.split('/');
        if (!month || !year || !/^(0[1-9]|1[0-2])$/.test(month) || !/^\d{2}$/.test(year)) {
            return res.status(400).json({ 
                message: "Invalid expiry date format (MM/YY)" 
            });
        }
        
        // Check if card is expired
        const currentYear = new Date().getFullYear() % 100;
        const currentMonth = new Date().getMonth() + 1;
        const expYear = parseInt(year);
        const expMonth = parseInt(month);
        
        if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
            return res.status(400).json({ 
                message: "Card has expired" 
            });
        }
        
        // Detect card type
        const detectCardType = (number) => {
            const cleaned = number.replace(/\s/g, '');
            if (/^4/.test(cleaned)) return 'visa';
            if (/^5[1-5]/.test(cleaned)) return 'mastercard';
            if (/^3[47]/.test(cleaned)) return 'amex';
            if (/^6/.test(cleaned)) return 'discover';
            return 'visa'; // default
        };
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Check if this card already exists (by last 4 digits and expiry)
        const lastFour = cleanCardNumber.slice(-4);
        const existingCard = user.paymentMethods.find(method => 
            method.lastFour === lastFour && 
            method.expiryMonth === month.padStart(2, '0') && 
            method.expiryYear === `20${year}` &&
            method.isActive
        );
        
        if (existingCard) {
            return res.status(400).json({ 
                message: "This payment method already exists" 
            });
        }
        
        // If this is the first card or explicitly set as default, make it default
        const shouldBeDefault = isDefault || user.paymentMethods.filter(m => m.isActive).length === 0;
        
        // If setting as default, remove default from other cards
        if (shouldBeDefault) {
            user.paymentMethods.forEach(method => {
                if (method.isActive) method.isDefault = false;
            });
        }
        
        // Create new payment method
        const newPaymentMethod = {
            type: detectCardType(cleanCardNumber),
            lastFour: lastFour,
            expiryMonth: month.padStart(2, '0'),
            expiryYear: `20${year}`,
            cardHolder: cardHolder.trim().toUpperCase(),
            isDefault: shouldBeDefault,
            nickname: nickname || `${detectCardType(cleanCardNumber).toUpperCase()} ending in ${lastFour}`,
            isActive: true
        };
        
        user.paymentMethods.push(newPaymentMethod);
        await user.save();
        
        // Return the new payment method (without sensitive data)
        const addedMethod = user.paymentMethods[user.paymentMethods.length - 1];
        
        res.status(201).json({
            success: true,
            message: "Payment method added successfully",
            paymentMethod: addedMethod
        });
        
    } catch (err) {
        console.error("Error in addPaymentMethod:", err);
        res.status(500).json({ 
            message: "Failed to add payment method", 
            error: err.message 
        });
    }
};

// Update payment method
exports.updatePaymentMethod = async (req, res) => {
    try {
        const userId = req.user._id;
        const { paymentMethodId } = req.params;
        const { nickname, isDefault } = req.body;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        const paymentMethod = user.paymentMethods.id(paymentMethodId);
        if (!paymentMethod || !paymentMethod.isActive) {
            return res.status(404).json({ message: "Payment method not found" });
        }
        
        // Update nickname if provided
        if (nickname !== undefined) {
            paymentMethod.nickname = nickname.trim();
        }
        
        // Update default status if provided
        if (isDefault === true) {
            // Remove default from other cards
            user.paymentMethods.forEach(method => {
                if (method.isActive && method.id !== paymentMethodId) {
                    method.isDefault = false;
                }
            });
            paymentMethod.isDefault = true;
        } else if (isDefault === false) {
            paymentMethod.isDefault = false;
        }
        
        await user.save();
        
        res.status(200).json({
            success: true,
            message: "Payment method updated successfully",
            paymentMethod: paymentMethod
        });
        
    } catch (err) {
        console.error("Error in updatePaymentMethod:", err);
        res.status(500).json({ 
            message: "Failed to update payment method", 
            error: err.message 
        });
    }
};

// Delete payment method
exports.deletePaymentMethod = async (req, res) => {
    try {
        const userId = req.user._id;
        const { paymentMethodId } = req.params;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        const paymentMethod = user.paymentMethods.id(paymentMethodId);
        if (!paymentMethod || !paymentMethod.isActive) {
            return res.status(404).json({ message: "Payment method not found" });
        }
        
        // Soft delete - mark as inactive instead of removing
        paymentMethod.isActive = false;
        paymentMethod.isDefault = false;
        
        // If this was the default card, make another active card default
        const activeMethods = user.paymentMethods.filter(method => method.isActive);
        if (activeMethods.length > 0 && !activeMethods.some(method => method.isDefault)) {
            activeMethods[0].isDefault = true;
        }
        
        await user.save();
        
        res.status(200).json({
            success: true,
            message: "Payment method deleted successfully"
        });
        
    } catch (err) {
        console.error("Error in deletePaymentMethod:", err);
        res.status(500).json({ 
            message: "Failed to delete payment method", 
            error: err.message 
        });
    }
};

// Set default payment method
exports.setDefaultPaymentMethod = async (req, res) => {
    try {
        const userId = req.user._id;
        const { paymentMethodId } = req.params;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        const paymentMethod = user.paymentMethods.id(paymentMethodId);
        if (!paymentMethod || !paymentMethod.isActive) {
            return res.status(404).json({ message: "Payment method not found" });
        }
        
        // Remove default from all cards
        user.paymentMethods.forEach(method => {
            method.isDefault = false;
        });
        
        // Set this card as default
        paymentMethod.isDefault = true;
        
        await user.save();
        
        res.status(200).json({
            success: true,
            message: "Default payment method updated successfully",
            paymentMethod: paymentMethod
        });
        
    } catch (err) {
        console.error("Error in setDefaultPaymentMethod:", err);
        res.status(500).json({ 
            message: "Failed to set default payment method", 
            error: err.message 
        });
    }
};

// Upload Avatar Controller
exports.uploadAvatar = (req, res) => {
  uploadAvatarMiddleware(req, res, async function(err) {
    try {
      // Handle multer errors
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ 
            success: false, 
            message: 'File too large. Maximum size is 5MB.' 
          });
        }
        return res.status(400).json({ 
          success: false, 
          message: `Upload error: ${err.message}` 
        });
      } 
      
      if (err) {
        return res.status(400).json({ 
          success: false, 
          message: err.message || 'An error occurred during upload' 
        });
      }
      
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'Please select an avatar file to upload' 
        });
      }

      const userId = req.user._id;
      
      // Find the user
      const user = await User.findById(userId);
      if (!user) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Delete old avatar if exists
      if (user.avatar) {
        const oldAvatarPath = path.join(__dirname, '..', user.avatar);
        if (fs.existsSync(oldAvatarPath)) {
          try {
            fs.unlinkSync(oldAvatarPath);
            console.log('Old avatar deleted successfully');
          } catch (deleteError) {
            console.error('Error deleting old avatar:', deleteError);
          }
        }
      }
      
      // Create avatar URL path
      const avatarPath = `/uploads/avatars/${req.file.filename}`;
      
      // Update user's avatar in database
      const updatedUser = await User.findByIdAndUpdate(
        userId, 
        { 
          avatar: avatarPath,
          updatedAt: Date.now()
        },
        { 
          new: true,
          select: '-password -verificationCode -emailVerificationCode -refreshToken'
        }
      );
      
      console.log(`Avatar uploaded successfully for user ${userId}: ${avatarPath}`);
      
      return res.status(200).json({
        success: true,
        message: 'Avatar uploaded successfully',
        data: {
          avatarUrl: avatarPath,
          user: updatedUser
        }
      });
      
    } catch (error) {
      console.error('Avatar upload error:', error);
      
      // Clean up uploaded file if database operation fails
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
        }
      }
      
      return res.status(500).json({
        success: false,
        message: 'Internal server error while uploading avatar',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
};


// Add this to authController.js
exports.getUsersForManagement = async (req, res) => {
  try {
    // Get all users with basic information
    const users = await User.find({})
      .select('firstName lastName email role department status lastLoginAt')
      .populate('departmentId', 'name')
      .lean();

    // Map the users to the format expected by the frontend
    const formattedUsers = users.map(user => ({
      id: user._id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: user.role || 'Employee',
      department: user.departmentId?.name || user.department || 'Unassigned',
      status: user.status || 'inactive',
      lastLogin: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString().split('T')[0] : 'Never',
      permissions: getPermissionsForRole(user.role) // Helper function to map roles to permissions
    }));

    res.status(200).json(formattedUsers);
  } catch (err) {
    console.error("Error in getUsersForManagement:", err);
    res.status(500).json({ 
      message: "Failed to fetch users", 
      error: err.message 
    });
  }
};

// =======================
// PASSWORD CHANGE ENDPOINT
// =======================

// Change user password (for authenticated users)
exports.changePassword = async (req, res) => {
    try {
        const userId = req.user._id;
        const { currentPassword, newPassword } = req.body;
        
        console.log('Password change request for user:', userId);
        
        // Validate required fields
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                success: false,
                message: "Current password and new password are required" 
            });
        }
        
        // Find user with password field
        const user = await User.findById(userId).select('+password');
        
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: "User not found" 
            });
        }
        
        // Verify current password
        console.log('Verifying current password...');
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        
        if (!isCurrentPasswordValid) {
            console.log('Current password is incorrect');
            return res.status(400).json({ 
                success: false,
                message: "Current password is incorrect" 
            });
        }
        
        // Validate new password strength
        if (newPassword.length < 8) {
            return res.status(400).json({ 
                success: false,
                message: "New password must be at least 8 characters long" 
            });
        }
        
        // Check if new password is different from current password
        if (currentPassword === newPassword) {
            return res.status(400).json({ 
                success: false,
                message: "New password must be different from current password" 
            });
        }
        
        // Additional password strength validation
        const hasUppercase = /[A-Z]/.test(newPassword);
        const hasLowercase = /[a-z]/.test(newPassword);
        const hasNumbers = /\d/.test(newPassword);
        const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(newPassword);

        if (!hasUppercase || !hasLowercase || !hasNumbers || !hasSpecialChar) {
            return res.status(400).json({ 
                success: false,
                message: "New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character" 
            });
        }
        
        console.log('Updating password...');
        
        // Update password
        user.password = newPassword;
        user.updatedAt = Date.now();
        
        await user.save();
        
        console.log('Password updated successfully for user:', userId);
        
        // Send notification email
        try {
            await sendEmailNotification(
                user.email,
                "Password Changed Successfully",
                `Hello ${user.firstName || 'there'},\n\nYour password has been successfully updated. If you did not make this change, please contact support immediately.\n\nBest regards,\nThe ${process.env.EMAIL_FROM_NAME || 'NexusMWI'} Team`
            );
            console.log('Password change notification email sent');
        } catch (emailError) {
            console.error("Password change notification email failed:", emailError);
            // Continue even if email fails
        }
        
        res.status(200).json({
            success: true,
            message: "Password changed successfully"
        });
        
    } catch (err) {
        console.error("Error in changePassword:", err);
        res.status(500).json({ 
            success: false,
            message: "Failed to change password", 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Helper function to map roles to permissions
function getPermissionsForRole(role) {
  const rolePermissions = {
    'IT/Technical': ['system_settings', 'technical_support', 'user_management'],
    'Executive': ['full_access', 'financial_reports', 'budget_management'],
    'Management': ['approve_orders', 'manage_team', 'view_reports'],
    'Sales/Marketing': ['create_requisition', 'view_orders', 'customer_management'],
    'Driver': ['view_assignments', 'update_status'],
    'Operations': ['inventory_management', 'order_processing', 'vendor_communication'],
    'Human Resources': ['employee_management', 'onboarding', 'performance_reviews'],
    'Accounting/Finance': ['approve_invoices', 'budget_management', 'financial_reports'],
    'Admin': ['full_access', 'user_management', 'system_settings'],
    'Vendor': ['view_orders', 'update_status'],
    'employee': ['create_requisition', 'view_orders']
  };

  return rolePermissions[role] || ['create_requisition', 'view_orders'];
}
