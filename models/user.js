const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email address`
    }
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  
  // Contact Information
  phone: {
    type: String,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    validate: {
      validator: function(v) {
        return /^\+?\d{10,15}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number`
    }
  },
  
  // Address Information
  address: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  zipCode: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true,
    default: 'United States'
  },
  
  // Professional Information
  company: {
    type: String,
    trim: true
  },
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true
  },
  jobTitle: {
    type: String,
    trim: true
  },
  industry: {
    type: String,
    required: [true, 'Industry is required'],
    trim: true
  },
  role: { 
    type: String, 
    required: true,
    enum: [
      'IT/Technical', 'Executive (CEO, CFO, etc.)', 'Management', 'Sales/Marketing','Driver', 
      'Operations', 'Human Resources', 'Accounting/Finance', 'Other', 'user','employee','Vendor'
    ],
    default: 'employee'
  },
  
  // Social/Web Information
  bio: {
    type: String,
    trim: true,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  website: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        return /^https?:\/\/.+\..+/.test(v);
      },
      message: 'Please enter a valid website URL'
    }
  },
  linkedin: {
    type: String,
    trim: true
  },
  twitter: {
    type: String,
    trim: true
  },
  
  // Profile Media
  avatar: {
    type: String,
    default: null
  },
  companyLogo: {
    type: String,
    default: null
  },
  signature: {
    type: String,
    default: null
  },
  
  // Security & Verification
  isVerified: {
    type: Boolean,
    default: false
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  verificationCode: {
    type: String,
    default: null
  },
  emailVerificationCode: {
    type: String,
    default: null
  },
  emailVerificationCodeExpires: {
    type: Date,
    default: null
  },
  verificationCodeExpires: {
    type: Date,
    default: null
  },
  
  // Security Settings
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  loginNotifications: {
    type: Boolean,
    default: true
  },
  activityNotifications: {
    type: Boolean,
    default: true
  },
  
  // System Fields
  refreshToken: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastLoginAt: {
    type: Date,
    default: null
  },
  registrationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },

  // Payment Methods
  paymentMethods: [{
    id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    type: {
      type: String,
      enum: ['visa', 'mastercard', 'amex', 'discover'],
      required: true
    },
    lastFour: {
      type: String,
      required: true,
      length: 4
    },
    expiryMonth: {
      type: String,
      required: true,
      match: /^(0[1-9]|1[0-2])$/ // 01-12
    },
    expiryYear: {
      type: String,
      required: true,
      match: /^\d{4}$/ // YYYY format
    },
    cardHolder: {
      type: String,
      required: true,
      trim: true
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    nickname: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});


UserSchema.pre('save', function(next) {
  if (this.isModified('paymentMethods')) {
    const defaultMethods = this.paymentMethods.filter(method => method.isDefault);
    if (defaultMethods.length > 1) {
      // Keep only the last one as default
      this.paymentMethods.forEach((method, index) => {
        method.isDefault = index === this.paymentMethods.length - 1 && method.isDefault;
      });
    }
  }
  next();
});

// Update the updatedAt field before saving
UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile (excluding sensitive data)
UserSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.verificationCode;
  delete userObject.emailVerificationCode;
  delete userObject.refreshToken;
  return userObject;
};

const migrateUsers = async () => {
    const users = await User.find({});
    
    for (const user of users) {
        if (!user.password || user.password.length < 60) {
            const tempPass = 'Temp@1234';
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(tempPass, salt);
            await user.save();
            console.log(`Reset password for ${user.email}`);
        }
    }
};

exports.requestPasswordReset = async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    
    // Generate and save reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();
    
    // Send email with reset link
    sendResetEmail(user.email, resetToken);
    
    res.status(200).json({ message: "Reset link sent" });
};

module.exports = mongoose.model('User', UserSchema);