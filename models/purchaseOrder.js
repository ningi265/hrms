const mongoose = require("mongoose");

const PurchaseOrderSchema = new mongoose.Schema({
  rfq: { type: mongoose.Schema.Types.ObjectId, ref: "RFQ", required: true },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  procurementOfficer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true }, // ✅ Needed for getAllPOs
  items: [
    {
      itemName: { type: String, required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
    },
  ],
  totalAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "fulfilled"],
    default: "pending",
  },
  deliveryStatus: {
    type: String,
    enum: ["pending", "shipped", "delivered", "confirmed"],
    default: "pending",
  },
  trackingNumber: { type: String },
  carrier: { type: String },
  receivedByCustomer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  vendorConfirmation: {
    confirmed: { type: Boolean, default: false },
    confirmedAt: { type: Date },
  },
}, { timestamps: true }); // ✅ no need for explicit createdAt, timestamps handles it

module.exports = mongoose.model("PurchaseOrder", PurchaseOrderSchema);
