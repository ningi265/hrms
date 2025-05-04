const User = require("../../models/user");
const jwt = require("jsonwebtoken");
const twilio = require('twilio');
const bcrypt = require('bcrypt');


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
  
      // Find the user by phone number
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

  
      // You might want to generate a JWT token here for authentication
      // const token = generateToken(user);
  
      res.status(200).json({ 
        message: "Phone number verified successfully",
        isVerified: true,
        // token: token // If you're using JWT
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
            password: await bcrypt.hash(password, 10),
            companyName,
            industry,
            role,
            phoneNumber,
            isVerified: false, // Mark as unverified initially
            verificationCode: null // Will be set when SMS is sent
        });

        // Don't log the full user object for security
        console.log("New user created:", { id: newUser._id, email: newUser.email });

        // Respond without token since user isn't verified yet
        res.status(201).json({ 
            message: "Registration successful. Verification code sent to your phone.",
            userId: newUser._id,
            nextStep: "verify_phone" // Tell frontend to show verification page
        });

    } catch (err) {
        console.error("Error during registration:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Login User
exports.login = async (req, res) => {
  try {
      const { email, password } = req.body;
      
      // Explicitly select the password field
      const user = await User.findOne({ email }).select('+password');
      
      if (!user) {
          return res.status(401).json({ message: "Invalid credentials" });
      }

      // Add validation
      if (!user.password) {
          return res.status(401).json({ 
              message: "Account not properly configured" 
          });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
          return res.status(401).json({ message: "Invalid credentials" });
      }

      // Remove password from response
      user.password = undefined;
      res.status(200).json({ token: generateToken(user), user });
      
  } catch (err) {
      res.status(500).json({ 
          message: "Login failed", 
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



