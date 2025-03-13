const Vendor = require("../../models/vendor");
const User = require("../../models/user");


// Add a new vendor
exports.addVendor = async (req, res) => {
    try {
        const { name, email, phone, address, categories, password } = req.body;
        console.log("req body", req.body);

        // Check if the vendor already exists
        const existingVendor = await Vendor.findOne({ email });
        if (existingVendor) {
            return res.status(400).json({ message: "Vendor with this email already exists" });
        }

        // Create a user account for the vendor
        const user = await User.create({
            name,
            email,
            password, // Ensure the password is hashed (use bcrypt or similar)
            role: "vendor", // Set the role to "vendor"
        });

        // Create the vendor object and link it to the user account
        const vendor = await Vendor.create({
            name,
            email,
            phone,
            address,
            categories,
            user: user._id, // Link the vendor to the user account
        });

        res.status(201).json({ message: "Vendor added successfully", vendor });
    } catch (err) {
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
        await Vendor.findByIdAndDelete(req.params.id);
        res.json({ message: "Vendor deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
