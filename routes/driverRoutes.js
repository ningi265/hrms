// routes/fleetRoutes.js
const express = require('express');
const router = express.Router();
const driverController = require('../api/controllers/driverController');
const { protect } = require("../api/middleware/authMiddleware");


const authorizedRoles = [
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
  "vendor",
  "Driver"
];

// Fleet management routes
router.get('/', protect([
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
  "vendor",
   "Driver"
]), driverController.getAllDrivers);

router.post('/:id/location', protect([
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
  "vendor",
   "Driver"
]), driverController.driverLoc);



router.get('/statistics', protect([
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
  "vendor",
    "Driver"
]), driverController.getFleetStatistics);

router.get('/locations', protect(authorizedRoles), driverController.getDriverLocations);
router.get('/:driverId', protect([
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
  "vendor",
   "Driver"
]), driverController.getDriverById);
router.post('/drivers/:driverId/location', protect([
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
  "vendor",
   "Driver"
]), driverController.updateDriverLocation);
router.patch('/:driverId/status',protect([
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
  "vendor",
   "Driver"
]), driverController.updateDriverStatus);

router.get('/statistics', protect([
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
  "vendor",
    "Driver"
]), driverController.getFleetStatistics);
router.get('/assignments', protect([
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
  "vendor",
   "Driver"
]), driverController.getRecentAssignments);
router.post('/assignments', protect([
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
  "vendor",
   "Driver"
]), driverController.createAssignment);
router.patch('/assignments/:assignmentId', protect([
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
  "vendor",
  "Driver"
]), driverController.updateAssignment);

module.exports = router;