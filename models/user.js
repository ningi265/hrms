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
    required: [false, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  
  // *** CRITICAL: Add username field for registration completion ***
  username: {
    type: String,
    unique: true,
    sparse: true, // Allows null values but enforces uniqueness when present
    trim: true,
    minlength: 3,
    maxlength: 30
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
  emergencyContact: {
    type: String,
    trim: true
  },
  employeeId: {
    type: String,
    unique: true,
    sparse: true // Allows null values but ensures uniqueness when present
  },
  departmentId: {
    type: String,
    required: [false, 'Department is required'],
  },
   position: {
    type: String,
    required: [false, 'Position is required'],
    trim: true,
    maxlength: [100, 'Position cannot be more than 100 characters']
  },
  hireDate: {
    type: Date,
    required: [false, 'Hire date is required']
  },
  salary: {
    type: Number,
    required: [false, 'Salary is required'],
    min: [0, 'Salary cannot be negative']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on-leave', 'terminated', 'pending'], // Added 'pending'
    default: 'pending' // Changed default to 'pending' for new employees
  },
  manager: {
    type: String,
    trim: true
  },
  directReports: {
    type: String,
    trim: true
  },

  // Skills and Qualifications
  skills: [{
    type: String,
    trim: true
  }],
  qualifications: [{
    degree: String,
    institution: String,
    year: Number,
    field: String
  }],
  certifications: [{
    name: String,
    issuingOrganization: String,
    issueDate: Date,
    expiryDate: Date,
    credentialId: String
  }],
   taxInformation: {
    taxId: String,
    filingStatus: String,
    allowances: Number
  },
  benefits: {
    healthInsurance: { type: Boolean, default: false },
    dentalInsurance: { type: Boolean, default: false },
    visionInsurance: { type: Boolean, default: false },
    retirement401k: { type: Boolean, default: false },
    paidTimeOff: { type: Number, default: 0 }
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
  
  // Location Information
  location: {
    // General location description (e.g., "Blantyre Office", "Lilongwe Branch")
    name: {
      type: String,
      trim: true
    },
    // Geographic coordinates for mapping/tracking
    coordinates: {
      latitude: {
        type: Number,
        min: -90,
        max: 90,
        validate: {
          validator: function(v) {
            return v === null || v === undefined || (v >= -90 && v <= 90);
          },
          message: 'Latitude must be between -90 and 90 degrees'
        }
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180,
        validate: {
          validator: function(v) {
            return v === null || v === undefined || (v >= -180 && v <= 180);
          },
          message: 'Longitude must be between -180 and 180 degrees'
        }
      }
    },
    // Work location/office details
    office: {
      type: String,
      trim: true
    },
    // Floor or specific location within building
    floor: {
      type: String,
      trim: true
    },
    // Building or facility name
    building: {
      type: String,
      trim: true
    },
    // Department/section within office
    section: {
      type: String,
      trim: true
    },
    // For tracking last known location (useful for drivers/field workers)
    lastKnownLocation: {
      latitude: Number,
      longitude: Number,
      timestamp: {
        type: Date,
        default: null
      },
      accuracy: Number, // GPS accuracy in meters
      source: {
        type: String,
        enum: ['gps', 'network', 'manual', 'check-in'],
        default: 'manual'
      }
    },
    // Time zone for the location
    timezone: {
      type: String,
      default: 'Africa/Blantyre' // Default for Malawi
    }
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
  
  // *** CRITICAL: Employee Registration Fields ***
  registrationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed', 'expired'], // Updated enum
    default: 'pending'
  },
  registrationToken: {
    type: String,
    default: null
  },
  registrationTokenExpires: {
    type: Date,
    default: null
  },
  registrationCompletedAt: {
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

// *** ADD INDEXES FOR REGISTRATION FIELDS ***
// Note: email and username indexes are automatically created by unique: true
UserSchema.index({ registrationToken: 1 });
UserSchema.index({ registrationTokenExpires: 1 });
UserSchema.index({ departmentId: 1 });

// *** ADD INDEXES FOR LOCATION FIELDS ***
UserSchema.index({ 'location.coordinates.latitude': 1, 'location.coordinates.longitude': 1 });
UserSchema.index({ 'location.name': 1 });
UserSchema.index({ 'location.office': 1 });
UserSchema.index({ 'location.lastKnownLocation.timestamp': 1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  // Don't hash if password is undefined (for registration completion)
  if (!this.password) return next();
  
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
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile (excluding sensitive data)
UserSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.verificationCode;
  delete userObject.emailVerificationCode;
  delete userObject.refreshToken;
  delete userObject.registrationToken; // Don't expose registration token
  return userObject;
};

// *** ADD REGISTRATION HELPER METHODS ***

// Method to check if registration token is valid
UserSchema.methods.isRegistrationTokenValid = function() {
  return this.registrationToken && 
         this.registrationTokenExpires && 
         this.registrationTokenExpires > Date.now();
};

// Method to clear registration data
UserSchema.methods.clearRegistrationData = function() {
  this.registrationToken = undefined;
  this.registrationTokenExpires = undefined;
  this.registrationStatus = 'completed';
  this.registrationCompletedAt = new Date();
};

// Static method to find by registration token
UserSchema.statics.findByRegistrationToken = function(token) {
  return this.findOne({
    registrationToken: token,
    registrationTokenExpires: { $gt: Date.now() }
  });
};

// *** ADD LOCATION HELPER METHODS ***

// Method to update last known location
UserSchema.methods.updateLastKnownLocation = function(latitude, longitude, accuracy = null, source = 'manual') {
  this.location = this.location || {};
  this.location.lastKnownLocation = {
    latitude,
    longitude,
    timestamp: new Date(),
    accuracy,
    source
  };
  return this.save();
};

// Method to get distance between two locations (in kilometers)
UserSchema.methods.getDistanceFrom = function(latitude, longitude) {
  if (!this.location?.coordinates?.latitude || !this.location?.coordinates?.longitude) {
    return null;
  }
  
  const R = 6371; // Earth's radius in kilometers
  const dLat = (latitude - this.location.coordinates.latitude) * Math.PI / 180;
  const dLon = (longitude - this.location.coordinates.longitude) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(this.location.coordinates.latitude * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Static method to find users near a location
UserSchema.statics.findNearLocation = function(latitude, longitude, maxDistance = 10) {
  return this.find({
    'location.coordinates.latitude': {
      $gte: latitude - (maxDistance / 111), // Rough conversion: 1 degree ≈ 111km
      $lte: latitude + (maxDistance / 111)
    },
    'location.coordinates.longitude': {
      $gte: longitude - (maxDistance / (111 * Math.cos(latitude * Math.PI / 180))),
      $lte: longitude + (maxDistance / (111 * Math.cos(latitude * Math.PI / 180)))
    }
  });
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