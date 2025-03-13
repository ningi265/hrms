const express = require("express");
const Notification = require("../models/notification");
const { protect } = require("../api/middleware/authMiddleware");

const router = express.Router();

// Get all notifications for the logged-in user
router.get("/", protect(), async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Mark a notification as read
router.put("/:id/read", protect(), async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (!notification) return res.status(404).json({ message: "Notification not found" });

        notification.read = true;
        await notification.save();

        res.json({ message: "Notification marked as read", notification });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
