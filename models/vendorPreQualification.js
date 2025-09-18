const mongoose = require("mongoose");

const VendorPreQualificationSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    companyInfo: {
      registrationCertificate: { type: String },
      businessLicense: { type: String },
      address: { type: String, required: true },
      contactEmail: { type: String, required: true },
      yearsInOperation: { type: Number, required: true },
    },

    legalCompliance: {
      taxClearance: { type: String },
      vatRegistration: { type: String },
      industryLicenses: [{ type: String }],
      laborLawCompliance: { type: Boolean, default: false },
      litigationHistory: { type: Boolean, default: false },
    },

    financialCapability: {
      auditedStatements: [{ type: String }],
      bankReference: { type: String },
      insuranceCoverage: { type: String },
      annualTurnover: { type: Number },
    },

    technicalCapacity: {
      relevantExperience: [{ type: String }],
      keyPersonnel: [{ type: String }],
      equipmentFacilities: [{ type: String }],
      qualityCertifications: [{ type: String }],
      deliveryCapacity: { type: String },
    },

    pastPerformance: {
      clientReferences: [{ type: String }],
      timelyDeliveryRecord: { type: Boolean, default: false },
      completedProjects: [{ type: String }],
      performanceRatings: { type: Number, min: 0, max: 100 },
    },

    hse: {
      safetyPolicy: { type: Boolean, default: false },
      environmentCertificate: { type: String },
      safetyRecords: [{ type: String }],
      sustainabilityPractices: [{ type: String }],
    },

    ethicsGovernance: {
      antiCorruptionPolicy: { type: Boolean, default: false },
      conflictOfInterest: { type: Boolean, default: false },
      codeOfConductSigned: { type: Boolean, default: false },
      csrInitiatives: [{ type: String }],
    },

    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "VendorPreQualification",
  VendorPreQualificationSchema
);
