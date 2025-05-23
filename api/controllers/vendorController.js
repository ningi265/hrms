const Vendor = require("../../models/vendor");
const User = require("../../models/user");

// Add a new vendor
exports.addVendor = async (req, res) => {
    try {
        const { 
            firstName, 
            lastName, 
            email, 
            phoneNumber, 
            address, 
            categories, 
            password,
            companyName,
            industry,
            role = "employee" // Default to "employee" since "Vendor" is not in enum
        } = req.body;
        
        console.log("req body", req.body);

        // Check if the vendor already exists
        const existingVendor = await Vendor.findOne({ email });
        if (existingVendor) {
            return res.status(400).json({ message: "Vendor with this email already exists" });
        }

        // Create a user account for the vendor
        const user = await User.create({
            firstName,
            lastName,
            email,
            password,
            phoneNumber, // Fixed: use phoneNumber instead of phone
            companyName: companyName || `${firstName} ${lastName} Company`, // Provide default if not given
            industry: industry || "General", // Provide default if not given
            role: "employee", // Use valid enum value
        });

        // Create the vendor object and link it to the user account
        const vendor = await Vendor.create({
            name: `${firstName || ''} ${lastName || ''}`.trim() || 'Unnamed Vendor', // Safely combine names
            email,
            phone: phoneNumber, // Map phoneNumber to phone for vendor
            address: address || '',
            categories: Array.isArray(categories) ? categories : [],
            user: user._id, // Link the vendor to the user account
        });

        res.status(201).json({ message: "Vendor added successfully", vendor });
    } catch (err) {
        console.error("Error adding vendor:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.getVendorByUser = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({ user: req.user.id });
        if (!vendor) return res.status(404).json({ message: "Vendor not found" });

        res.json(vendor);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get all vendors
exports.getVendors = async (req, res) => {
    try {
        const vendors = await Vendor.find();
        res.json(vendors);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Update a vendor
exports.updateVendor = async (req, res) => {
    try {
        const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!vendor) return res.status(404).json({ message: "Vendor not found" });

        res.json({ message: "Vendor updated", vendor });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Delete a vendor
exports.deleteVendor = async (req, res) => {
    try {
        const vendorId = req.params.id;
        
        // Find the vendor first to get the associated user ID
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        // Delete the vendor
        await Vendor.findByIdAndDelete(vendorId);
        
        // Optionally delete the associated user account as well
        if (vendor.user) {
            await User.findByIdAndDelete(vendor.user);
        }

        res.json({ message: "Vendor deleted successfully" });
    } catch (err) {
        console.error("Error deleting vendor:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};