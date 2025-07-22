const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Department name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Department name cannot be more than 100 characters'],
    index: true
  },
  description: {
    type: String,
    required: [true, 'Department description is required'],
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  departmentCode: {
    type: String,
    unique: true,
    sparse: true, // Allows null values but ensures uniqueness when present
    uppercase: true,
    index: true
  },
   company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },

  // Department Head Information
  departmentHead: {
    type: String,
    required: [true, 'Department head is required'],
    trim: true,
    maxlength: [100, 'Department head name cannot be more than 100 characters'],
    index: true
  },
  headEmail: {
    type: String,
    required: [true, 'Head email is required'],
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email for department head'
    ],
    index: true
  },
  headPhone: {
    type: String,
    required: [true, 'Head phone number is required'],
    trim: true,
    match: [
      /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
      'Please add a valid phone number (e.g., +1234567890)'
    ]
  },
  headEmployeeId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User' // Reference to the User model for the department head
  },

  // Location and Physical Information
  location: {
    type: String,
    required: [true, 'Department location is required'],
    trim: true,
    maxlength: [200, 'Location cannot be more than 200 characters']
  },
  floor: {
    type: String,
    trim: true
  },
  building: {
    type: String,
    trim: true
  },
  officeNumbers: [{
    type: String,
    trim: true
  }],

  // Financial Information
  budget: {
    type: Number,
    required: [true, 'Department budget is required'],
    min: [0, 'Budget cannot be negative']
  },
  actualSpending: {
    type: Number,
    default: 0,
    min: [0, 'Actual spending cannot be negative']
  },
  budgetYear: {
    type: Number,
    default: new Date().getFullYear()
  },

  // Status and Operations
  status: {
    type: String,
    enum: ['active', 'inactive', 'restructuring', 'merging', 'dissolving'],
    default: 'active',
    index: true
  },
  establishedDate: {
    type: Date,
    required: [true, 'Established date is required'],
    index: true
  },
  lastRestructureDate: {
    type: Date
  },

  // Goals and Objectives
  goals: [{
    type: String,
    trim: true
  }],
  objectives: [{
    title: String,
    description: String,
    targetDate: Date,
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'cancelled'],
      default: 'pending'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    }
  }],

  // Performance Metrics
  performance: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  kpis: [{
    name: String,
    target: Number,
    actual: Number,
    unit: String, // e.g., '%', 'count', 'currency'
    period: String, // e.g., 'monthly', 'quarterly', 'annually'
    lastUpdated: Date
  }],

  // Employee Information
  employeeCount: {
    type: Number,
    default: 0,
    min: [0, 'Employee count cannot be negative']
  },
  maxCapacity: {
    type: Number,
    min: [0, 'Max capacity cannot be negative']
  },
  employees: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }],

  // Projects and Initiatives
  activeProjects: {
    type: Number,
    default: 0,
    min: [0, 'Active projects cannot be negative']
  },
  completedProjects: {
    type: Number,
    default: 0,
    min: [0, 'Completed projects cannot be negative']
  },
  projects: [{
    name: String,
    description: String,
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ['planning', 'active', 'on-hold', 'completed', 'cancelled'],
      default: 'planning'
    },
    budget: Number,
    projectManager: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
  }],

  // Organizational Structure
  parentDepartment: {
    type: mongoose.Schema.ObjectId,
    ref: 'Department',
    index: true
  },
  subDepartments: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Department'
  }],
  reportsToDepartment: {
    type: mongoose.Schema.ObjectId,
    ref: 'Department'
  },

  // Communication and Collaboration
  meetingSchedule: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'bi-weekly', 'monthly', 'quarterly'],
      default: 'weekly'
    },
    day: String, // e.g., 'Monday'
    time: String, // e.g., '09:00'
    location: String
  },
  communicationChannels: [{
    type: {
      type: String,
      enum: ['email', 'slack', 'teams', 'discord', 'phone', 'other']
    },
    value: String,
    isPrimary: Boolean
  }],

  // Resources and Assets
  assets: [{
    name: String,
    type: {
      type: String,
      enum: ['equipment', 'software', 'facility', 'vehicle', 'other']
    },
    value: Number,
    purchaseDate: Date,
    warrantyExpiry: Date,
    location: String
  }],
  requiredSkills: [{
    skill: String,
    proficiencyLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert']
    },
    isCritical: Boolean
  }],

  // Compliance and Certifications
  certifications: [{
    name: String,
    issuingBody: String,
    obtainedDate: Date,
    expiryDate: Date,
    status: {
      type: String,
      enum: ['active', 'expired', 'pending-renewal', 'suspended']
    }
  }],
  complianceRequirements: [{
    requirement: String,
    standard: String,
    lastAuditDate: Date,
    nextAuditDate: Date,
    status: {
      type: String,
      enum: ['compliant', 'non-compliant', 'pending-review', 'in-progress']
    }
  }],

  // Historical Data
  performanceHistory: [{
    period: String, // e.g., '2024-Q1'
    metrics: {
      performance: Number,
      budget: Number,
      actualSpending: Number,
      employeeCount: Number,
      projectsCompleted: Number,
      customerSatisfaction: Number
    },
    notes: String,
    recordedDate: {
      type: Date,
      default: Date.now
    }
  }],

  // Settings and Preferences
  settings: {
    autoReporting: {
      type: Boolean,
      default: true
    },
    reportingFrequency: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly'],
      default: 'monthly'
    },
    notificationPreferences: {
      budgetAlerts: Boolean,
      performanceAlerts: Boolean,
      projectDeadlines: Boolean,
      employeeUpdates: Boolean
    }
  },

  // Audit Trail
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for budget utilization percentage
DepartmentSchema.virtual('budgetUtilization').get(function() {
  if (!this.budget || this.budget === 0) return 0;
  return Math.round((this.actualSpending / this.budget) * 100);
});

// Virtual for department age in years
DepartmentSchema.virtual('ageInYears').get(function() {
  if (!this.establishedDate) return 0;
  const diffTime = Math.abs(new Date() - this.establishedDate);
  const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365);
  return Math.floor(diffYears);
});

// Virtual for capacity utilization
DepartmentSchema.virtual('capacityUtilization').get(function() {
  if (!this.maxCapacity || this.maxCapacity === 0) return 0;
  return Math.round((this.employeeCount / this.maxCapacity) * 100);
});

// Virtual for total projects
DepartmentSchema.virtual('totalProjects').get(function() {
  return (this.activeProjects || 0) + (this.completedProjects || 0);
});

// Text Index for search functionality
DepartmentSchema.index({
  name: 'text',
  description: 'text',
  location: 'text',
  'objectives.title': 'text',
  'objectives.description': 'text'
});

// Pre-save middleware to generate department code
DepartmentSchema.pre('save', async function(next) {
  // Generate department code if not provided
  if (!this.departmentCode && this.name) {
    const nameWords = this.name.split(' ');
    let code = '';
    
    if (nameWords.length === 1) {
      code = nameWords[0].substring(0, 3).toUpperCase();
    } else {
      code = nameWords.map(word => word.charAt(0)).join('').toUpperCase();
    }
    
    // Ensure uniqueness
    let counter = 1;
    let finalCode = code;
    while (await this.constructor.findOne({ departmentCode: finalCode })) {
      finalCode = `${code}${counter}`;
      counter++;
    }
    
    this.departmentCode = finalCode;
  }
  
  // Update timestamp
  if (!this.isNew) {
    this.updatedAt = Date.now();
  }
  
  next();
});

// Pre-save middleware to update employee count
DepartmentSchema.pre('save', function(next) {
  if (this.employees && Array.isArray(this.employees)) {
    this.employeeCount = this.employees.length;
  }
  next();
});

// Static method to get active departments
DepartmentSchema.statics.getActiveDepartments = function() {
  return this.find({ status: 'active' });
};

// Static method to get departments by budget range
DepartmentSchema.statics.getDepartmentsByBudgetRange = function(minBudget, maxBudget) {
  return this.find({ 
    budget: { $gte: minBudget, $lte: maxBudget },
    status: 'active'
  });
};

// Static method to calculate total company budget
DepartmentSchema.statics.getTotalBudget = function() {
  return this.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: null, totalBudget: { $sum: '$budget' } } }
  ]);
};

// Static method to get department performance summary
DepartmentSchema.statics.getPerformanceSummary = function() {
  return this.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: null,
        avgPerformance: { $avg: '$performance' },
        totalEmployees: { $sum: '$employeeCount' },
        totalBudget: { $sum: '$budget' },
        totalActualSpending: { $sum: '$actualSpending' },
        departmentCount: { $sum: 1 }
      }
    }
  ]);
};

// Instance method to add employee
DepartmentSchema.methods.addEmployee = function(employeeId) {
  if (!this.employees.includes(employeeId)) {
    this.employees.push(employeeId);
    this.employeeCount = this.employees.length;
  }
  return this.save();
};

// Instance method to remove employee
DepartmentSchema.methods.removeEmployee = function(employeeId) {
  this.employees = this.employees.filter(id => !id.equals(employeeId));
  this.employeeCount = this.employees.length;
  return this.save();
};

// Instance method to update performance
DepartmentSchema.methods.updatePerformance = function(newPerformance, period = null) {
  this.performance = newPerformance;
  
  // Add to performance history
  if (period) {
    const historyEntry = {
      period,
      metrics: {
        performance: newPerformance,
        budget: this.budget,
        actualSpending: this.actualSpending,
        employeeCount: this.employeeCount,
        projectsCompleted: this.completedProjects
      },
      recordedDate: new Date()
    };
    
    this.performanceHistory.push(historyEntry);
  }
  
  return this.save();
};

module.exports = mongoose.model('Department', DepartmentSchema);