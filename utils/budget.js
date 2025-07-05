const BudgetAllocation = require('../models/budget');
const Department = require('../models/departments');

/**
 * Calculate budget distribution based on different strategies
 */
class BudgetDistributor {
  /**
   * Distribute budget equally among departments
   * @param {Number} totalBudget - Total budget to distribute
   * @param {Array} departments - Array of department objects
   * @returns {Array} Array of allocation objects
   */
  static distributeEqually(totalBudget, departments) {
    if (!departments || departments.length === 0) {
      throw new Error('No departments provided for budget distribution');
    }

    const baseAmount = Math.floor(totalBudget / departments.length);
    const remainder = totalBudget % departments.length;

    return departments.map((dept, index) => ({
      department: dept._id,
      departmentName: dept.name,
      departmentCode: dept.departmentCode,
      allocatedAmount: baseAmount + (index < remainder ? 1 : 0),
      allocationPercentage: ((baseAmount + (index < remainder ? 1 : 0)) / totalBudget) * 100,
      category: 'Operations',
      priority: 'medium',
      distributionMethod: 'equal'
    }));
  }

  /**
   * Distribute budget based on department employee count
   * @param {Number} totalBudget - Total budget to distribute
   * @param {Array} departments - Array of department objects
   * @returns {Array} Array of allocation objects
   */
  static distributeByEmployeeCount(totalBudget, departments) {
    if (!departments || departments.length === 0) {
      throw new Error('No departments provided for budget distribution');
    }

    const totalEmployees = departments.reduce((sum, dept) => sum + (dept.employeeCount || 1), 0);
    
    if (totalEmployees === 0) {
      return this.distributeEqually(totalBudget, departments);
    }

    return departments.map(dept => {
      const employeeCount = dept.employeeCount || 1;
      const allocation = Math.floor((employeeCount / totalEmployees) * totalBudget);
      
      return {
        department: dept._id,
        departmentName: dept.name,
        departmentCode: dept.departmentCode,
        allocatedAmount: allocation,
        allocationPercentage: (allocation / totalBudget) * 100,
        category: 'Operations',
        priority: 'medium',
        distributionMethod: 'employee_based',
        employeeCount
      };
    });
  }

  /**
   * Distribute budget based on historical spending
   * @param {Number} totalBudget - Total budget to distribute
   * @param {Array} departments - Array of department objects
   * @returns {Array} Array of allocation objects
   */
  static distributeByHistoricalSpending(totalBudget, departments) {
    if (!departments || departments.length === 0) {
      throw new Error('No departments provided for budget distribution');
    }

    const totalHistoricalBudget = departments.reduce((sum, dept) => sum + (dept.budget || 0), 0);
    
    if (totalHistoricalBudget === 0) {
      return this.distributeEqually(totalBudget, departments);
    }

    return departments.map(dept => {
      const historicalBudget = dept.budget || 0;
      const allocation = Math.floor((historicalBudget / totalHistoricalBudget) * totalBudget);
      
      return {
        department: dept._id,
        departmentName: dept.name,
        departmentCode: dept.departmentCode,
        allocatedAmount: allocation,
        previousAllocation: historicalBudget,
        allocationChange: allocation - historicalBudget,
        allocationPercentage: (allocation / totalBudget) * 100,
        category: 'Operations',
        priority: 'medium',
        distributionMethod: 'historical_based'
      };
    });
  }

  /**
   * Distribute budget based on department priority
   * @param {Number} totalBudget - Total budget to distribute
   * @param {Array} departments - Array of department objects
   * @returns {Array} Array of allocation objects
   */
  static distributeByPriority(totalBudget, departments) {
    if (!departments || departments.length === 0) {
      throw new Error('No departments provided for budget distribution');
    }

    const priorityWeights = {
      'critical': 0.4,
      'high': 0.3,
      'medium': 0.2,
      'low': 0.1
    };

    const totalWeight = departments.reduce((sum, dept) => {
      const weight = priorityWeights[dept.priority] || priorityWeights['medium'];
      return sum + weight;
    }, 0);

    return departments.map(dept => {
      const weight = priorityWeights[dept.priority] || priorityWeights['medium'];
      const allocation = Math.floor((weight / totalWeight) * totalBudget);
      
      return {
        department: dept._id,
        departmentName: dept.name,
        departmentCode: dept.departmentCode,
        allocatedAmount: allocation,
        allocationPercentage: (allocation / totalBudget) * 100,
        category: 'Operations',
        priority: dept.priority || 'medium',
        distributionMethod: 'priority_based',
        priorityWeight: weight
      };
    });
  }
}

/**
 * Budget calculation utilities
 */
class BudgetCalculator {
  /**
   * Calculate budget utilization percentage
   * @param {Number} allocated - Allocated budget
   * @param {Number} spent - Amount spent
   * @returns {Number} Utilization percentage
   */
  static calculateUtilization(allocated, spent) {
    if (!allocated || allocated === 0) return 0;
    return Math.round((spent / allocated) * 100);
  }

  /**
   * Calculate remaining budget
   * @param {Number} allocated - Allocated budget
   * @param {Number} spent - Amount spent
   * @returns {Number} Remaining budget
   */
  static calculateRemaining(allocated, spent) {
    return Math.max(0, allocated - spent);
  }

  /**
   * Calculate budget variance
   * @param {Number} budgeted - Budgeted amount
   * @param {Number} actual - Actual amount
   * @returns {Object} Variance object with amount and percentage
   */
  static calculateVariance(budgeted, actual) {
    const variance = actual - budgeted;
    const percentage = budgeted !== 0 ? (variance / budgeted) * 100 : 0;
    
    return {
      amount: variance,
      percentage: Math.round(percentage * 100) / 100,
      isOverBudget: variance > 0,
      isUnderBudget: variance < 0
    };
  }

  /**
   * Calculate quarterly budget from annual budget
   * @param {Number} annualBudget - Annual budget amount
   * @param {String} quarter - Quarter (Q1, Q2, Q3, Q4)
   * @returns {Number} Quarterly budget
   */
  static calculateQuarterlyBudget(annualBudget, quarter) {
    // Simple equal distribution for now
    // Can be enhanced to handle seasonal variations
    return Math.floor(annualBudget / 4);
  }

  /**
   * Calculate monthly budget from quarterly budget
   * @param {Number} quarterlyBudget - Quarterly budget amount
   * @param {Number} month - Month number (1-3 for quarter)
   * @returns {Number} Monthly budget
   */
  static calculateMonthlyBudget(quarterlyBudget, month) {
    return Math.floor(quarterlyBudget / 3);
  }
}

/**
 * Budget validation utilities
 */
class BudgetValidator {
  /**
   * Validate budget allocation rules
   * @param {Object} allocation - Budget allocation object
   * @returns {Object} Validation result
   */
  static validateAllocation(allocation) {
    const errors = [];
    const warnings = [];

    // Check if total allocated exceeds total budget
    if (allocation.totalAllocated > allocation.totalBudget) {
      errors.push('Total allocated amount exceeds total budget');
    }

    // Check for departments with zero allocation
    const zeroAllocations = allocation.departmentAllocations.filter(
      dept => dept.allocatedAmount === 0
    );
    if (zeroAllocations.length > 0) {
      warnings.push(`${zeroAllocations.length} departments have zero allocation`);
    }

    // Check for departments with very high allocation percentage
    const highAllocationThreshold = 50; // 50% of total budget
    const highAllocations = allocation.departmentAllocations.filter(
      dept => dept.allocationPercentage > highAllocationThreshold
    );
    if (highAllocations.length > 0) {
      warnings.push('Some departments have very high budget allocation (>50%)');
    }

    // Check allocation efficiency
    const efficiency = (allocation.totalAllocated / allocation.totalBudget) * 100;
    if (efficiency < 90) {
      warnings.push('Budget allocation efficiency is below 90%');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      efficiency
    };
  }

  /**
   * Validate department allocation constraints
   * @param {Array} allocations - Array of department allocations
   * @param {Object} constraints - Constraint object
   * @returns {Object} Validation result
   */
  static validateConstraints(allocations, constraints = {}) {
    const errors = [];
    const warnings = [];

    if (constraints.maxDepartmentAllocation) {
      const violatingDepts = allocations.filter(
        alloc => alloc.allocatedAmount > constraints.maxDepartmentAllocation
      );
      if (violatingDepts.length > 0) {
        errors.push(`${violatingDepts.length} departments exceed maximum allocation limit`);
      }
    }

    if (constraints.minDepartmentAllocation) {
      const violatingDepts = allocations.filter(
        alloc => alloc.allocatedAmount < constraints.minDepartmentAllocation
      );
      if (violatingDepts.length > 0) {
        errors.push(`${violatingDepts.length} departments are below minimum allocation limit`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

/**
 * Budget reporting utilities
 */
class BudgetReporter {
  /**
   * Generate budget summary report
   * @param {Object} allocation - Budget allocation object
   * @returns {Object} Summary report
   */
  static generateSummary(allocation) {
    const summary = {
      period: allocation.budgetPeriod,
      totalBudget: allocation.totalBudget,
      totalAllocated: allocation.totalAllocated,
      remainingBudget: allocation.remainingBudget,
      allocationEfficiency: allocation.allocationEfficiency,
      departmentCount: allocation.departmentCount,
      status: allocation.status,
      categories: allocation.categorySummary || [],
      topAllocations: allocation.departmentAllocations
        .sort((a, b) => b.allocatedAmount - a.allocatedAmount)
        .slice(0, 5)
        .map(dept => ({
          department: dept.departmentName,
          amount: dept.allocatedAmount,
          percentage: dept.allocationPercentage
        }))
    };

    return summary;
  }

  /**
   * Generate variance report
   * @param {Object} currentAllocation - Current period allocation
   * @param {Object} previousAllocation - Previous period allocation
   * @returns {Object} Variance report
   */
  static generateVarianceReport(currentAllocation, previousAllocation) {
    if (!previousAllocation) {
      return { message: 'No previous allocation data for comparison' };
    }

    const budgetVariance = BudgetCalculator.calculateVariance(
      previousAllocation.totalBudget,
      currentAllocation.totalBudget
    );

    const departmentVariances = currentAllocation.departmentAllocations.map(currentDept => {
      const previousDept = previousAllocation.departmentAllocations.find(
        prev => prev.department.toString() === currentDept.department.toString()
      );

      if (previousDept) {
        const variance = BudgetCalculator.calculateVariance(
          previousDept.allocatedAmount,
          currentDept.allocatedAmount
        );
        return {
          department: currentDept.departmentName,
          current: currentDept.allocatedAmount,
          previous: previousDept.allocatedAmount,
          variance
        };
      }

      return {
        department: currentDept.departmentName,
        current: currentDept.allocatedAmount,
        previous: 0,
        variance: {
          amount: currentDept.allocatedAmount,
          percentage: 100,
          isOverBudget: true,
          isUnderBudget: false
        },
        isNew: true
      };
    });

    return {
      budgetVariance,
      departmentVariances,
      significantChanges: departmentVariances.filter(
        dept => Math.abs(dept.variance.percentage) > 20
      )
    };
  }
}

/**
 * Notification utilities for budget-related events
 */
class BudgetNotificationService {
  /**
   * Generate notifications for budget events
   * @param {String} eventType - Type of budget event
   * @param {Object} data - Event data
   * @returns {Array} Array of notification objects
   */
  static generateNotifications(eventType, data) {
    const notifications = [];

    switch (eventType) {
      case 'allocation_created':
        notifications.push({
          type: 'info',
          title: 'New Budget Allocation Created',
          message: `Budget allocation for ${data.budgetPeriod} has been created`,
          recipients: ['Finance Manager', 'CFO', 'Admin']
        });
        break;

      case 'allocation_submitted':
        notifications.push({
          type: 'approval_required',
          title: 'Budget Allocation Pending Approval',
          message: `Budget allocation for ${data.budgetPeriod} has been submitted for approval`,
          recipients: ['Finance Manager', 'CFO']
        });
        break;

      case 'allocation_approved':
        notifications.push({
          type: 'success',
          title: 'Budget Allocation Approved',
          message: `Budget allocation for ${data.budgetPeriod} has been approved`,
          recipients: ['Budget Manager', 'Department Head']
        });
        
        // Notify affected departments
        data.departmentAllocations.forEach(dept => {
          notifications.push({
            type: 'budget_updated',
            title: 'Department Budget Updated',
            message: `Your department budget has been updated to ${dept.allocatedAmount}`,
            recipients: [dept.departmentManager],
            department: dept.department
          });
        });
        break;

      case 'allocation_rejected':
        notifications.push({
          type: 'warning',
          title: 'Budget Allocation Rejected',
          message: `Budget allocation for ${data.budgetPeriod} has been rejected`,
          recipients: ['Budget Manager']
        });
        break;

      case 'budget_exceeded':
        notifications.push({
          type: 'alert',
          title: 'Budget Allocation Exceeded',
          message: `Total allocation exceeds available budget by ${data.overageAmount}`,
          recipients: ['Finance Manager', 'CFO', 'Budget Manager']
        });
        break;
    }

    return notifications;
  }
}

module.exports = {
  BudgetDistributor,
  BudgetCalculator,
  BudgetValidator,
  BudgetReporter,
  BudgetNotificationService
};