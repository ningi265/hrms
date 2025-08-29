const mongoose = require("mongoose");

const RFQSchema = new mongoose.Schema({
  // Core fields (existing)
   company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true }, // Added company reference
      department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true }, // Changed to ObjectId reference
  procurementOfficer: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  vendors: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" ,
    required: true 
  }], // Vendors invited to bid
  itemName: { 
    type: String, 
    required: true,
    trim: true
  },
  quantity: { 
    type: Number, 
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  status: { 
    type: String, 
    enum: ["open", "closed", "pending", "cancelled"], 
    default: "open" 
  },

 deadline: { 
  type: Date,
  validate: {
    validator: function(value) {
      // Allow past deadlines if RFQ is already closed
      if (this.status === 'closed') return true;
      
      // For open RFQs, deadline must be in the future
      return !value || value > new Date();
    },
    message: 'Deadline must be in the future for open RFQs'
  }
},
  description: { 
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  estimatedBudget: { 
    type: Number,
    min: [0, 'Estimated budget cannot be negative']
  },
  priority: { 
    type: String, 
    enum: {
      values: ['low', 'medium', 'high'],
      message: 'Priority must be low, medium, or high'
    },
    default: 'medium' 
  },
  deliveryLocation: { 
    type: String,
    trim: true,
    maxlength: [200, 'Delivery location cannot exceed 200 characters']
  },
  specifications: { 
    type: String,
    trim: true,
    maxlength: [2000, 'Specifications cannot exceed 2000 characters']
  },
  
  // Requisition linkage
  requisitionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Requisition",
    index: true // Add index for faster queries
  },

  // Quote management (existing with enhancements)
  quotes: [{
    vendor: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Vendor",
      required: true
    },
    price: { 
      type: Number, 
      required: true,
      min: [0, 'Price cannot be negative']
    },
    deliveryTime: { 
      type: String,
      trim: true
    },
    notes: { 
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    submittedAt: {
      type: Date,
      default: Date.now
    },
    isValid: {
      type: Boolean,
      default: true
    }
  }],

  // Vendor selection (existing)
  selectedVendor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  },
  
  // Additional tracking fields
  selectedQuote: {
    type: mongoose.Schema.Types.ObjectId
  },
  selectionReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Selection reason cannot exceed 500 characters']
  },
  
  // Audit and tracking
  viewedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    viewedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Status tracking
  openedAt: {
    type: Date,
    default: Date.now
  },
  closedAt: {
    type: Date
  },
  
  // Notification tracking
  notificationsSent: {
    type: Boolean,
    default: false
  },
  remindersSent: {
    type: Number,
    default: 0
  },
}, { 
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
RFQSchema.index({ procurementOfficer: 1, status: 1 });
RFQSchema.index({ vendors: 1 });
RFQSchema.index({ deadline: 1 });
RFQSchema.index({ priority: 1, status: 1 });
RFQSchema.index({ createdAt: -1 });

// Virtual for quote count
RFQSchema.virtual('quoteCount').get(function() {
  return this.quotes ? this.quotes.length : 0;
});

// Virtual for vendor count
RFQSchema.virtual('vendorCount').get(function() {
  return this.vendors ? this.vendors.length : 0;
});

// Virtual for days until deadline
RFQSchema.virtual('daysUntilDeadline').get(function() {
  if (!this.deadline) return null;
  const today = new Date();
  const deadline = new Date(this.deadline);
  const diffTime = deadline - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for completion percentage
RFQSchema.virtual('completionPercentage').get(function() {
  if (!this.vendors || this.vendors.length === 0) return 0;
  const quotesReceived = this.quotes ? this.quotes.length : 0;
  return Math.round((quotesReceived / this.vendors.length) * 100);
});

// Virtual for status badge color (for frontend)
RFQSchema.virtual('statusColor').get(function() {
  switch (this.status) {
    case 'open': return 'green';
    case 'closed': return 'blue';
    case 'pending': return 'yellow';
    case 'cancelled': return 'red';
    default: return 'gray';
  }
});

// Virtual for priority badge color
RFQSchema.virtual('priorityColor').get(function() {
  switch (this.priority) {
    case 'high': return 'red';
    case 'medium': return 'yellow';
    case 'low': return 'green';
    default: return 'gray';
  }
});

// Pre-save middleware to handle status changes
RFQSchema.pre('save', function(next) {
  // Set closedAt when status changes to closed
  if (this.isModified('status') && this.status === 'closed' && !this.closedAt) {
    this.closedAt = new Date();
  }
  
  // Validate deadline is not in the past for open RFQs
  if (this.status === 'open' && this.deadline && this.deadline <= new Date()) {
    const error = new Error('Cannot set deadline in the past for open RFQs');
    return next(error);
  }
  
  next();
});

// Instance method to check if RFQ is expired
RFQSchema.methods.isExpired = function() {
  return this.deadline && new Date() > this.deadline;
};

// Instance method to get lowest quote
RFQSchema.methods.getLowestQuote = function() {
  if (!this.quotes || this.quotes.length === 0) return null;
  return this.quotes.reduce((lowest, current) => {
    return current.price < lowest.price ? current : lowest;
  });
};

// Instance method to get quote by vendor
RFQSchema.methods.getQuoteByVendor = function(vendorId) {
  if (!this.quotes) return null;
  return this.quotes.find(quote => 
    quote.vendor.toString() === vendorId.toString()
  );
};

// Static method to find RFQs by procurement officer
RFQSchema.statics.findByProcurementOfficer = function(procurementOfficerId) {
  return this.find({ procurementOfficer: procurementOfficerId })
    .populate('vendors', 'name email')
    .populate('procurementOfficer', 'name email')
    .sort({ createdAt: -1 });
};

// Static method to find RFQs for vendor
RFQSchema.statics.findForVendor = function(vendorId) {
  return this.find({ vendors: vendorId })
    .populate('procurementOfficer', 'name email department')
    .populate('vendors', 'name email')
    .sort({ createdAt: -1 });
};

// Static method to find expiring RFQs
RFQSchema.statics.findExpiringSoon = function(days = 3) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    status: 'open',
    deadline: {
      $gte: new Date(),
      $lte: futureDate
    }
  }).populate('procurementOfficer vendors');
};

module.exports = mongoose.model("RFQ", RFQSchema);