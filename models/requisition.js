const mongoose = require("mongoose");

const RequisitionSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Requester
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    budgetCode: { type: String, required: true },
    urgency: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    preferredSupplier: { type: String }, 
    reason: { type: String },
    approver: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Who approved/rejected
}, { timestamps: true });

module.exports = mongoose.model("Requisition", RequisitionSchema);
