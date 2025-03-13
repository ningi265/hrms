const mongoose = require("mongoose");

const InvoiceSchema = new mongoose.Schema({
    po: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
    amountDue: { type: Number, required: true },
    invoiceNumber: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "approved", "rejected", "paid"], default: "pending" },
    approver: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Who approved/rejected
    paymentDate: { type: Date }, // When payment was processed
}, { timestamps: true });

module.exports = mongoose.model("Invoice", InvoiceSchema);
