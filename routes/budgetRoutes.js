const express = require('express');
const router = express.Router();
const {protect} = require('../api/middleware/authMiddleware');
const budgetAllocationController = require('../api/controllers/budgetController');

// Validation middleware
const validateBudgetAllocation = (req, res, next) => {
  const { budgetPeriod, budgetYear, totalBudget } = req.body;
  
  const errors = [];
  
  if (!budgetPeriod || typeof budgetPeriod !== 'string') {
    errors.push('Budget period is required and must be a string');
  }
  
  if (!budgetYear || typeof budgetYear !== 'number' || budgetYear < 2020 || budgetYear > 2050) {
    errors.push('Budget year is required and must be between 2020 and 2050');
  }
  
  if (!totalBudget || typeof totalBudget !== 'number' || totalBudget <= 0) {
    errors.push('Total budget is required and must be a positive number');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }
  
  next();
};

// Validate department allocation
const validateDepartmentAllocation = (req, res, next) => {
  const { departmentAllocations } = req.body;
  
  if (departmentAllocations && Array.isArray(departmentAllocations)) {
    const errors = [];
    
    departmentAllocations.forEach((allocation, index) => {
      if (!allocation.department) {
        errors.push(`Department ID is required for allocation ${index + 1}`);
      }
      
      if (typeof allocation.allocatedAmount !== 'number' || allocation.allocatedAmount < 0) {
        errors.push(`Valid allocated amount is required for allocation ${index + 1}`);
      }
      
      if (!allocation.category) {
        errors.push(`Category is required for allocation ${index + 1}`);
      }
    });
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Department allocation validation failed',
        errors
      });
    }
  }
  
  next();
};

// GET /api/budget-allocations - Get all budget allocations
router.get('/', 
protect(['Admin', 'Executive (CEO, CFO, etc.)', "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer", 'Budget Manager', 'Department Head', 'Employee',"Enterprise(CEO, CFO, etc.)"]),
  budgetAllocationController.getAllBudgetAllocations
);

// GET /api/budget-allocations/current - Get current active budget allocation
router.get('/current', 
 protect(['Admin', 'Executive (CEO, CFO, etc.)', "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer", 'Budget Manager', 'Department Head', 'Employee',"Enterprise(CEO, CFO, etc.)"]),
  budgetAllocationController.getCurrentBudgetAllocation
);

// GET /api/budget-allocations/summary - Get budget allocation summary
router.get('/summary', 
  protect(['Admin', 'Executive (CEO, CFO, etc.)', "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer", 'Budget Manager', 'Department Head', 'Employee',"Enterprise(CEO, CFO, etc.)"]),
  budgetAllocationController.getBudgetAllocationSummary
);

// GET /api/budget-allocations/export - Export budget allocation data
router.get('/export', 
  protect(['Admin', 'Executive (CEO, CFO, etc.)', "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer", 'Budget Manager', 'Department Head', 'Employee',"Enterprise(CEO, CFO, etc.)"]),
  budgetAllocationController.exportBudgetAllocation
);

// POST /api/budget-allocations/auto-distribute - Auto-distribute budget
router.post('/auto-distribute', 
  protect(['Admin', 'Executive (CEO, CFO, etc.)', "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer", 'Budget Manager', 'Department Head', 'Employee',"Enterprise(CEO, CFO, etc.)"]),
  budgetAllocationController.autoDistributeBudget
);

// GET /api/budget-allocations/:id - Get budget allocation by ID
router.get('/:id', 
  protect(['Admin', 'Executive (CEO, CFO, etc.)', "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer", 'Budget Manager', 'Department Head', 'Employee',"Enterprise(CEO, CFO, etc.)"]),
  budgetAllocationController.getBudgetAllocationById
);

// POST /api/budget-allocations - Create new budget allocation
router.post('/', 
  protect(['Admin', 'Executive (CEO, CFO, etc.)', "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer", 'Budget Manager', 'Department Head', 'Employee',"Enterprise(CEO, CFO, etc.)"]),
  validateBudgetAllocation,
  validateDepartmentAllocation,
  budgetAllocationController.createBudgetAllocation
);

// PUT /api/budget-allocations/:id - Update budget allocation
router.put('/:id', 
   protect(['Admin', 'Executive (CEO, CFO, etc.)', "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer", 'Budget Manager', 'Department Head', 'Employee']),
  validateDepartmentAllocation,
  budgetAllocationController.updateBudgetAllocation
);

// DELETE /api/budget-allocations/:id - Delete budget allocation
router.delete('/:id', 
   protect(['Admin', 'Executive (CEO, CFO, etc.)',  "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer",'Budget Manager', 'Department Head', 'Employee',"Enterprise(CEO, CFO, etc.)"]),
  budgetAllocationController.deleteBudgetAllocation
);

// POST /api/budget-allocations/:id/submit - Submit budget allocation for approval
router.post('/:id/submit', 
  protect(['Admin', 'Executive (CEO, CFO, etc.)', "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer", 'Budget Manager', 'Department Head', 'Employee']),
  budgetAllocationController.submitForApproval
);

// POST /api/budget-allocations/:id/approve - Approve budget allocation
router.post('/:id/approve', 
   protect(['Admin', 'Executive (CEO, CFO, etc.)', "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer", 'Budget Manager', 'Department Head', 'Employee',"Enterprise(CEO, CFO, etc.)"]),
  budgetAllocationController.approveBudgetAllocation
);

// POST /api/budget-allocations/:id/reject - Reject budget allocation
router.post('/:id/reject', 
  protect(['Admin', 'Executive (CEO, CFO, etc.)', "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer", 'Budget Manager', 'Department Head', 'Employee',"Enterprise(CEO, CFO, etc.)"]),
  budgetAllocationController.rejectBudgetAllocation
);

// GET /api/budget-allocations/department/:departmentId/history - Get department allocation history
router.get('/department/:departmentId/history', 
  protect(['Admin', 'Executive (CEO, CFO, etc.)',  "Procurement Officer",
    "Senior Procurement Officer",
     "Procurement Manager",
     "Supply Chain Officer",'Budget Manager', 'Department Head', 'Employee',"Enterprise(CEO, CFO, etc.)"]),
  budgetAllocationController.getDepartmentAllocationHistory
);

// Middleware to log all budget allocation activities
router.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`Budget Allocation API: ${req.method} ${req.path} - Status: ${res.statusCode}`);
    originalSend.call(this, data);
  };
  next();
});

module.exports = router;