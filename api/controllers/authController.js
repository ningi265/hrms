const User = require("../../models/user");
const jwt = require("jsonwebtoken");
const twilio = require('twilio');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
            nextStep: "verify_phone_and_email" // Tell frontend to show verification page
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
        const drivers = await User.find({ role: "driver" }).populate("name", "name email");
        res.json(drivers);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
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