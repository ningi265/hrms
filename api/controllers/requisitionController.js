const Requisition = require("../../models/requisition");
const {sendNotifications} = require("../services/notificationService");



// Submit a new requisition (Employee)
exports.createRequisition = async (req, res) => {
    // Check for user ID in the correct property
    if (!req.user?._id) {
        return res.status(401).json({ message: "Authentication required" });
    }
    
    console.log('Received data:', req.body);
    console.log('User from JWT:', req.user);
    
    try {
        const { 
            itemName,
            quantity,
            budgetCode,
            urgency,
            preferredSupplier,
            reason,
            category,
            estimatedCost,
            deliveryDate,
            department,
            environmentalImpact
        } = req.body;

        // Validation
        if (!itemName) {
            return res.status(400).json({ message: "Item name is required" });
        }
        if (!budgetCode) {
            return res.status(400).json({ message: "Budget code is required" });
        }
        if (!reason) {
            return res.status(400).json({ message: "Business justification is required" });
        }
        if (!department) {
            return res.status(400).json({ message: "Department is required" });
        }

        // Convert string numbers to actual numbers
        const numericQuantity = parseInt(quantity) || 1;
        
        // Handle estimated cost
        let numericEstimatedCost = 0;
        if (estimatedCost) {
            numericEstimatedCost = parseFloat(estimatedCost.toString().replace(/[^0-9.]/g, ''));
        }
        
        if (numericEstimatedCost <= 0) {
            return res.status(400).json({ message: "Estimated cost must be greater than 0" });
        }

        console.log('Creating requisition with user ID:', req.user._id);

        const newRequisition = await Requisition.create({
            employee: req.user._id, // Use _id instead of id
            itemName,
            quantity: numericQuantity,
            budgetCode,
            urgency: urgency || 'medium',
            preferredSupplier: preferredSupplier || 'No preference',
            reason,
            category,
            estimatedCost: numericEstimatedCost,
            deliveryDate: deliveryDate || null,
            department,
            environmentalImpact: environmentalImpact || 'No specific requirements',
            status: "pending"
        });

        console.log('Created requisition:', newRequisition);

        res.status(201).json({ 
            message: "Requisition submitted successfully", 
            requisition: newRequisition 
        });

    } catch (err) {
        console.error('Error creating requisition:', err);
        res.status(500).json({ 
            message: "Server error", 
            error: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
};
// Get all requisitions (For Procurement Officers & Admins)
exports.getAllRequisitions = async (req, res) => {
    try {
        const requisitions = await Requisition.find().populate("employee", "firstName lastName email");
        res.json(requisitions);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

//pending
exports.getAllPendingRequisitions = async (req, res) => {
    try {
        const requisitions = await Requisition.find({status:"pending"}).populate("employee", "firstName lastName email");
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
exports.getAllPendingRequisitions = async (req, res) => {
    try {
        const requisitions = await Requisition.find({status:"pending"}).populate("employee", "firstName lastName email");
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
        const requisitions = await Requisition.find({ status: "pending" })
            .populate("employee", "name email");

        const stats = {
            counts: {
                total,
                pending,
                approved,
                rejected
            },
            pendingRequisitions: requisitions // Include the full requisitions data
        };

        res.json(stats); // Send a single response with all data
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


exports.travelRequisition = async (req, res) => {
    try {
        console.log(req.body);
        const { destination, purpose, departureDate, returnDate, meansOfTransport } = req.body;

        const newRequisition = await Requisition.create({
            employee: req.user.id, // User from JWT
            destination,
            purpose,
            departureDate,
            returnDate,
            meansOfTransport,
        });

        res.status(201).json({ message: "Travel requisition submitted successfully", requisition: newRequisition });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
