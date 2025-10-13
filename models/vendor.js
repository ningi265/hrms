const mongoose = require("mongoose");

const VendorSchema = new mongoose.Schema({
    // Basic Information
    name: {
        type: String,
        required: [true, "Vendor name is required"],
        trim: true,
        maxlength: [100, "Vendor name cannot exceed 100 characters"]
    },
    email: {
        type: String,
        required: [false, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function(v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: props => `${props.value} is not a valid email address!`
        }
    },
    phoneNumber: {
        type: String,
        required: [true, "Phone number is required"],
        validate: {
            validator: function(v) {
                return /^\+?[\d\s-]{10,15}$/.test(v);
            },
            message: props => `${props.value} is not a valid phone number!`
        }
    },
    address: {
        type: String,
        required: [true, "Address is required"],
        trim: true
    },

    // Business Details
    categories: [{
        type: String,
        required: [true, "At least one category is required"],
        trim: true,
        lowercase: true
    }],
    

    businessName: {
        type: String,
        required: [true, "Business name is required"],
        trim: true,
        maxlength: [200, "Business name cannot exceed 200 characters"]
    },
    businessDescription: {
        type: String,
        trim: false,
        maxlength: [500, "Description cannot exceed 500 characters"]
    },
    
    // Legal Information
    taxpayerIdentificationNumber: {
        type: String,
      
        unique: true,
        trim: true
    },
    registrationNumber: {
        type: String,
       
        unique: true,
        trim: true
    },
    companyType: {
        type: String,
        trim: true
    },
    countryOfRegistration: {
        type: String,
        default: "Malawi",
        trim: true
    },

    // Registration timeline fields
    tinIssuedDate: {
        type: Date,
        default: Date.now
    },
    registrationIssuedDate: {
        type: Date,
        default: Date.now
    },
    // ADDED: Registration submission and approval dates
    submissionDate: {
        type: Date,
        default: Date.now
    },
    approvalDate: {
        type: Date
    },
    formOfBusiness: {
        type: String,
        trim: true
    },
    ownershipType: {
        type: String,
        trim: true
    },
    termsAccepted: {
        type: Boolean,
        default: false
    },
    termsAcceptedDate: {
        type: Date
    },

    // Relationships
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "User reference is required"]
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: [false, "Company reference is required"]
    },
    // Vendor reference (references the User with role "Vendor")
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    // Status and Metadata
    registrationStatus: {
        type: String,
        enum: ["pending", "approved", "rejected", "suspended"],
        default: "pending" // Changed from "approved" to "pending" to align with registration workflow
    },
    rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    ratingCount: {
        type: Number,
        default: 0
    },

    // Documents and Files
   documents: {
  type: Object,
  default: {
    registrationCertificate: null,
    businessLicense: null,
    taxClearance: null,
    vatRegistration: null,
    environmentCertificate: null,
    industryLicenses: [],
    auditedStatements: [],
    relevantExperience: [],
    keyPersonnel: [],
    equipmentFacilities: [],
    qualityCertifications: [],
    clientReferences: [],
    completedProjects: [],
    safetyRecords: [],
    sustainabilityPractices: [],
    csrInitiatives: []
  }
},


    // Financial Information
    paymentTerms: {
        type: String,
        trim: true
    },
    preferredPaymentMethod: {
        type: String,
        trim: true
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
     reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // or whatever model represents the reviewer
    required: false
  },
  reviewedAt: {
    type: Date,
    required: false
  }

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for optimized queries
VendorSchema.index({ email: 1 }); // For fast email lookups
VendorSchema.index({ categories: 1 }); // For category-based searches
VendorSchema.index({ registrationStatus: 1 }); // For status-based queries
VendorSchema.index({ rating: -1 }); // For sorting by rating
VendorSchema.index({ submissionDate: -1 }); // For sorting by submission date
VendorSchema.index({ approvalDate: -1 }); // For sorting by approval date

// Middleware to update timestamps
VendorSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    
    // Set approvalDate when status changes to 'approved'
    if (this.isModified('registrationStatus') && this.registrationStatus === 'approved' && !this.approvalDate) {
        this.approvalDate = Date.now();
    }
    
    next();
});

module.exports = mongoose.model("Vendor", VendorSchema);