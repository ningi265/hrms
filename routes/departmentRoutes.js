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
  "Human Resources",
]), getDepartmentStats);
router.get('/export',protect([ 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources",
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
  "Human Resources",
]), createDepartment);

// Bulk operations
router.put('/bulk-update', protect([ 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources",
]), bulkUpdateDepartments);

// Individual department operations
router.route('/:id')
  .get(getDepartmentById)
  .put(protect([ 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources",
]), updateDepartment)
  .delete(protect([ 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources",
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
  "Human Resources",
]), addEmployeeToDepartment)
  .delete(protect([ 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources",
]), removeEmployeeFromDepartment);

// Department performance management
router.route('/:id/performance')
  .get(getDepartmentPerformance)
  .put(protect([ 
  "admin", 
  "IT/Technical",
  "Executive (CEO, CFO, etc.)",
  "Management",
  "Human Resources",
]), updateDepartmentPerformance);

module.exports = router;