const mongoose = require("mongoose");

const RequisitionSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true }, // Added company reference
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true }, // Changed to ObjectId reference
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    budgetCode: { type: String, required: true },
    urgency: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    preferredSupplier: { type: String }, 
    reason: { type: String },
    category: { type: String, required: false },
    estimatedCost: { type: Number, required: false },
    deliveryDate: Date,
    environmentalImpact: String,
    approver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    projectCode: { type: String }, // Added projectCode
    costCenter: { type: String }, // Added costCenter
    approvalWorkflow: [{ // Added approvalWorkflow array
        type: mongoose.Schema.Types.ObjectId,
        ref: "ApprovalStep"
    }],
    history: [{ // Added history array
        action: String,
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        date: { type: Date, default: Date.now },
        notes: String
    }]
}, { timestamps: true });

module.exports = mongoose.model("Requisition", RequisitionSchema);