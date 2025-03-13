const jwt = require("jsonwebtoken");

exports.protect = (roles = []) => (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ message: "Unauthorized: No token provided" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;

        // Check if user has the required role
        if (roles.length && !roles.includes(req.user.role))
            return res.status(403).json({ message: "Forbidden: Access denied" });

        next();
    } catch (err) {
        res.status(401).json({ message: "Invalid or expired token" });
    }
};
