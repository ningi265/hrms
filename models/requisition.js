const mongoose = require("mongoose");

const RequisitionSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    budgetCode: { type: String, required: true },
    urgency: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    preferredSupplier: { type: String }, 
    reason: { type: String },
    category: {type:String, required: false},
    estimatedCost: {type:Number, required: false},
    deliveryDate: Date,
    department: String,
    environmentalImpact: String,
    approver: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, 
}, { timestamps: true });

module.exports = mongoose.model("Requisition", RequisitionSchema);
