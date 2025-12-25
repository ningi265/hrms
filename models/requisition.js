const mongoose = require("mongoose");

const RequisitionSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true },
    status: { 
        type: String, 
        enum: ["pending", "in-review", "approved", "rejected", "cancelled", "escalated", "auto-approved"], 
        default: "pending" 
    },
    budgetCode: { type: String, required: true },
    urgency: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    preferredSupplier: { type: String },
    reason: { type: String, required: true },
    category: { type: String, required: false },
    estimatedCost: { type: Number, required: false },
    deliveryDate: Date,
    environmentalImpact: String,
    
    // Workflow Integration
    workflow: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "ApprovalWorkflow" 
    },
    workflowInstanceId: { type: String },
    currentApprovalStep: { 
        nodeId: String,
        nodeName: String,
        nodeType: String,
        status: { 
            type: String, 
            enum: ["pending", "in-progress", "completed", "escalated", "timed-out"] 
        },
        startedAt: Date,
        completedAt: Date,
        approvers: [{
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            name: String,
            email: String,
            status: { type: String, enum: ["pending", "approved", "rejected", "delegated"] },
            approvedAt: Date,
            comments: String,
            delegatedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
        }],
        minApprovalsRequired: Number,
        approvalsReceived: { type: Number, default: 0 },
        rejectionsReceived: { type: Number, default: 0 }
    },
    
    // Approval tracking
    approver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    rejectedAt: Date,
    rejectionReason: String,
    
    // Additional fields
    projectCode: { type: String },
    costCenter: { type: String },
    departmentCode: { type: String }, // Added for workflow matching
    
    // Approval workflow steps
    approvalSteps: [{ 
        stepNumber: Number,
        nodeId: String,
        nodeName: String,
        nodeType: String,
        approvers: [{
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            name: String,
            email: String,
            status: String,
            action: String,
            actedAt: Date,
            comments: String
        }],
        status: String,
        startedAt: Date,
        completedAt: Date,
        outcome: String,
        conditionMet: Boolean,
        timeoutAt: Date,
        escalatedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        escalationReason: String
    }],
    
    // Workflow timeline
    workflowTimeline: [{
        step: Number,
        action: String,
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        performedByName: String,
        nodeId: String,
        nodeName: String,
        details: mongoose.Schema.Types.Mixed,
        date: { type: Date, default: Date.now }
    }],
    
    // History
    history: [{
        action: String,
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        performedByName: String,
        date: { type: Date, default: Date.now },
        notes: String,
        details: mongoose.Schema.Types.Mixed
    }],
    
    // SLA tracking
    slaStartDate: Date,
    slaDueDate: Date,
    slaBreached: { type: Boolean, default: false },
    
    // Auto-approval
    autoApproved: { type: Boolean, default: false },
    autoApproveReason: String,
    
    // Audit fields
    submittedAt: { type: Date, default: Date.now },
    lastStatusUpdate: Date
    
}, { timestamps: true });

// Indexes for performance
RequisitionSchema.index({ company: 1, status: 1 });
RequisitionSchema.index({ employee: 1, status: 1 });
RequisitionSchema.index({ department: 1, status: 1 });
RequisitionSchema.index({ workflow: 1, status: 1 });
RequisitionSchema.index({ "currentApprovalStep.status": 1 });
RequisitionSchema.index({ slaDueDate: 1 });
RequisitionSchema.index({ createdAt: 1 });
RequisitionSchema.index({ estimatedCost: 1 });

// Virtual for formatted requisition number
RequisitionSchema.virtual('requisitionNumber').get(function() {
    return `REQ-${this._id.toString().slice(-8).toUpperCase()}`;
});

// Method to get current approvers
RequisitionSchema.methods.getCurrentApprovers = function() {
    if (!this.currentApprovalStep || !this.currentApprovalStep.approvers) {
        return [];
    }
    return this.currentApprovalStep.approvers
        .filter(approver => approver && approver.status === "pending" && approver.userId)
        .map(approver => approver.userId);
};

// Method to add history entry
RequisitionSchema.methods.addHistory = function(action, user, notes = "", details = {}) {
    this.history.push({
        action,
        performedBy: user._id,
        performedByName: `${user.firstName} ${user.lastName}`,
        notes,
        details
    });
    this.lastStatusUpdate = new Date();
};

// Method to update workflow timeline
RequisitionSchema.methods.addToTimeline = function(step, action, user, nodeId = null, nodeName = null, details = {}) {
    this.workflowTimeline.push({
        step,
        action,
        performedBy: user._id,
        performedByName: `${user.firstName} ${user.lastName}`,
        nodeId,
        nodeName,
        details
    });
};

// Method to check if user can approve
RequisitionSchema.methods.canUserApprove = function(userId) {
    try {
        console.log(`🔍 canUserApprove called for user: ${userId}, status: ${this.status}`);
        
        if (this.status !== "in-review") {
            console.log(`❌ Requisition not in review, status: ${this.status}`);
            return false;
        }
        
        if (!this.currentApprovalStep || !this.currentApprovalStep.approvers) {
            console.log(`❌ No current approval step or approvers`);
            return false;
        }

        const userIdStr = userId.toString();
        console.log(`Looking for user ID: ${userIdStr}`);
        
        // Debug: log all approvers
        console.log(`Approvers list:`, JSON.stringify(this.currentApprovalStep.approvers, null, 2));

        // Check if user is in approvers list
        const canApprove = this.currentApprovalStep.approvers.some(approver => {
            if (!approver || !approver.userId) {
                console.log(`Skipping approver - null or missing userId`);
                return false;
            }
            
            const approverId = approver.userId._id ? 
                approver.userId._id.toString() : 
                approver.userId.toString();
            
            console.log(`Checking approver: ${approverId} vs user: ${userIdStr}, status: ${approver.status}`);
            
            const isMatch = approverId === userIdStr && approver.status === "pending";
            if (isMatch) {
                console.log(`✅ Found matching approver!`);
            }
            return isMatch;
        });

        console.log(`User ${userIdStr} can approve: ${canApprove}`);
        return canApprove;
        
    } catch (error) {
        console.error('❌ Error in canUserApprove:', error);
        return false;
    }
};

// Static method to find requisitions awaiting user's approval
RequisitionSchema.statics.findPendingApproval = function(userId, companyId) {
    return this.find({
        company: companyId,
        status: "in-review",
        "currentApprovalStep.approvers": {
            $elemMatch: {
                userId: userId,
                status: "pending"
            }
        }
    });
};

module.exports = mongoose.model("Requisition", RequisitionSchema);