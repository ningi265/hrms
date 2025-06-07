const mongoose = require("mongoose");

const PurchaseOrderSchema = new mongoose.Schema({
    rfq: { type: mongoose.Schema.Types.ObjectId, ref: "RFQ", required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    procurementOfficer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [{
        itemName: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }
    }],
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected", "fulfilled"], default: "pending" },
    deliveryStatus: { type: String, enum: ["pending", "shipped", "delivered", "confirmed"], default: "pending" }, // New field
    approver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    vendorConfirmation: {
        confirmed: { type: Boolean, default: false }, // Vendor confirmation status
        confirmedAt: { type: Date }, // Timestamp of confirmation
      },
      createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model("PurchaseOrder", PurchaseOrderSchema);
