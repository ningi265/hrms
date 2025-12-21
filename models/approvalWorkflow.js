import mongoose from 'mongoose';

const workflowNodeSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['start', 'approval', 'condition', 'parallel', 'notification', 'end'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  position: {
    x: Number,
    y: Number
  },
  // For approval nodes
  approvers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: String,
    email: String,
    role: String
  }],
  approvalType: {
    type: String,
    enum: ['sequential', 'parallel', 'any'],
    default: 'sequential'
  },
  minApprovals: {
    type: Number,
    default: 1
  },
  // For condition nodes
  conditions: [{
    field: String,
    operator: {
      type: String,
      enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in', 'not-in']
    },
    value: mongoose.Schema.Types.Mixed,
    logicalOperator: {
      type: String,
      enum: ['AND', 'OR'],
      default: 'AND'
    }
  }],
  trueBranch: String, // Node ID for true condition
  falseBranch: String, // Node ID for false condition
  // For all nodes
  timeoutHours: {
    type: Number,
    default: 24
  },
  escalationTo: {
    type: String,
    ref: 'User'
  },
  isMandatory: {
    type: Boolean,
    default: true
  },
  canDelegate: {
    type: Boolean,
    default: true
  },
  actions: [{
    type: String,
    enum: ['notify', 'escalate', 'auto-approve', 'reject']
  }],
  metadata: mongoose.Schema.Types.Mixed
});

const workflowConnectionSchema = new mongoose.Schema({
  from: {
    type: String,
    required: true
  },
  to: {
    type: String,
    required: true
  },
  condition: String, // 'true', 'false', or custom condition
  order: Number
});

const triggerConditionSchema = new mongoose.Schema({
  field: {
    type: String,
    required: true
  },
  operator: {
    type: String,
    enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in', 'not-in', 'regex'],
    required: true
  },
  value: mongoose.Schema.Types.Mixed,
  logicalOperator: {
    type: String,
    enum: ['AND', 'OR'],
    default: 'AND'
  }
});

const approvalWorkflowSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  code: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  // Scope configuration
  applyToAll: {
    type: Boolean,
    default: false
  },
  departments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  }],
  departmentCodes: [String],
  categories: [{
    type: String,
    enum: ['Computing Hardware', 'Office Equipment', 'Furniture', 'Software & Licenses', 'Networking', 'Audio/Visual', 'Travel & Accommodation', 'Other']
  }],
  // Amount thresholds
  minAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  maxAmount: {
    type: Number,
    min: 0
  },
  // Trigger conditions
  triggerConditions: [triggerConditionSchema],
  // Workflow structure
  nodes: [workflowNodeSchema],
  connections: [workflowConnectionSchema],
  // Approval settings
  slaHours: {
    type: Number,
    min: 1,
    default: 72
  },
  autoApproveBelow: {
    type: Number,
    min: 0
  },
  requireCFOAbove: {
    type: Number,
    min: 0,
    default: 500000
  },
  requireLegalReview: {
    type: Boolean,
    default: false
  },
  requireITReview: {
    type: Boolean,
    default: false
  },
  allowDelegation: {
    type: Boolean,
    default: true
  },
  // Notifications
  notifications: [{
    type: {
      type: String,
      enum: ['email', 'in-app', 'sms', 'slack']
    },
    template: String,
    recipients: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    triggers: [{
      type: String,
      enum: ['on-submit', 'on-approve', 'on-reject', 'on-escalate', 'on-timeout']
    }]
  }],
  // Statistics
  statistics: {
    totalRequests: {
      type: Number,
      default: 0
    },
    avgApprovalTime: Number, // in hours
    completionRate: Number, // percentage
    lastUsed: Date
  },
  // Versioning
  version: {
    type: String,
    default: '1.0'
  },
  isDraft: {
    type: Boolean,
    default: false
  },
  publishedVersion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApprovalWorkflow'
  },
  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Generate workflow code before saving
approvalWorkflowSchema.pre('save', async function(next) {
  if (!this.code) {
    const count = await this.constructor.countDocuments({ company: this.company });
    this.code = `WF-${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

// Virtual for active instances
approvalWorkflowSchema.virtual('activeInstances', {
  ref: 'Requisition',
  localField: '_id',
  foreignField: 'workflow',
  count: true,
  match: { status: { $in: ['pending', 'in-review', 'in-approval'] } }
});

// Method to evaluate if workflow applies to a requisition
approvalWorkflowSchema.methods.appliesToRequisition = function(requisition) {
  // Check if workflow is active
  if (!this.isActive || this.isDraft) return false;

  // Check applyToAll flag
  if (this.applyToAll) return true;

  // Check departments
  if (this.departments.length > 0 && requisition.department) {
    const deptMatch = this.departments.some(dept => 
      dept.equals(requisition.department) || 
      this.departmentCodes.includes(requisition.departmentCode)
    );
    if (!deptMatch) return false;
  }

  // Check categories
  if (this.categories.length > 0 && requisition.category) {
    if (!this.categories.includes(requisition.category)) return false;
  }

  // Check amount range
  if (requisition.estimatedCost) {
    if (requisition.estimatedCost < this.minAmount) return false;
    if (this.maxAmount && requisition.estimatedCost > this.maxAmount) return false;
  }

  // Check trigger conditions
  if (this.triggerConditions.length > 0) {
    const meetsAllConditions = this.triggerConditions.every(condition => {
      const fieldValue = requisition[condition.field];
      
      switch(condition.operator) {
        case 'eq':
          return fieldValue == condition.value;
        case 'neq':
          return fieldValue != condition.value;
        case 'gt':
          return fieldValue > condition.value;
        case 'gte':
          return fieldValue >= condition.value;
        case 'lt':
          return fieldValue < condition.value;
        case 'lte':
          return fieldValue <= condition.value;
        case 'contains':
          return fieldValue && fieldValue.includes(condition.value);
        case 'in':
          return condition.value.includes(fieldValue);
        case 'not-in':
          return !condition.value.includes(fieldValue);
        default:
          return true;
      }
    });
    
    if (!meetsAllConditions) return false;
  }

  return true;
};

// Method to get next approvers for a requisition
approvalWorkflowSchema.methods.getNextApprovers = function(currentNodeId, requisition) {
  const currentNode = this.nodes.find(node => node.id === currentNodeId);
  if (!currentNode) return [];

  // For condition nodes, evaluate and get next node
  if (currentNode.type === 'condition') {
    const meetsCondition = this.evaluateConditions(currentNode.conditions, requisition);
    const nextNodeId = meetsCondition ? currentNode.trueBranch : currentNode.falseBranch;
    const nextNode = this.nodes.find(node => node.id === nextNodeId);
    return nextNode ? nextNode.approvers : [];
  }

  // For approval nodes, return approvers
  if (currentNode.type === 'approval' || currentNode.type === 'parallel') {
    return currentNode.approvers;
  }

  return [];
};

// Method to evaluate conditions
approvalWorkflowSchema.methods.evaluateConditions = function(conditions, requisition) {
  if (!conditions || conditions.length === 0) return true;

  let result = true;
  let logicalOperator = 'AND';

  for (const condition of conditions) {
    const fieldValue = requisition[condition.field];
    let conditionResult = false;

    switch(condition.operator) {
      case 'eq':
        conditionResult = fieldValue == condition.value;
        break;
      case 'neq':
        conditionResult = fieldValue != condition.value;
        break;
      case 'gt':
        conditionResult = fieldValue > condition.value;
        break;
      case 'gte':
        conditionResult = fieldValue >= condition.value;
        break;
      case 'lt':
        conditionResult = fieldValue < condition.value;
        break;
      case 'lte':
        conditionResult = fieldValue <= condition.value;
        break;
      case 'contains':
        conditionResult = fieldValue && fieldValue.includes(condition.value);
        break;
      case 'in':
        conditionResult = Array.isArray(condition.value) && condition.value.includes(fieldValue);
        break;
      case 'not-in':
        conditionResult = Array.isArray(condition.value) && !condition.value.includes(fieldValue);
        break;
      default:
        conditionResult = true;
    }

    if (logicalOperator === 'AND') {
      result = result && conditionResult;
    } else {
      result = result || conditionResult;
    }

    logicalOperator = condition.logicalOperator;
  }

  return result;
};

// Static method to find applicable workflow for a requisition
approvalWorkflowSchema.statics.findApplicableWorkflow = async function(requisition, companyId) {
  const workflows = await this.find({
    company: companyId,
    isActive: true,
    isDraft: false,
    $or: [
      { applyToAll: true },
      { departments: requisition.department },
      { departmentCodes: requisition.departmentCode },
      { categories: requisition.category }
    ]
  }).sort({ priority: 1, createdAt: -1 });

  // Find first workflow that applies
  for (const workflow of workflows) {
    if (workflow.appliesToRequisition(requisition)) {
      return workflow;
    }
  }

  return null;
};

// Indexes for performance
approvalWorkflowSchema.index({ company: 1, isActive: 1, isDraft: 1 });
approvalWorkflowSchema.index({ company: 1, code: 1 }, { unique: true });
approvalWorkflowSchema.index({ company: 1, departments: 1 });
approvalWorkflowSchema.index({ company: 1, categories: 1 });
approvalWorkflowSchema.index({ company: 1, priority: 1 });
approvalWorkflowSchema.index({ 'statistics.lastUsed': -1 });

const ApprovalWorkflow = mongoose.model('ApprovalWorkflow', approvalWorkflowSchema);

export default ApprovalWorkflow;