const express = require("express");
const { register, login, getDrivers } = require("../api/controllers/authController");
const { protect } = require("../api/middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/drivers",protect(["procurement_officer", "admin"]),getDrivers);

module.exports = router;
