const Requisition = require("../../models/requisition");
const {sendNotifications} = require("../services/notificationService");

// Submit a new requisition (Employee)
exports.createRequisition = async (req, res) => {
    try {
        const { itemName, quantity, budgetCode, urgency, preferredSupplier, reason } = req.body;

        const newRequisition = await Requisition.create({
            employee: req.user.id, // User from JWT
            itemName,
            quantity,
            budgetCode,
            urgency,
            preferredSupplier,
            reason,
        });

        res.status(201).json({ message: "Requisition submitted successfully", requisition: newRequisition });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get all requisitions (For Procurement Officers & Admins)
exports.getAllRequisitions = async (req, res) => {
    try {
        const requisitions = await Requisition.find().populate("employee", "name email");
        res.json(requisitions);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};


// Approve a requisition
exports.approveRequisition = async (req, res) => {
    try {
        const requisition = await Requisition.findById(req.params.id);
        if (!requisition) return res.status(404).json({ message: "Requisition not found" });

        requisition.status = "approved";
        requisition.approver = req.user.id;
        await requisition.save();

        // Notify the employee
        const message = `Your requisition for ${requisition.itemName} has been approved.`;
        await sendNotifications(requisition.employee, "Requisition Approved", message);

        res.json({ message: "Requisition approved and notification sent", requisition });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Reject a requisition
exports.rejectRequisition = async (req, res) => {
    try {
        const requisition = await Requisition.findById(req.params.id);
        if (!requisition) return res.status(404).json({ message: "Requisition not found" });

        requisition.status = "rejected";
        requisition.approver = req.user.id;
        await requisition.save();

        // Notify the employee
        const message = `Your requisition for ${requisition.itemName} has been rejected.`;
        await sendNotifications(requisition.employee, "Requisition Rejected", message);

        res.json({ message: "Requisition rejected and notification sent", requisition });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get user-specific requisitions (For Employees)
exports.getMyRequisitions = async (req, res) => {
    try {
        const requisitions = await Requisition.find({ employee: req.user.id });
        res.json(requisitions);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
// Get all approved requisitions
exports.getApprovedRequisitions = async (req, res) => {
    try {
        const requisitions = await Requisition.find({ status: "approved" }).populate("employee", "name email");
        res.json(requisitions);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get all rejected requisitions
exports.getRejectedRequisitions = async (req, res) => {
    try {
        const requisitions = await Requisition.find({ status: "rejected" }).populate("employee", "name email");
        res.json(requisitions);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get all pending requisitions
exports.getPendingRequisitions = async (req, res) => {
    try {
        const requisitions = await Requisition.find({ status: "pending" }).populate("employee", "name email");
        res.json(requisitions);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get requisition stats (total, pending, approved, rejected)
exports.getRequisitionStats = async (req, res) => {
    try {
        const total = await Requisition.countDocuments();
        const pending = await Requisition.countDocuments({ status: "pending" });
        const approved = await Requisition.countDocuments({ status: "approved" });
        const rejected = await Requisition.countDocuments({ status: "rejected" });

        const stats = {
            total,
            pending,
            approved,
            rejected,
        };

        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get all pending requisitions (For Procurement Officers & Admins)
exports.getPendingRequisitions = async (req, res) => {
    try {
        const requisitions = await Requisition.find({ status: "pending" }).populate("employee", "name email");
        res.json(requisitions);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
