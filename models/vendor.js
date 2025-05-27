const mongoose = require("mongoose");

const VendorSchema = new mongoose.Schema({
    // Basic Information
    name: { type: String, required: true },
    email: { type: String, required: false, unique: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    categories: [{ type: String }], // E.g., ["Electronics", "Office Supplies"]
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, default: 0 }, // Average rating from RFQs
    
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
    
    // Contact Information
    authorizedContact: {
        name: { type: String, default: "Brian Mtonga" },
        phone: { type: String, default: "+265 993773578" },
        email: { type: String, default: "brianmtonga592@gmail.com" }
    },
    
    // Terms and Conditions
    termsAccepted: { type: Boolean, required: true, default: false },
    termsAcceptedDate: { type: Date }
    
}, { timestamps: true });

// Additional indexes for faster queries (email, taxpayerIdentificationNumber, registrationNumber already have unique indexes)
VendorSchema.index({ registrationStatus: 1 });
VendorSchema.index({ submissionDate: -1 });
VendorSchema.index({ businessCategory: 1 });

// Virtual for full business name
VendorSchema.virtual('fullBusinessName').get(function() {
    return this.businessName || this.name;
});

// Method to check if vendor is approved
VendorSchema.methods.isApproved = function() {
    return this.registrationStatus === 'approved';
};

// Method to approve vendor
VendorSchema.methods.approve = function(reviewerId) {
    this.registrationStatus = 'approved';
    this.approvalDate = new Date();
    this.reviewedBy = reviewerId;
    return this.save();
};

// Method to reject vendor
VendorSchema.methods.reject = function(reason, reviewerId) {
    this.registrationStatus = 'rejected';
    this.rejectionReason = reason;
    this.reviewedBy = reviewerId;
    return this.save();
};

module.exports = mongoose.model("Vendor", VendorSchema);