const mongoose = require("mongoose");

const RFQSchema = new mongoose.Schema({
    procurementOfficer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    vendors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Vendor" }], // Vendors invited to bid
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true },
    status: { type: String, enum: ["open", "closed"], default: "open" },
    quotes: [{
        vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
        price: { type: Number, required: true },
        deliveryTime: { type: String },
        notes: { type: String }
    }],
    selectedVendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" }
}, { timestamps: true });

module.exports = mongoose.model("RFQ", RFQSchema);
