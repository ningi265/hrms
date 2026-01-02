const mongoose = require("mongoose");

const TendersSchema = new mongoose.Schema({
    // Basic Information
    title: { type: String, required: true },
    procurementOfficer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    department: { type: String }, // Added from frontend
    
    // Category
    category: { 
        type: String, 
        required: true,
        enum: ['Construction', 'Medical Supplies', 'IT Services', 'Consultancy', 'Goods Supply', 'Works', 'Services', 'Other']
    },
    
    // Status
    status: { 
        type: String, 
        enum: ["open", "under_review", "closed", "awarded", "cancelled"], 
        default: "open" 
    },

    // Timeline
    deadline: { type: Date, required: true },
    deadlineTime: { type: String, default: "17:00" }, // Added from frontend
    urgency: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    projectStartDate: { type: Date }, // Added from frontend
    projectEndDate: { type: Date }, // Added from frontend

    // Tender Details
    description: { type: String, required: true },
    scopeOfWork: { type: String, required: true }, // Added from frontend
    technicalSpecs: { type: String }, // Added from frontend
    requirements: { type: [String], default: [] },

    // Financial Information
    budget: { type: Number, required: true },
    paymentTerms: { 
        type: String, 
        default: "30 days after invoice" 
    }, // Added from frontend
    customPaymentTerms: { type: String }, // Added from frontend
    
    // Bid Security - Added from frontend
    bidSecurity: {
        required: { type: Boolean, default: false },
        amount: { type: Number, default: 0 },
        currency: { type: String, default: "MWK" }
    },

    // Location & Contact
    location: { type: String, required: true },
    contactEmail: { type: String, required: true }, // Added from frontend
    contactPhone: { type: String }, // Added from frontend

    // Requisition Link
    requisitionId: { type: mongoose.Schema.Types.ObjectId, ref: "Requisition", required: true },

    // Submission & Evaluation - Added from frontend
    evaluationCriteria: {
        techScoreWeight: { type: Number, default: 70, min: 0, max: 100 },
        financialScoreWeight: { type: Number, default: 30, min: 0, max: 100 },
        evaluationDetails: { type: String },
        criteria: { type: String } // Keeping original field
    },
    
    submissionRequirements: {
        requireTechnicalProposal: { type: Boolean, default: true },
        requireFinancialProposal: { type: Boolean, default: true },
        requireCompanyProfile: { type: Boolean, default: true },
        requireCertificates: { type: Boolean, default: true },
        instructions: { type: String },
        documents: [{
            name: String,
            url: String,
            type: String
        }]
    },

    // Contract Terms - Added from frontend
    contractTerms: {
        duration: { type: Number }, // in months
        warrantyPeriod: { type: Number }, // in months
        additionalTerms: { type: String },
        paymentTerms: { type: String }
    },

    // Pre-bid Meeting - Added from frontend
    preBidMeeting: {
        date: { type: Date },
        time: { type: String },
        venue: { type: String }
    },

    // Bids - Enhanced
    bids: [
        {
            vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
            bidAmount: { type: Number }, // Renamed from 'amount' for clarity
            proposal: { type: String }, // Added detailed proposal field
            proposalDocument: { type: String }, // URL or path to the document
            documents: [{
                name: String,
                url: String,
                type: String,
                uploadedAt: { type: Date, default: Date.now }
            }],
            technicalScore: { type: Number, min: 0, max: 100 },
            financialScore: { type: Number, min: 0, max: 100 },
            status: { 
                type: String, 
                enum: ["submitted", "under_review", "shortlisted", "awarded", "rejected"],
                default: "submitted"
            },
            submittedAt: { type: Date, default: Date.now },
            evaluatedAt: { type: Date },
            comments: { type: String }
        }
    ],

    // Award Information
    awardedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
    awardedAmount: { type: Number, default: 0 },
    awardedDocument: { type: String, default: "" },
    
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
    awardedAt: { type: Date, default: null },
    updatedAt: { type: Date, default: Date.now }
    
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual fields for better UI display
TendersSchema.virtual('bidCount').get(function() {
    return this.bids ? this.bids.length : 0;
});

TendersSchema.virtual('daysUntilDeadline').get(function() {
    if (!this.deadline) return null;
    const now = new Date();
    const deadline = new Date(this.deadline);
    if (this.deadlineTime) {
        const [hours, minutes] = this.deadlineTime.split(":");
        deadline.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }
    const diffTime = deadline - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

TendersSchema.virtual('statusColor').get(function() {
    switch(this.status) {
        case 'open': return 'green';
        case 'under_review': return 'yellow';
        case 'closed': return 'red';
        case 'awarded': return 'blue';
        case 'cancelled': return 'gray';
        default: return 'gray';
    }
});

TendersSchema.virtual('urgencyColor').get(function() {
    switch(this.urgency) {
        case 'high': return 'red';
        case 'medium': return 'yellow';
        case 'low': return 'green';
        default: return 'gray';
    }
});

// Pre-save middleware to update updatedAt
TendersSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Indexes for better query performance
TendersSchema.index({ company: 1, status: 1 });
TendersSchema.index({ deadline: 1 });
TendersSchema.index({ category: 1 });
TendersSchema.index({ urgency: 1 });
TendersSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Tenders", TendersSchema);