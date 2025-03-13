const User = require("../../models/user");
const jwt = require("jsonwebtoken");

// Generate JWT
const generateToken = (user) => {
    return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// Register User
exports.register = async (req, res) => {
    try {
        console.log("Incoming Register Request:", req.body);

        const { name, email, password, role } = req.body;
        if (!name || !email || !password) {
            console.log("Missing required fields");
            return res.status(400).json({ message: "All fields are required" });
        }

        if (!["admin", "procurement_officer", "employee", "vendor"].includes(role)) {
            console.log("Invalid role provided:", role);
            return res.status(400).json({ message: "Invalid role" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log("User already exists:", email);
            return res.status(400).json({ message: "User already exists" });
        }

        console.log("Creating new user...");
        const newUser = await User.create({ name, email, password, role });
        console.log("New user created:", newUser);

        res.status(201).json({ token: generateToken(newUser), user: newUser });
    } catch (err) {
        console.error("Error during registration:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Login User
exports.login = async (req, res) => {
    try {
        console.log("Incoming Login Request:", req.body);

        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            console.log("User not found:", email);
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log("Password mismatch for user:", email);
            return res.status(401).json({ message: "Invalid credentials" });
        }

        console.log("User authenticated:", user);
        res.status(200).json({ token: generateToken(user), user });
    } catch (err) {
        console.error("Error during login:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
