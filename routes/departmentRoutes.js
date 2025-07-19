const express = require('express');
const router = express.Router();
const {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentEmployees,
  addEmployeeToDepartment,
  removeEmployeeFromDepartment,
  getDepartmentPerformance,
  updateDepartmentPerformance,
  searchDepartments,
  getDepartmentStats,
  bulkUpdateDepartments,
  exportDepartments
} = require('../api/controllers/departmentController'); // Adjust path as needed

const { protect} = require('../api/middleware/authMiddleware'); // Adjust path as needed


// Statistics and exports (should come before parameterized routes)
router.get('/stats',  protect([ 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources","Enterprise(CEO, CFO, etc.)"
]), getDepartmentStats);
router.get('/export',protect([ 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources","Enterprise(CEO, CFO, etc.)"
]), exportDepartments);
router.get('/search', searchDepartments);

// CRUD operations
router.route('/')
  .get(getAllDepartments)
  .post(protect([ 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources","Enterprise(CEO, CFO, etc.)"
]), createDepartment);

// Bulk operations
router.put('/bulk-update', protect([ 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources","Enterprise(CEO, CFO, etc.)"
]), bulkUpdateDepartments);

// Individual department operations
router.route('/:id')
  .get(getDepartmentById)
  .put(protect([ 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources","Enterprise(CEO, CFO, etc.)"
]), updateDepartment)
  .delete(protect([ 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources","Enterprise(CEO, CFO, etc.)"
]), deleteDepartment);

// Department employees management
router.route('/:id/employees')
  .get(getDepartmentEmployees);

router.route('/:departmentId/employees/:employeeId')
  .post(protect([ 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources","Enterprise(CEO, CFO, etc.)"
]), addEmployeeToDepartment)
  .delete(protect([ 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources","Enterprise(CEO, CFO, etc.)"
]), removeEmployeeFromDepartment);

// Department performance management
router.route('/:id/performance')
  .get(getDepartmentPerformance)
  .put(protect([ 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources","Enterprise(CEO, CFO, etc.)"
]), updateDepartmentPerformance);

module.exports = router;