const mongoose = require('mongoose');

const InvitationSchema = new mongoose.Schema({
  // Personal Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true, // This creates an index automatically
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email address`
    }
  },
  
  // Professional Information
  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: [
      'procurement',
      'finance', 
      'operations',
      'cfo',
      'ceo',
      'other'
    ]
  },
  
  // Use Case Information
  useCase: {
    type: String,
    trim: true,
    maxlength: [1000, 'Use case description cannot exceed 1000 characters']
  },
  
  // Industry Information
  industry: {
    type: String,
    trim: true,
    maxlength: [100, 'Industry cannot exceed 100 characters']
  },
  
  // Company Size
  companySize: {
    type: String,
    enum: ['1-10', '11-50', '51-200', '201-1000', '1000+'],
    default: '11-50'
  },
  
  // Invitation Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'converted', 'expired'],
    default: 'pending'
  },
  
  // Priority Queue
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Queue Position
  queuePosition: {
    type: Number,
    default: null
  },
  
  // Admin Notes
  adminNotes: {
    type: String,
    trim: true,
    maxlength: [500, 'Admin notes cannot exceed 500 characters']
  },
  
  // Approval Information
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  
  // Rejection Information
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rejectedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  },
  
  // Beta Access Information
  betaAccessGranted: {
    type: Boolean,
    default: false
  },
  betaAccessToken: {
    type: String,
    default: null
  },
  betaAccessExpires: {
    type: Date,
    default: null
  },
  
  // Conversion Information
  convertedToUser: {
    type: Boolean,
    default: false
  },
  convertedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  convertedAt: {
    type: Date,
    default: null
  },
  
  // Communication History
  emailsSent: [{
    type: {
      type: String,
      enum: ['confirmation', 'approval', 'rejection', 'reminder', 'beta_access']
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    subject: String,
    content: String
  }],
  
  // Tracking Information
  source: {
    type: String,
    enum: ['website', 'referral', 'social_media', 'advertising', 'direct', 'other'],
    default: 'website'
  },
  referralCode: {
    type: String,
    trim: true
  },
  utmSource: {
    type: String,
    trim: true
  },
  utmMedium: {
    type: String,
    trim: true
  },
  utmCampaign: {
    type: String,
    trim: true
  },
  
  // IP and Device Information
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  },
  deviceInfo: {
    browser: String,
    os: String,
    device: String
  },
  
  // Geographic Information
  location: {
    country: String,
    region: String,
    city: String,
    timezone: String
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Expected conversion timeline
  expectedConversionDate: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    }
  }
}, {
  // Enable virtuals to be included in toJSON and toObject
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
InvitationSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for company info
InvitationSchema.virtual('companyInfo').get(function() {
  return `${this.company} (${this.role})`;
});

// Indexes for efficient querying (removed duplicate email index)
InvitationSchema.index({ status: 1 });
InvitationSchema.index({ priority: 1 });
InvitationSchema.index({ queuePosition: 1 });
InvitationSchema.index({ createdAt: -1 });
InvitationSchema.index({ company: 1 });
InvitationSchema.index({ role: 1 });
InvitationSchema.index({ betaAccessToken: 1 });
InvitationSchema.index({ convertedToUser: 1 });

// Text indexes for search functionality
InvitationSchema.index({
  firstName: 'text',
  lastName: 'text',
  company: 'text',
  useCase: 'text'
});

// Compound indexes
InvitationSchema.index({ status: 1, priority: 1, createdAt: -1 });
InvitationSchema.index({ status: 1, queuePosition: 1 });

// Update timestamp on save
InvitationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Validate approval/rejection consistency
  if (this.status === 'approved' && !this.approvedBy) {
    throw new Error('Approved invitations must have an approver');
  }
  
  if (this.status === 'rejected' && !this.rejectedBy) {
    throw new Error('Rejected invitations must have a rejecter');
  }
  
  next();
});

// Generate beta access token
InvitationSchema.methods.generateBetaAccessToken = function() {
  const crypto = require('crypto');
  this.betaAccessToken = crypto.randomBytes(32).toString('hex');
  this.betaAccessExpires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
  return this.betaAccessToken;
};

// Check if beta access is valid
InvitationSchema.methods.isBetaAccessValid = function() {
  return this.betaAccessToken && 
         this.betaAccessExpires && 
         this.betaAccessExpires > Date.now() && 
         this.betaAccessGranted;
};

// Add email to communication history
InvitationSchema.methods.addEmailToHistory = function(type, subject, content) {
  this.emailsSent.push({
    type,
    subject,
    content,
    sentAt: new Date()
  });
};

// Static method to get next queue position
InvitationSchema.statics.getNextQueuePosition = async function() {
  const lastInQueue = await this.findOne({ 
    status: 'pending',
    queuePosition: { $exists: true, $ne: null }
  }).sort({ queuePosition: -1 });
  
  return lastInQueue ? lastInQueue.queuePosition + 1 : 1;
};

// Static method to find pending invitations
InvitationSchema.statics.findPendingInvitations = function(limit = 50) {
  return this.find({ status: 'pending' })
    .sort({ priority: -1, queuePosition: 1, createdAt: 1 })
    .limit(limit);
};

// Static method to get invitation statistics
InvitationSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const priorityStats = await this.aggregate([
    {
      $match: { status: 'pending' }
    },
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const roleStats = await this.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 }
      }
    }
  ]);
  
  return {
    byStatus: stats,
    byPriority: priorityStats,
    byRole: roleStats
  };
};

// Static method to clean up expired beta access
InvitationSchema.statics.cleanupExpiredBetaAccess = async function() {
  const result = await this.updateMany(
    {
      betaAccessExpires: { $lt: new Date() },
      status: 'approved'
    },
    {
      $set: { 
        status: 'expired',
        betaAccessGranted: false 
      }
    }
  );
  
  return result;
};

module.exports = mongoose.model('Invitation', InvitationSchema);