const mongoose = require('mongoose');

const BudgetAllocationSchema = new mongoose.Schema({
  // Basic Information
  budgetPeriod: {
    type: String,
    required: [true, 'Budget period is required'],
    trim: true,
    index: true
    // Format: 'YYYY-QX' (e.g., '2024-Q1') or 'YYYY-MM' for monthly
  },
  budgetYear: {
    type: Number,
    required: [true, 'Budget year is required'],
    min: [2020, 'Budget year must be 2020 or later'],
    max: [2050, 'Budget year cannot exceed 2050'],
    index: true
  },
  quarter: {
    type: String,
    enum: ['Q1', 'Q2', 'Q3', 'Q4'],
    index: true
  },
  
  // Total Budget Information
  totalBudget: {
    type: Number,
    required: [true, 'Total budget is required'],
    min: [0, 'Total budget cannot be negative']
  },
  totalAllocated: {
    type: Number,
    default: 0,
    min: [0, 'Total allocated cannot be negative']
  },
  remainingBudget: {
    type: Number,
    default: 0
  },
  
  // Status and Approval
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'active', 'closed', 'cancelled'],
    default: 'draft',
    index: true
  },
  approvalStatus: {
    type: String,
    enum: ['not_submitted', 'pending_review', 'approved', 'rejected', 'revision_required'],
    default: 'not_submitted'
  },
  
  // Department Allocations
  departmentAllocations: [{
    department: {
      type: mongoose.Schema.ObjectId,
      ref: 'Department',
      required: true
    },
    departmentName: {
      type: String,
      required: true
    },
    departmentCode: {
      type: String,
      required: true
    },
    allocatedAmount: {
      type: Number,
      required: [true, 'Allocated amount is required'],
      min: [0, 'Allocated amount cannot be negative']
    },
    previousAllocation: {
      type: Number,
      default: 0
    },
    allocationChange: {
      type: Number,
      default: 0
    },
    allocationPercentage: {
      type: Number,
      min: [0, 'Allocation percentage cannot be negative'],
      max: [100, 'Allocation percentage cannot exceed 100']
    },
    category: {
      type: String,
      enum: [
        'Equipment',
        'Software Licenses',
        'Training & Development',
        'Travel & Transportation',
        'Office Supplies',
        'Consulting Services',
        'Utilities',
        'Maintenance',
        'Marketing & Advertising',
        'Research & Development',
        'Personnel',
        'Operations',
        'Other'
      ],
      required: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    justification: {
      type: String,
      trim: true,
      maxlength: [1000, 'Justification cannot exceed 1000 characters']
    },
    allocatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    allocatedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Approval Workflow
  approvalWorkflow: [{
    approver: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    approverRole: {
      type: String,
      required: true
    },
    action: {
      type: String,
      enum: ['approved', 'rejected', 'revision_required'],
      required: true
    },
    comments: {
      type: String,
      trim: true
    },
    approvedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Budget Categories Summary
  categorySummary: [{
    category: {
      type: String,
      required: true
    },
    totalAllocated: {
      type: Number,
      required: true,
      min: [0, 'Category allocation cannot be negative']
    },
    percentage: {
      type: Number,
      min: [0, 'Category percentage cannot be negative']
    },
    departmentCount: {
      type: Number,
      default: 0
    }
  }],

  // Comparison with Previous Period
  previousPeriodComparison: {
    previousPeriod: String,
    previousTotalBudget: Number,
    budgetChange: Number,
    budgetChangePercentage: Number,
    departmentChanges: [{
      department: {
        type: mongoose.Schema.ObjectId,
        ref: 'Department'
      },
      previousAmount: Number,
      currentAmount: Number,
      change: Number,
      changePercentage: Number
    }]
  },

  // Budget Constraints and Rules
  constraints: {
    maxDepartmentAllocation: {
      type: Number,
      min: [0, 'Max department allocation cannot be negative']
    },
    minDepartmentAllocation: {
      type: Number,
      min: [0, 'Min department allocation cannot be negative']
    },
    allocationRules: [{
      rule: String,
      description: String,
      isActive: {
        type: Boolean,
        default: true
      }
    }]
  },

  // Notifications and Alerts
  notifications: [{
    type: {
      type: String,
      enum: ['budget_exceeded', 'low_allocation', 'approval_required', 'deadline_approaching'],
      required: true
    },
    message: String,
    isRead: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Timeline and Deadlines
  timeline: {
    submissionDeadline: Date,
    approvalDeadline: Date,
    implementationDate: Date,
    reviewDate: Date
  },

  // Audit Trail
  auditLog: [{
    action: {
      type: String,
      required: true
    },
    performedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    description: String,
    oldValues: mongoose.Schema.Types.Mixed,
    newValues: mongoose.Schema.Types.Mixed,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],

  // Metadata
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  submittedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  submittedAt: Date,
  approvedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,

  // Settings
  settings: {
    allowPartialAllocation: {
      type: Boolean,
      default: true
    },
    requireJustification: {
      type: Boolean,
      default: false
    },
    autoCalculatePercentages: {
      type: Boolean,
      default: true
    },
    notifyOnChanges: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
BudgetAllocationSchema.index({ budgetPeriod: 1, status: 1 });
BudgetAllocationSchema.index({ budgetYear: 1, quarter: 1 });
BudgetAllocationSchema.index({ 'departmentAllocations.department': 1 });
BudgetAllocationSchema.index({ createdBy: 1, status: 1 });

// Virtual for allocation efficiency
BudgetAllocationSchema.virtual('allocationEfficiency').get(function() {
  if (!this.totalBudget || this.totalBudget === 0) return 0;
  return (this.totalAllocated / this.totalBudget) * 100;
});

// Virtual for over/under allocation
BudgetAllocationSchema.virtual('allocationStatus').get(function() {
  const efficiency = this.allocationEfficiency;
  if (efficiency > 100) return 'over_allocated';
  if (efficiency < 95) return 'under_allocated';
  return 'optimal';
});

// Virtual for department count
BudgetAllocationSchema.virtual('departmentCount').get(function() {
  return this.departmentAllocations ? this.departmentAllocations.length : 0;
});

// Pre-save middleware to calculate totals and percentages
BudgetAllocationSchema.pre('save', function(next) {
  // Calculate total allocated
  this.totalAllocated = this.departmentAllocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0);
  
  // Calculate remaining budget
  this.remainingBudget = this.totalBudget - this.totalAllocated;
  
  // Calculate allocation percentages for each department
  if (this.totalBudget > 0) {
    this.departmentAllocations.forEach(alloc => {
      alloc.allocationPercentage = (alloc.allocatedAmount / this.totalBudget) * 100;
      alloc.allocationChange = alloc.allocatedAmount - (alloc.previousAllocation || 0);
    });
  }
  
  // Calculate category summary
  this.categorySummary = this.calculateCategorySummary();
  
  next();
});

// Method to calculate category summary
BudgetAllocationSchema.methods.calculateCategorySummary = function() {
  const categoryMap = new Map();
  
  this.departmentAllocations.forEach(alloc => {
    if (categoryMap.has(alloc.category)) {
      const existing = categoryMap.get(alloc.category);
      existing.totalAllocated += alloc.allocatedAmount;
      existing.departmentCount += 1;
    } else {
      categoryMap.set(alloc.category, {
        category: alloc.category,
        totalAllocated: alloc.allocatedAmount,
        departmentCount: 1
      });
    }
  });
  
  const summary = Array.from(categoryMap.values());
  
  // Calculate percentages
  if (this.totalAllocated > 0) {
    summary.forEach(cat => {
      cat.percentage = (cat.totalAllocated / this.totalAllocated) * 100;
    });
  }
  
  return summary;
};

// Method to add allocation
BudgetAllocationSchema.methods.addDepartmentAllocation = function(departmentId, departmentName, departmentCode, amount, category, options = {}) {
  const allocation = {
    department: departmentId,
    departmentName,
    departmentCode,
    allocatedAmount: amount,
    category,
    priority: options.priority || 'medium',
    notes: options.notes || '',
    justification: options.justification || '',
    allocatedBy: options.allocatedBy,
    allocatedAt: new Date()
  };
  
  this.departmentAllocations.push(allocation);
  return this.save();
};

// Method to update allocation
BudgetAllocationSchema.methods.updateDepartmentAllocation = function(departmentId, updates) {
  const allocation = this.departmentAllocations.find(alloc => 
    alloc.department.toString() === departmentId.toString()
  );
  
  if (!allocation) {
    throw new Error('Department allocation not found');
  }
  
  Object.assign(allocation, updates);
  return this.save();
};

// Method to remove allocation
BudgetAllocationSchema.methods.removeDepartmentAllocation = function(departmentId) {
  this.departmentAllocations = this.departmentAllocations.filter(alloc => 
    alloc.department.toString() !== departmentId.toString()
  );
  return this.save();
};

// Method to submit for approval
BudgetAllocationSchema.methods.submitForApproval = function(userId) {
  this.status = 'pending_approval';
  this.approvalStatus = 'pending_review';
  this.submittedBy = userId;
  this.submittedAt = new Date();
  
  // Add audit log entry
  this.auditLog.push({
    action: 'submitted_for_approval',
    performedBy: userId,
    description: 'Budget allocation submitted for approval',
    timestamp: new Date()
  });
  
  return this.save();
};

// Method to approve allocation
BudgetAllocationSchema.methods.approve = function(userId, comments = '') {
  this.status = 'approved';
  this.approvalStatus = 'approved';
  this.approvedBy = userId;
  this.approvedAt = new Date();
  
  // Add to approval workflow
  this.approvalWorkflow.push({
    approver: userId,
    approverRole: 'Budget Manager', // This should be dynamic based on user role
    action: 'approved',
    comments,
    approvedAt: new Date()
  });
  
  // Add audit log entry
  this.auditLog.push({
    action: 'approved',
    performedBy: userId,
    description: 'Budget allocation approved',
    timestamp: new Date()
  });
  
  return this.save();
};

// Method to reject allocation
BudgetAllocationSchema.methods.reject = function(userId, comments = '') {
  this.status = 'draft';
  this.approvalStatus = 'rejected';
  
  // Add to approval workflow
  this.approvalWorkflow.push({
    approver: userId,
    approverRole: 'Budget Manager',
    action: 'rejected',
    comments,
    approvedAt: new Date()
  });
  
  // Add audit log entry
  this.auditLog.push({
    action: 'rejected',
    performedBy: userId,
    description: 'Budget allocation rejected',
    timestamp: new Date()
  });
  
  return this.save();
};

// Static methods
BudgetAllocationSchema.statics.getByPeriod = function(budgetPeriod) {
  return this.findOne({ budgetPeriod, status: { $ne: 'cancelled' } })
    .populate('departmentAllocations.department')
    .populate('createdBy', 'firstName lastName')
    .populate('approvedBy', 'firstName lastName');
};

BudgetAllocationSchema.statics.getCurrentAllocation = function() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);
  
  return this.findOne({ 
    budgetYear: currentYear, 
    quarter: `Q${currentQuarter}`,
    status: { $in: ['approved', 'active'] }
  }).populate('departmentAllocations.department');
};

BudgetAllocationSchema.statics.getAllocationHistory = function(departmentId, limit = 10) {
  return this.find({
    'departmentAllocations.department': departmentId,
    status: { $ne: 'cancelled' }
  })
  .sort({ budgetYear: -1, quarter: -1 })
  .limit(limit)
  .populate('createdBy', 'firstName lastName');
};

module.exports = mongoose.model('BudgetAllocation', BudgetAllocationSchema);