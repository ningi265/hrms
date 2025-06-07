const mongoose = require("mongoose");

const RegistrationSchema = new mongoose.Schema({
   
    
    // Registration Information
    countryOfRegistration: { type: String, required: true, default: "Malawi" },
    businessName: { type: String, required: true },
    taxpayerIdentificationNumber: { type: String, required: true, unique: true },
    tinIssuedDate: { type: Date, required: true },
    companyType: { 
        type: String, 
        required: true,
        enum: [
            "Private Limited Company",
            "Public Limited Company", 
            "Partnership",
            "Sole Proprietorship",
            "Trust",
            "NGO/Non-Profit",
            "Government Entity"
        ]
    },
    formOfBusiness: { 
        type: String, 
        required: true,
        enum: [
            "Limited Liability Company",
            "Partnership",
            "Sole Trader",
            "Trust",
            "Association",
            "Cooperative"
        ]
    },
    ownershipType: { 
        type: String, 
        required: true,
        enum: [
            "Private Ownership",
            "Public Ownership",
            "Foreign Ownership",
            "Joint Venture",
            "Government Owned"
        ]
    },

     vendor: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
      },
    businessCategory: { 
        type: String, 
        required: true,
        enum: [
            "Manufacturing",
            "Trading/Retail",
            "Services",
            "Construction",
            "Agriculture",
            "Technology",
            "Healthcare",
            "Education",
            "Transport",
            "Other"
        ]
    },
    registrationNumber: { type: String, required: true, unique: true },
    registrationIssuedDate: { type: Date, required: true },
    
    // Document Information
    powerOfAttorney: {
        fileName: { type: String },
        filePath: { type: String },
        fileSize: { type: Number },
        uploadDate: { type: Date, default: Date.now }
    },
    
    // Registration Status
    registrationStatus: {
        type: String,
        enum: ["pending", "approved", "rejected", "under_review"],
        default: "pending"
    },
    submissionDate: { type: Date, default: Date.now },
    approvalDate: { type: Date },
    rejectionReason: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // Terms and Conditions
    termsAccepted: { type: Boolean, required: true, default: false },
    termsAcceptedDate: { type: Date }
    
}, { timestamps: true });

// Additional indexes for faster queries (email, taxpayerIdentificationNumber, registrationNumber already have unique indexes)
RegistrationSchema.index({ registrationStatus: 1 });
RegistrationSchema.index({ submissionDate: -1 });
RegistrationSchema.index({ businessCategory: 1 });

// Virtual for full business name
RegistrationSchema.virtual('fullBusinessName').get(function() {
    return this.businessName || this.name;
});

// Method to check if vendor is approved
RegistrationSchema.methods.isApproved = function() {
    return this.registrationStatus === 'approved';
};

// Method to approve vendor
RegistrationSchema.methods.approve = function(reviewerId) {
    this.registrationStatus = 'approved';
    this.approvalDate = new Date();
    this.reviewedBy = reviewerId;
    return this.save();
};

// Method to reject vendor
RegistrationSchema.methods.reject = function(reason, reviewerId) {
    this.registrationStatus = 'rejected';
    this.rejectionReason = reason;
    this.reviewedBy = reviewerId;
    return this.save();
};

module.exports = mongoose.model("Registration", RegistrationSchema);