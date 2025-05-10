const User = require("../../models/user");
const jwt = require("jsonwebtoken");
const twilio = require('twilio');
const bcrypt = require('bcryptjs');


const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

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
  
      // (Optional) Redundant check since we already found by phoneNumber
      // if (user.phoneNumber !== phoneNumber) {
      //   return res.status(400).json({ message: "Invalid phone number" });
      // }
  
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
  
      // This check is redundant since we already found by phoneNumber
      // if (user.phoneNumber !== phoneNumber) {
      //   return res.status(400).json({ message: "Invalid phone number" });
      // }
  
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
            isVerified: false, // Mark as unverified initially
            verificationCode: null // Will be set when SMS is sent
        });

        await newUser.save();

       const token = generateToken(newUser);

        console.log('User role:', newUser.role);
console.log('Token payload:', { userId: newUser._id, email: newUser.email, isVerified: newUser.isVerified, role: newUser.role || 'user' });

        // Don't log the full user object for security
        console.log("New user created:", { id: newUser._id, email: newUser.email });

        // Respond without token since user isn't verified yet
        res.status(201).json({ 
            message: "Registration successful. Verification code sent to your phone.",
            user: {
              id: newUser._id,
              email: newUser.email
            },
            token,
            nextStep: "verify_phone" // Tell frontend to show verification page
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



