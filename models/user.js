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
    sparse: true,
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
    sparse: true
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
    enum: ['active', 'inactive', 'on-leave', 'terminated', 'pending'],
    default: 'pending'
  },
  manager: {
    type: String,
    trim: true
  },
  directReports: {
    type: String,
    trim: true
  },


  company: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Company',
  required: true
},
department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
  },
enterpriseRoles: [{
  type: String,
  enum: ['CEO', 'CFO', 'CTO', 'COO', 'Manager', 'Director', 'Executive'],
  default: []
}],
isEnterpriseAdmin: {
  type: Boolean,
  default: false
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
    default: 'Malawi'
  },
  
  // Enhanced Location Information for Live Tracking
  location: {
    // General location description
    name: {
      type: String,
      trim: true
    },
    // Primary coordinates for the user's base location
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
    // Work location details
    office: {
      type: String,
      trim: true
    },
    floor: {
      type: String,
      trim: true
    },
    building: {
      type: String,
      trim: true
    },
    section: {
      type: String,
      trim: true
    },
    // Enhanced last known location for live tracking
    lastKnownLocation: {
      latitude: {
        type: Number,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180
      },
      timestamp: {
        type: Date,
        default: null
      },
      accuracy: {
        type: Number, // GPS accuracy in meters
        min: 0
      },
      source: {
        type: String,
        enum: ['gps', 'network', 'manual', 'check-in', 'wifi', 'bluetooth'],
        default: 'manual'
      },
      // NEW: Enhanced tracking fields
      speed: {
        type: Number, // Speed in km/h
        min: 0,
        max: 300 // Maximum reasonable speed
      },
      heading: {
        type: Number, // Direction in degrees (0-359)
        min: 0,
        max: 359
      },
      altitude: {
        type: Number // Altitude in meters
      },
      batteryLevel: {
        type: Number, // Battery percentage (0-100)
        min: 0,
        max: 100
      },
      signalStrength: {
        type: Number // Signal strength percentage
      },
      deviceInfo: {
        deviceId: String,
        platform: String, // 'ios', 'android', 'web'
        appVersion: String
      }
    },
    // NEW: Location history for tracking patterns
    locationHistory: [{
      latitude: Number,
      longitude: Number,
      timestamp: Date,
      accuracy: Number,
      source: String,
      speed: Number,
      heading: Number
    }],
    // NEW: Geofencing settings
    geofences: [{
      name: String,
      type: { type: String, enum: ['circle', 'polygon'] },
      center: {
        latitude: Number,
        longitude: Number
      },
      radius: Number, // For circle geofences (in meters)
      coordinates: [[Number]], // For polygon geofences
      isActive: { type: Boolean, default: true },
      createdAt: { type: Date, default: Date.now }
    }],
    // Time zone for the location
    timezone: {
      type: String,
      default: 'Africa/Blantyre'
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
    required: [false, 'Industry is required'],
    trim: true
  },
  role: { 
    type: String, 
    required: true,
    enum: [
      'IT/Technical', 'Executive (CEO, CFO, etc.)', 'Management', 'Sales/Marketing','Driver', 
      'Operations', 'Human Resources', 'Accounting/Finance', 'Other', 'user','employee','Vendor',"Enterprise(CEO, CFO, etc.)","Software Engineer",
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
    "Customer Success Manager"
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
        if (!v) return true;
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
  
  // Employee Registration Fields
  registrationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed', 'expired'],
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


  billing: {
     trialStartDate: {
      type: Date,
      default: null
    },
     trialEndDate: {
      type: Date,
      default: null
    },
    subscription: {
         plan: {
        type: String,
        enum: ['trial', 'starter', 'professional', 'enterprise'],
        default: 'trial'
      },
      status: {
        type: String,
        enum: ['active', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'trialing'],
        default: 'trialing'
      },
      currentPeriodStart: Date,
      currentPeriodEnd: Date,
      cancelAtPeriodEnd: Boolean,
      subscriptionId: String, 
      priceId: String
    },


  },
  usage: {
     apiCalls: {
      count: { type: Number, default: 0 },
      lastReset: Date
    },
    storage: {
      used: { type: Number, default: 0 }, // in MB
      limit: { type: Number, default: 100 } // Default 100MB for trial
    }
    
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
      match: /^(0[1-9]|1[0-2])$/
    },
    expiryYear: {
      type: String,
      required: true,
      match: /^\d{4}$/
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

  invoices: [{
      id: String,
      amount: Number,
      currency: String,
      status: String,
      pdfUrl: String,
      createdAt: Date
    }]
});



// Indexes for efficient querying
UserSchema.index({ registrationToken: 1 });
UserSchema.index({ registrationTokenExpires: 1 });
UserSchema.index({ departmentId: 1 });
UserSchema.index({ 'location.coordinates.latitude': 1, 'location.coordinates.longitude': 1 });
UserSchema.index({ 'location.name': 1 });
UserSchema.index({ 'location.office': 1 });
UserSchema.index({ 'location.lastKnownLocation.timestamp': 1 });
UserSchema.index({ 'location.lastKnownLocation.latitude': 1, 'location.lastKnownLocation.longitude': 1 });
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ lastLoginAt: 1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
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
      this.paymentMethods.forEach((method, index) => {
        method.isDefault = index === this.paymentMethods.length - 1 && method.isDefault;
      });
    }
  }
  next();
});

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

// Method to get public profile
UserSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.verificationCode;
  delete userObject.emailVerificationCode;
  delete userObject.refreshToken;
  delete userObject.registrationToken;
  return userObject;
};

// Registration helper methods
UserSchema.methods.isRegistrationTokenValid = function() {
  return this.registrationToken && 
         this.registrationTokenExpires && 
         this.registrationTokenExpires > Date.now();
};

UserSchema.methods.clearRegistrationData = function() {
  this.registrationToken = undefined;
  this.registrationTokenExpires = undefined;
  this.registrationStatus = 'completed';
  this.registrationCompletedAt = new Date();
};

UserSchema.statics.findByRegistrationToken = function(token) {
  return this.findOne({
    registrationToken: token,
    registrationTokenExpires: { $gt: Date.now() }
  });
};

// Enhanced Location Helper Methods

// Enhanced method to update last known location with additional tracking data
UserSchema.methods.updateLastKnownLocation = function(latitude, longitude, accuracy = null, source = 'manual', additionalData = {}) {
  this.location = this.location || {};
  
  const locationUpdate = {
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    timestamp: new Date(),
    accuracy: accuracy ? parseFloat(accuracy) : null,
    source
  };

  // Add optional tracking data
  if (additionalData.speed !== undefined) {
    locationUpdate.speed = parseFloat(additionalData.speed);
  }
  if (additionalData.heading !== undefined) {
    locationUpdate.heading = parseFloat(additionalData.heading);
  }
  if (additionalData.altitude !== undefined) {
    locationUpdate.altitude = parseFloat(additionalData.altitude);
  }
  if (additionalData.batteryLevel !== undefined) {
    locationUpdate.batteryLevel = parseInt(additionalData.batteryLevel);
  }
  if (additionalData.signalStrength !== undefined) {
    locationUpdate.signalStrength = parseFloat(additionalData.signalStrength);
  }
  if (additionalData.deviceInfo) {
    locationUpdate.deviceInfo = additionalData.deviceInfo;
  }

  this.location.lastKnownLocation = locationUpdate;

  // Also update main coordinates for consistency
  this.location.coordinates = {
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude)
  };

  // NEW: Add to location history (keep last 100 locations)
  this.location.locationHistory = this.location.locationHistory || [];
  this.location.locationHistory.unshift({
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    timestamp: new Date(),
    accuracy: accuracy ? parseFloat(accuracy) : null,
    source,
    speed: additionalData.speed ? parseFloat(additionalData.speed) : null,
    heading: additionalData.heading ? parseFloat(additionalData.heading) : null
  });

  // Keep only last 100 location history entries
  if (this.location.locationHistory.length > 100) {
    this.location.locationHistory = this.location.locationHistory.slice(0, 100);
  }

  return this.save();
};

// Method to get distance between two locations (in kilometers)
UserSchema.methods.getDistanceFrom = function(latitude, longitude) {
  const userLat = this.location?.lastKnownLocation?.latitude || this.location?.coordinates?.latitude;
  const userLng = this.location?.lastKnownLocation?.longitude || this.location?.coordinates?.longitude;
  
  if (!userLat || !userLng) {
    return null;
  }
  
  const R = 6371; // Earth's radius in kilometers
  const dLat = (latitude - userLat) * Math.PI / 180;
  const dLon = (longitude - userLng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(userLat * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// NEW: Method to check if user is within a geofence
UserSchema.methods.isWithinGeofence = function(geofenceName) {
  const userLocation = this.location?.lastKnownLocation;
  if (!userLocation) return false;

  const geofence = this.location?.geofences?.find(gf => gf.name === geofenceName && gf.isActive);
  if (!geofence) return false;

  if (geofence.type === 'circle') {
    const distance = this.getDistanceFrom(geofence.center.latitude, geofence.center.longitude);
    return distance !== null && distance * 1000 <= geofence.radius; // Convert km to meters
  }

  // For polygon geofences, you'd implement point-in-polygon algorithm
  return false;
};

// NEW: Method to get recent location history
UserSchema.methods.getRecentLocationHistory = function(hoursBack = 24) {
  if (!this.location?.locationHistory) return [];
  
  const cutoffTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000));
  return this.location.locationHistory.filter(loc => loc.timestamp >= cutoffTime);
};

// NEW: Method to calculate travel distance from location history
UserSchema.methods.calculateTravelDistance = function(hoursBack = 24) {
  const history = this.getRecentLocationHistory(hoursBack);
  if (history.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < history.length; i++) {
    const prev = history[i-1];
    const curr = history[i];
    
    // Calculate distance between consecutive points
    const R = 6371; // Earth's radius in kilometers
    const dLat = (curr.latitude - prev.latitude) * Math.PI / 180;
    const dLon = (curr.longitude - prev.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(prev.latitude * Math.PI / 180) * Math.cos(curr.latitude * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    totalDistance += R * c;
  }
  
  return totalDistance; // Returns distance in kilometers
};

// Static method to find users near a location
UserSchema.statics.findNearLocation = function(latitude, longitude, maxDistance = 10) {
  return this.find({
    $or: [
      {
        'location.lastKnownLocation.latitude': {
          $gte: latitude - (maxDistance / 111),
          $lte: latitude + (maxDistance / 111)
        },
        'location.lastKnownLocation.longitude': {
          $gte: longitude - (maxDistance / (111 * Math.cos(latitude * Math.PI / 180))),
          $lte: longitude + (maxDistance / (111 * Math.cos(latitude * Math.PI / 180)))
        }
      },
      {
        'location.coordinates.latitude': {
          $gte: latitude - (maxDistance / 111),
          $lte: latitude + (maxDistance / 111)
        },
        'location.coordinates.longitude': {
          $gte: longitude - (maxDistance / (111 * Math.cos(latitude * Math.PI / 180))),
          $lte: longitude + (maxDistance / (111 * Math.cos(latitude * Math.PI / 180)))
        }
      }
    ]
  });
};

// NEW: Static method to find drivers with recent location updates
UserSchema.statics.findActiveDriversWithLocation = function(minutesBack = 30) {
  const cutoffTime = new Date(Date.now() - (minutesBack * 60 * 1000));
  return this.find({
    role: 'Driver',
    status: 'active',
    'location.lastKnownLocation.timestamp': { $gte: cutoffTime }
  });
};

// Add method to check trial status
UserSchema.methods.isOnTrial = function() {
  return this.billing.subscription.plan === 'trial' && 
         this.billing.trialEndDate > new Date();
};

// Add method to check if trial has expired
UserSchema.methods.hasTrialExpired = function() {
  return this.billing.subscription.plan === 'trial' && 
         this.billing.trialEndDate <= new Date();
};

// Add method to get remaining trial days
UserSchema.methods.getRemainingTrialDays = function() {
  if (!this.isOnTrial()) return 0;
  const diffTime = this.billing.trialEndDate - new Date();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// NEW: Static method to find moving drivers
UserSchema.statics.findMovingDrivers = function(minSpeed = 5, minutesBack = 10) {
  const cutoffTime = new Date(Date.now() - (minutesBack * 60 * 1000));
  return this.find({
    role: 'Driver',
    'location.lastKnownLocation.speed': { $gte: minSpeed },
    'location.lastKnownLocation.timestamp': { $gte: cutoffTime }
  });
};

// Migration helper (keep existing functionality)
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



// Password reset functionality (keep existing)
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  
  const resetToken = crypto.randomBytes(20).toString('hex');
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
  await user.save();
  
  sendResetEmail(user.email, resetToken);
  
  res.status(200).json({ message: "Reset link sent" });
};

module.exports = mongoose.model('User', UserSchema);