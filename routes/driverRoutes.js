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
  "Driver","Enterprise(CEO, CFO, etc.)", "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer"
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
   "Driver","Enterprise(CEO, CFO, etc.)", "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer"
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
   "Driver","Enterprise(CEO, CFO, etc.)", "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer"
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
    "Driver","Enterprise(CEO, CFO, etc.)", "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer"
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
   "Driver","Enterprise(CEO, CFO, etc.)", "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer"
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
   "Driver","Enterprise(CEO, CFO, etc.)", "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer"
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
   "Driver","Enterprise(CEO, CFO, etc.)", "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer"
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
    "Driver","Enterprise(CEO, CFO, etc.)", "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer"
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
   "Driver","Enterprise(CEO, CFO, etc.)", "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer"
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
   "Driver","Enterprise(CEO, CFO, etc.)", "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer"
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
  "Driver","Enterprise(CEO, CFO, etc.)", "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer"
]), driverController.updateAssignment);

router.post('/:driverId/fetch-live-location', driverController.fetchLiveLocation);

// Fetch live locations for all active drivers
// This endpoint fetches current GPS locations for all active drivers
router.post('/fetch-all-live-locations', driverController.fetchAllLiveLocations);

module.exports = router;