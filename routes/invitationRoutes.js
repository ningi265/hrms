const express = require("express");
const router = express.Router();
const invitationController = require("../api/controllers/invitationController");
const { protect } = require("../api/middleware/authMiddleware");

// Create new beta invitation (public endpoint)
router.post("/", invitationController.createInvitation);

// Get all invitations (admin only)
router.get("/", protect(["admin"]), invitationController.getInvitations);

// Get invitation statistics (admin only)
router.get("/stats", protect(["admin"]), invitationController.getStatistics);

// Get single invitation (admin only)
router.get("/:id", protect(["admin"]), invitationController.getInvitationById);

// Update invitation (admin only)
router.put("/:id", protect(["admin"]), invitationController.updateInvitation);

// Approve invitation (admin only)
router.post("/:id/approve", protect(["admin"]), invitationController.approveInvitation);

// Reject invitation (admin only)
router.post("/:id/reject", protect(["admin"]), invitationController.rejectInvitation);

// Verify beta access token (public endpoint)
router.get("/verify/:token", invitationController.verifyBetaAccess);

// Bulk approve invitations (admin only)
router.post("/bulk-approve", protect(["admin"]), invitationController.bulkApprove);

// Cleanup expired access (admin only)
router.post("/cleanup", protect(["admin"]), invitationController.cleanupExpiredAccess);

module.exports = router;