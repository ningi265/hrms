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
  requestPasswordReset,
  resetPassword,
  createEmployee,
  verifyRegistration,

  getProfile,
  updateProfile,
  updateSecuritySettings,
  changePassword,
  updateEmail,
  getUserStats,
  deleteAccount,
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  uploadAvatar,
  getEmployees,
  getEmployeeById,
  completeRegistration
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
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        
router.get("/employees", protect([
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
]), getEmployees);

router.post("/employees", protect([
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
]), createEmployee);

router.post("/complete-registration", completeRegistration);

router.get('/verify-registration/:token',verifyRegistration); 

//Password Reset
router.post("/reset",requestPasswordReset);
router.post('/reset-password', resetPassword);


// Profile Management Routes (all require authentication)
router.get('/profile', protect(["admin", "procurement_officer","vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Sales/Marketing","Vendor"]), getProfile);
router.put('/profile', protect(["admin", "procurement_officer","vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Sales/Marketing","Vendor"]), updateProfile);
router.put('/security', protect(["admin", "procurement_officer","vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Sales/Marketing","Vendor"]), updateSecuritySettings);
router.put('/change-password', protect(["admin", "procurement_officer","vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Sales/Marketing","Vendor"]), changePassword);
router.put('/update-email', protect(["admin", "procurement_officer","vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Sales/Marketing","Vendor"]), updateEmail);
router.get('/stats', protect(["admin", "procurement_officer","vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Sales/Marketing","Vendor"]), getUserStats);
router.delete('/account',protect(["admin", "procurement_officer","vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Sales/Marketing","Vendor"]), deleteAccount);
router.post('/upload-avatar', protect(["admin", "procurement_officer","vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Sales/Marketing","Vendor"]),uploadAvatar);

// Payment Methods Routes
router.get('/payment-methods',protect(["admin", "procurement_officer","vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Sales/Marketing","Vendor"]), getPaymentMethods);
router.post('/payment-methods',protect(["admin", "procurement_officer","vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Sales/Marketing","Vendor"]), addPaymentMethod);
router.put('/payment-methods/:paymentMethodId',protect(["admin", "procurement_officer","vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Sales/Marketing","Vendor"]), updatePaymentMethod);
router.delete('/payment-methods/:paymentMethodId',protect(["admin", "procurement_officer","vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Sales/Marketing","Vendor"]), deletePaymentMethod);
router.put('/payment-methods/:paymentMethodId/default', protect(["admin", "procurement_officer","vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Sales/Marketing","Vendor"]),setDefaultPaymentMethod);
router.get('/employees/:id',protect(["admin", "procurement_officer","vendor","IT/Technical",
        "Executive (CEO, CFO, etc.)",
        "Management",
        "Human Resources",
        "Accounting/Finance","Sales/Marketing","Vendor"]),getEmployeeById );
module.exports = router;