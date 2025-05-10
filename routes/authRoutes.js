const express = require("express");
const { register, login, getDrivers, verifyPhone, resendVerification, sendVerification, sendVerificationTest } = require("../api/controllers/authController");
const { protect } = require("../api/middleware/authMiddleware");

const router = express.Router();
router.post("/login", login);
router.post("/register", register);
router.post("/verify",verifyPhone );
router.post("/resend",resendVerification);
router.post("/send",sendVerificationTest );
router.get("/drivers",protect(["procurement_officer", "admin", "IT/Technical",
    "Executive (CEO, CFO, etc.)",
    "Management",
    "Sales/Marketing",
    "Operations",
    "Human Resources",
    "Accounting/Finance",
    "Other",
    "vendor"]),getDrivers);

module.exports = router;
