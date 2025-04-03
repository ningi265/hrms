const RFQ = require("../../models/RFQ");
const Vendor = require("../../models/vendor");
const { notifyVendorsAboutRFQ, notifySelectedVendor } = require("../services/notificationService");

// Create RFQ (Only Procurement Officers)
exports.createRFQ = async (req, res) => {
    try {
        const { vendors, itemName, quantity } = req.body;

        // Ensure vendors is an array of valid vendor IDs
        const validVendors = await Vendor.find({ _id: { $in: vendors } });
        if (validVendors.length !== vendors.length) {
            return res.status(400).json({ message: "Invalid vendor IDs provided" });
        }

        const rfq = await RFQ.create({
            procurementOfficer: req.user.id,
            vendors,
            itemName,
            quantity
        });

        // Notify vendors about the RFQ
        await notifyVendorsAboutRFQ(vendors, rfq);

        res.status(201).json({ message: "RFQ created successfully and vendors notified", rfq });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
// Get all RFQs (Procurement Officers & Admins)
exports.getAllRFQs = async (req, res) => {
    try {
        const rfqs = await RFQ.find().populate("vendors procurementOfficer", "name email");
        res.json(rfqs);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.submitQuote = async (req, res) => {
    try {
        const { price, deliveryTime, notes } = req.body;

        // Find the RFQ by ID and populate vendors for validation
        const rfq = await RFQ.findById(req.params.id).populate("vendors");
        console.log("RFQ Found:", rfq);

        if (!rfq || rfq.status === "closed") {
            return res.status(400).json({ message: "RFQ not found or closed" });
        }

        // Find the vendor based on `req.user.id`
        const vendorEntry = rfq.vendors.find(vendor => vendor.user.toString() === req.user.id);
        if (!vendorEntry) {
            console.log("Vendor ID mismatch:", req.user.id, "not in", rfq.vendors.map(v => v.user.toString()));
            return res.status(403).json({ message: "You are not invited to submit a quote for this RFQ." });
        }

        console.log("Vendor Found:", vendorEntry);

        // Ensure the correct vendor ID is assigned
        const newQuote = { vendor: vendorEntry._id, price, deliveryTime, notes };
        rfq.quotes.push(newQuote);
        await rfq.save();

        res.json({ message: "Quote submitted successfully", newQuote });
    } catch (err) {
        console.error("Error submitting quote:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};



exports.selectVendor = async (req, res) => {
    try {
        const { vendorId } = req.body; // Selected vendor's ID from the frontend
        console.log("Selected Vendor ID:", vendorId);

        const rfq = await RFQ.findById(req.params.id)
            .populate("quotes.vendor") // Ensure vendors are properly linked
            .populate("vendors"); // Fetch vendors list for debugging

        if (!rfq) return res.status(404).json({ message: "RFQ not found" });
        if (rfq.status === "closed") return res.status(400).json({ message: "RFQ is already closed" });
        if (rfq.quotes.length === 0) return res.status(400).json({ message: "No quotes available" });

        console.log("RFQ Vendors:", rfq.vendors);
        console.log("RFQ Quotes:", rfq.quotes);

        // Find the selected quote
        const selectedQuote = rfq.quotes.find((quote) => {
            if (!quote.vendor) {
                console.error("Quote has no vendor:", quote._id);
                return false;
            }
            return quote.vendor._id.toString() === vendorId;
        });

        if (!selectedQuote) {
            return res.status(400).json({ message: "Invalid vendor selected" });
        }

        // Update RFQ status and selected vendor
        rfq.status = "closed";
        rfq.selectedVendor = selectedQuote.vendor;
        await rfq.save();

        // Notify the selected vendor
        await notifySelectedVendor(selectedQuote.vendor._id, rfq);

        res.json({ message: `Vendor ${selectedQuote.vendor.name} selected and notified`, bestQuote: selectedQuote });
    } catch (err) {
        console.error("Error selecting vendor:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get RFQ stats (total, open, closed)
exports.getRFQStats = async (req, res) => {
    try {
        const total = await RFQ.countDocuments();
        const open = await RFQ.countDocuments({ status: "open" });
        const closed = await RFQ.countDocuments({ status: "closed" });
        const openRFQs = await RFQ.find({ status: "open" })
        .populate("procurementOfficer", "name email")
        .sort({ deadline: 1 }); // Sort by deadline ascending

        const stats = {
            counts: {
                total,
                open,
                closed
            },
            openRFQs: openRFQs // Include the full open RFQs data
        };

        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
// Get a single RFQ by ID
exports.getRFQById = async (req, res) => {
    try {
        const rfq = await RFQ.findById(req.params.id)
            .populate("vendor", "name email")
            .populate("requisition", "itemName quantity budgetCode urgency reason");
        if (!rfq) return res.status(404).json({ message: "RFQ not found" });
        res.json(rfq);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

