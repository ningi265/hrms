const User = require("../../models/user");
const jwt = require("jsonwebtoken");
const twilio = require('twilio');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
//const {sendEmailNotification} = require("../services/notificationService");

// Twilio setup
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// Nodemailer transport setup for Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD, // Use app password for Gmail
  },
});

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
    from: `"${process.env.EMAIL_FROM_NAME || 'NyasaTech'}" <${process.env.EMAIL_USER}>`,
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

    // Send email
    try {
      await sendVerificationEmail(user, verificationCode);

      res.status(200).json({ 
        message: "Verification code sent to your email successfully",
        email: email 
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      user.emailVerificationCode = undefined;
      user.emailVerificationExpires = undefined;
      await user.save({ validateBeforeSave: false });
      
      throw new Error("Failed to send verification email");
    }

  } catch (err) {
    console.error("Error in sendEmailVerification:", err);
    res.status(500).json({ 
      message: err.message || "Failed to send email verification code" 
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

// Register User (updated version)
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
            role, 
            phoneNumber 
        } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !password || !companyName || !industry || !role || !phoneNumber) {
            console.log("Missing required fields");
            return res.status(400).json({ 
                message: "All fields are required",
                requiredFields: [
                    'firstName', 
                    'lastName', 
                    'email', 
                    'password', 
                    'companyName', 
                    'industry', 
                    'role', 
                    'phoneNumber'
                ]
            });
        }

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        // Validate phone number format (basic validation)
        if (!/^\+?\d{10,15}$/.test(phoneNumber)) {
            return res.status(400).json({ message: "Invalid phone number format" });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Create new user (without verification status)
        const newUser = await User.create({ 
            firstName,
            lastName,
            email,
            password,
            companyName,
            industry,
            role,
            phoneNumber,
            isVerified: false, // Phone verification
            isEmailVerified: false, // Email verification
            verificationCode: null, // Will be set when SMS is sent
            emailVerificationCode: null // Will be set when email is sent
        });

        await newUser.save();

       const token = generateToken(newUser);

        console.log('User role:', newUser.role);
        console.log('Token payload:', { userId: newUser._id, email: newUser.email, isVerified: newUser.isVerified, role: newUser.role || 'user' });

        // Don't log the full user object for security
        console.log("New user created:", { id: newUser._id, email: newUser.email });

        // Respond without token since user isn't verified yet
        res.status(201).json({ 
            message: "Registration successful. Verification codes will be sent to your phone and email.",
            user: {
              id: newUser._id,
              email: newUser.email
            },
            token,
            nextStep: "verify_email" // Tell frontend to show verification page
        });

    } catch (err) {
        console.error("Error during registration:", err);
        res.status(500).json({ message: "Server error", error: err.message });
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
      const user = await User.findOne({ email }).select('+password');
      
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
      res.status(200).json({ token, user });
      
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

exports.getEmployees = async (req, res) => {
    try {
        const drivers = await User.find({ role: "Sales/Marketing" }).populate("firstName", "firstName email");
        res.json(drivers);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
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
