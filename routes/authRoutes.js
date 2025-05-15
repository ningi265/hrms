const express = require("express");
const { 
  register, 
  login, 
  getDrivers, 
  verifyPhone, 
  resendVerification,
  sendVerification, 
  sendVerificationTest,
  // New email verification endpoints
  sendEmailVerification,
  verifyEmail,
  resendEmailVerification,
  sendEmailVerificationTest,
  uploadLogo,
  uploadSignature,
} = require("../api/controllers/authController");
const { protect } = require("../api/middleware/authMiddleware");

const router = express.Router();

// Authentication routes
router.post("/login", login);
router.post("/register", register);

// Phone verification routes
router.post("/verify", verifyPhone);
router.post("/resend", resendVerification);
router.post("/send", sendVerificationTest);

// Email verification routes
router.post("/email/send", sendEmailVerification);
router.post("/email/verify", verifyEmail);
router.post("/email/resend", resendEmailVerification);
router.post("/email/send-test", sendEmailVerificationTest);



//Onboarding routes
router.put("/onboarding/logo", uploadLogo);
router.put("/onboarding/signature", uploadSignature);


// Protected routes
router.get("/drivers", protect([
  "procurement_officer", 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Sales/Marketing",
  "Operations",
  "Human Resources",
  "Accounting/Finance",
  "Other",
  "vendor"
]), getDrivers);

module.exports = router;