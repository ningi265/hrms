const BudgetAllocation = require('../../models/budget');
const Department = require('../../models/departments');
const User = require('../../models/user');

// Get all budget allocations
exports.getAllBudgetAllocations = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      budgetYear, 
      quarter,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (budgetYear) filter.budgetYear = parseInt(budgetYear);
    if (quarter) filter.quarter = quarter;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const allocations = await BudgetAllocation.find(filter)
      .populate('departmentAllocations.department', 'name departmentCode')
      .populate('createdBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await BudgetAllocation.countDocuments(filter);

    console.log(`Fetched ${allocations.length} budget allocations`);
    
    res.status(200).json({
      success: true,
      data: allocations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching budget allocations:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching budget allocations',
      error: error.message 
    });
  }
};

// Get budget allocation by ID
exports.getBudgetAllocationById = async (req, res) => {
  try {
    const allocation = await BudgetAllocation.findById(req.params.id)
      .populate('departmentAllocations.department')
      .populate('createdBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email')
      .populate('approvalWorkflow.approver', 'firstName lastName email');

    if (!allocation) {
      return res.status(404).json({ 
        success: false, 
        message: 'Budget allocation not found' 
      });
    }

    console.log(`Fetched budget allocation: ${allocation.budgetPeriod}`);
    res.status(200).json({
      success: true,
      data: allocation
    });
  } catch (error) {
    console.error('Error fetching budget allocation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching budget allocation',
      error: error.message 
    });
  }
};

// Get current active budget allocation
exports.getCurrentBudgetAllocation = async (req, res) => {
  try {
    const allocation = await BudgetAllocation.getCurrentAllocation();

    if (!allocation) {
      return res.status(404).json({ 
        success: false, 
        message: 'No active budget allocation found for current period' 
      });
    }

    console.log(`Fetched current budget allocation: ${allocation.budgetPeriod}`);
    res.status(200).json({
      success: true,
      data: allocation
    });
  } catch (error) {
    console.error('Error fetching current budget allocation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching current budget allocation',
      error: error.message 
    });
  }
};

// Create new budget allocation
exports.createBudgetAllocation = async (req, res) => {
  try {
    const {
      budgetPeriod,
      budgetYear,
      quarter,
      totalBudget,
      departmentAllocations,
      constraints,
      timeline,
      settings
    } = req.body;

    // Check if allocation already exists for this period
    const existingAllocation = await BudgetAllocation.findOne({ 
      budgetPeriod,
      status: { $ne: 'cancelled' }
    });

    if (existingAllocation) {
      return res.status(400).json({ 
        success: false, 
        message: `Budget allocation already exists for period ${budgetPeriod}` 
      });
    }

    // Validate department allocations
    if (departmentAllocations && departmentAllocations.length > 0) {
      const departmentIds = departmentAllocations.map(alloc => alloc.department);
      const departments = await Department.find({ _id: { $in: departmentIds } });
      
      if (departments.length !== departmentIds.length) {
        return res.status(400).json({ 
          success: false, 
          message: 'One or more departments not found' 
        });
      }

      // Enrich allocations with department details
      for (let allocation of departmentAllocations) {
        const dept = departments.find(d => d._id.toString() === allocation.department.toString());
        allocation.departmentName = dept.name;
        allocation.departmentCode = dept.departmentCode;
        allocation.previousAllocation = dept.budget || 0;
        allocation.allocatedBy = req.user._id;
      }
    }

    const newAllocation = new BudgetAllocation({
      budgetPeriod,
      budgetYear: budgetYear || new Date().getFullYear(),
      quarter,
      totalBudget,
      departmentAllocations: departmentAllocations || [],
      constraints,
      timeline,
      settings,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    const savedAllocation = await newAllocation.save();
    
    // Populate the response
    const populatedAllocation = await BudgetAllocation.findById(savedAllocation._id)
      .populate('departmentAllocations.department')
      .populate('createdBy', 'firstName lastName email');

    console.log(`Created budget allocation: ${budgetPeriod}`);

    res.status(201).json({
      success: true,
      message: 'Budget allocation created successfully',
      data: populatedAllocation
    });
  } catch (error) {
    console.error('Error creating budget allocation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while creating budget allocation',
      error: error.message 
    });
  }
};

// Update budget allocation
exports.updateBudgetAllocation = async (req, res) => {
  try {
    const allocationId = req.params.id;
    const updateData = req.body;

    const allocation = await BudgetAllocation.findById(allocationId);
    if (!allocation) {
      return res.status(404).json({ 
        success: false, 
        message: 'Budget allocation not found' 
      });
    }

    // Check if allocation can be updated (not approved or active)
    if (allocation.status === 'approved' || allocation.status === 'active') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot update approved or active budget allocation' 
      });
    }

    // Update department allocations if provided
    if (updateData.departmentAllocations) {
      const departmentIds = updateData.departmentAllocations.map(alloc => alloc.department);
      const departments = await Department.find({ _id: { $in: departmentIds } });
      
      // Enrich allocations with department details
      for (let alloc of updateData.departmentAllocations) {
        const dept = departments.find(d => d._id.toString() === alloc.department.toString());
        if (dept) {
          alloc.departmentName = dept.name;
          alloc.departmentCode = dept.departmentCode;
        }
      }
    }

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.createdBy;
    delete updateData.createdAt;

    updateData.updatedBy = req.user._id;
    updateData.updatedAt = new Date();

    // Add audit log entry
    if (!allocation.auditLog) allocation.auditLog = [];
    allocation.auditLog.push({
      action: 'updated',
      performedBy: req.user._id,
      description: 'Budget allocation updated',
      oldValues: allocation.toObject(),
      newValues: updateData,
      timestamp: new Date()
    });

    const updatedAllocation = await BudgetAllocation.findByIdAndUpdate(
      allocationId,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('departmentAllocations.department')
    .populate('updatedBy', 'firstName lastName email');

    console.log(`Updated budget allocation: ${updatedAllocation.budgetPeriod}`);
    res.status(200).json({
      success: true,
      message: 'Budget allocation updated successfully',
      data: updatedAllocation
    });
  } catch (error) {
    console.error('Error updating budget allocation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating budget allocation',
      error: error.message 
    });
  }
};

// Delete budget allocation
exports.deleteBudgetAllocation = async (req, res) => {
  try {
    const allocationId = req.params.id;

    const allocation = await BudgetAllocation.findById(allocationId);
    if (!allocation) {
      return res.status(404).json({ 
        success: false, 
        message: 'Budget allocation not found' 
      });
    }

    // Check if allocation can be deleted
    if (allocation.status === 'approved' || allocation.status === 'active') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete approved or active budget allocation. Cancel it instead.' 
      });
    }

    await BudgetAllocation.findByIdAndDelete(allocationId);

    console.log(`Deleted budget allocation: ${allocation.budgetPeriod}`);
    res.status(200).json({ 
      success: true, 
      message: 'Budget allocation deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting budget allocation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting budget allocation',
      error: error.message 
    });
  }
};

// Submit budget allocation for approval
exports.submitForApproval = async (req, res) => {
  try {
    const allocationId = req.params.id;

    const allocation = await BudgetAllocation.findById(allocationId);
    if (!allocation) {
      return res.status(404).json({ 
        success: false, 
        message: 'Budget allocation not found' 
      });
    }

    if (allocation.status !== 'draft') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only draft allocations can be submitted for approval' 
      });
    }

    await allocation.submitForApproval(req.user._id);

    // TODO: Send notifications to approvers

    console.log(`Submitted budget allocation for approval: ${allocation.budgetPeriod}`);
    res.status(200).json({
      success: true,
      message: 'Budget allocation submitted for approval successfully',
      data: allocation
    });
  } catch (error) {
    console.error('Error submitting budget allocation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while submitting budget allocation',
      error: error.message 
    });
  }
};

// Approve budget allocation
exports.approveBudgetAllocation = async (req, res) => {
  try {
    const allocationId = req.params.id;
    const { comments } = req.body;

    const allocation = await BudgetAllocation.findById(allocationId);
    if (!allocation) {
      return res.status(404).json({ 
        success: false, 
        message: 'Budget allocation not found' 
      });
    }

    if (allocation.status !== 'pending_approval') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only pending allocations can be approved' 
      });
    }

    await allocation.approve(req.user._id, comments);

    // Update department budgets
    for (const deptAllocation of allocation.departmentAllocations) {
      await Department.findByIdAndUpdate(
        deptAllocation.department,
        { 
          budget: deptAllocation.allocatedAmount,
          budgetYear: allocation.budgetYear,
          updatedBy: req.user._id 
        }
      );
    }

    console.log(`Approved budget allocation: ${allocation.budgetPeriod}`);
    res.status(200).json({
      success: true,
      message: 'Budget allocation approved successfully',
      data: allocation
    });
  } catch (error) {
    console.error('Error approving budget allocation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while approving budget allocation',
      error: error.message 
    });
  }
};

// Reject budget allocation
exports.rejectBudgetAllocation = async (req, res) => {
  try {
    const allocationId = req.params.id;
    const { comments } = req.body;

    const allocation = await BudgetAllocation.findById(allocationId);
    if (!allocation) {
      return res.status(404).json({ 
        success: false, 
        message: 'Budget allocation not found' 
      });
    }

    if (allocation.status !== 'pending_approval') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only pending allocations can be rejected' 
      });
    }

    await allocation.reject(req.user._id, comments);

    console.log(`Rejected budget allocation: ${allocation.budgetPeriod}`);
    res.status(200).json({
      success: true,
      message: 'Budget allocation rejected successfully',
      data: allocation
    });
  } catch (error) {
    console.error('Error rejecting budget allocation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while rejecting budget allocation',
      error: error.message 
    });
  }
};

// Auto-distribute budget
exports.autoDistributeBudget = async (req, res) => {
  try {
    const { totalBudget, distributionMethod = 'equal', departmentIds } = req.body;

    if (!totalBudget || totalBudget <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid total budget is required' 
      });
    }

    // Get departments
    const filter = departmentIds ? { _id: { $in: departmentIds } } : { status: 'active' };
    const departments = await Department.find(filter);

    if (departments.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No departments found for allocation' 
      });
    }

    let allocations = [];

    switch (distributionMethod) {
      case 'equal':
        const equalAmount = Math.floor(totalBudget / departments.length);
        const remainder = totalBudget % departments.length;
        
        allocations = departments.map((dept, index) => ({
          department: dept._id,
          departmentName: dept.name,
          departmentCode: dept.departmentCode,
          allocatedAmount: equalAmount + (index < remainder ? 1 : 0),
          category: 'Operations',
          priority: 'medium'
        }));
        break;

      case 'proportional':
        const totalEmployees = departments.reduce((sum, dept) => sum + (dept.employeeCount || 1), 0);
        allocations = departments.map(dept => ({
          department: dept._id,
          departmentName: dept.name,
          departmentCode: dept.departmentCode,
          allocatedAmount: Math.floor((dept.employeeCount || 1) / totalEmployees * totalBudget),
          category: 'Operations',
          priority: 'medium'
        }));
        break;

      case 'previous':
        const totalPreviousBudget = departments.reduce((sum, dept) => sum + (dept.budget || 0), 0);
        if (totalPreviousBudget > 0) {
          allocations = departments.map(dept => ({
            department: dept._id,
            departmentName: dept.name,
            departmentCode: dept.departmentCode,
            allocatedAmount: Math.floor((dept.budget || 0) / totalPreviousBudget * totalBudget),
            category: 'Operations',
            priority: 'medium'
          }));
        } else {
          // Fallback to equal distribution
          const equalAmount = Math.floor(totalBudget / departments.length);
          allocations = departments.map(dept => ({
            department: dept._id,
            departmentName: dept.name,
            departmentCode: dept.departmentCode,
            allocatedAmount: equalAmount,
            category: 'Operations',
            priority: 'medium'
          }));
        }
        break;

      default:
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid distribution method' 
        });
    }

    console.log(`Auto-distributed budget using ${distributionMethod} method`);
    res.status(200).json({
      success: true,
      message: `Budget distributed using ${distributionMethod} method`,
      data: {
        totalBudget,
        distributionMethod,
        allocations,
        totalAllocated: allocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0)
      }
    });
  } catch (error) {
    console.error('Error auto-distributing budget:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while auto-distributing budget',
      error: error.message 
    });
  }
};

// Get budget allocation summary
exports.getBudgetAllocationSummary = async (req, res) => {
  try {
    const { budgetYear, quarter } = req.query;
    
    const filter = {};
    if (budgetYear) filter.budgetYear = parseInt(budgetYear);
    if (quarter) filter.quarter = quarter;

    const allocations = await BudgetAllocation.find(filter)
      .populate('departmentAllocations.department', 'name departmentCode');

    // Calculate summary statistics
    const summary = {
      totalAllocations: allocations.length,
      totalBudget: allocations.reduce((sum, alloc) => sum + alloc.totalBudget, 0),
      totalAllocated: allocations.reduce((sum, alloc) => sum + alloc.totalAllocated, 0),
      byStatus: {},
      byCategory: {},
      byQuarter: {},
      departmentSummary: {}
    };

    // Group by status
    allocations.forEach(alloc => {
      summary.byStatus[alloc.status] = (summary.byStatus[alloc.status] || 0) + 1;
    });

    // Group by category and quarter
    allocations.forEach(alloc => {
      if (alloc.quarter) {
        summary.byQuarter[alloc.quarter] = (summary.byQuarter[alloc.quarter] || 0) + alloc.totalBudget;
      }

      alloc.categorySummary.forEach(cat => {
        summary.byCategory[cat.category] = (summary.byCategory[cat.category] || 0) + cat.totalAllocated;
      });

      // Department summary
      alloc.departmentAllocations.forEach(deptAlloc => {
        const deptName = deptAlloc.departmentName;
        if (!summary.departmentSummary[deptName]) {
          summary.departmentSummary[deptName] = {
            totalAllocated: 0,
            allocationCount: 0
          };
        }
        summary.departmentSummary[deptName].totalAllocated += deptAlloc.allocatedAmount;
        summary.departmentSummary[deptName].allocationCount += 1;
      });
    });

    console.log('Generated budget allocation summary');
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error generating budget summary:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while generating budget summary',
      error: error.message 
    });
  }
};

// Get department allocation history
exports.getDepartmentAllocationHistory = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { limit = 10 } = req.query;

    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ 
        success: false, 
        message: 'Department not found' 
      });
    }

    const history = await BudgetAllocation.getAllocationHistory(departmentId, parseInt(limit));

    const historyData = history.map(allocation => {
      const deptAllocation = allocation.departmentAllocations.find(
        alloc => alloc.department.toString() === departmentId
      );
      
      return {
        period: allocation.budgetPeriod,
        budgetYear: allocation.budgetYear,
        quarter: allocation.quarter,
        allocatedAmount: deptAllocation ? deptAllocation.allocatedAmount : 0,
        category: deptAllocation ? deptAllocation.category : '',
        priority: deptAllocation ? deptAllocation.priority : '',
        status: allocation.status,
        createdAt: allocation.createdAt
      };
    });

    console.log(`Retrieved allocation history for department: ${department.name}`);
    res.status(200).json({
      success: true,
      data: {
        department: {
          _id: department._id,
          name: department.name,
          departmentCode: department.departmentCode
        },
        history: historyData
      }
    });
  } catch (error) {
    console.error('Error fetching department allocation history:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching allocation history',
      error: error.message 
    });
  }
};

// Export budget allocation data
exports.exportBudgetAllocation = async (req, res) => {
  try {
    const { format = 'json', allocationId } = req.query;

    const allocation = await BudgetAllocation.findById(allocationId)
      .populate('departmentAllocations.department')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    if (!allocation) {
      return res.status(404).json({ 
        success: false, 
        message: 'Budget allocation not found' 
      });
    }

    if (format === 'csv') {
      const csvHeaders = [
        'Department Name', 'Department Code', 'Allocated Amount', 'Category', 
        'Priority', 'Previous Allocation', 'Change', 'Percentage', 'Notes'
      ].join(',');

      const csvData = allocation.departmentAllocations.map(alloc => [
        alloc.departmentName || '',
        alloc.departmentCode || '',
        alloc.allocatedAmount || 0,
        alloc.category || '',
        alloc.priority || '',
        alloc.previousAllocation || 0,
        alloc.allocationChange || 0,
        alloc.allocationPercentage ? alloc.allocationPercentage.toFixed(2) : '0.00',
        (alloc.notes || '').replace(/,/g, ';')
      ].join(',')).join('\n');

      const csv = `Budget Allocation - ${allocation.budgetPeriod}\nTotal Budget: ${allocation.totalBudget}\nTotal Allocated: ${allocation.totalAllocated}\n\n${csvHeaders}\n${csvData}`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=budget-allocation-${allocation.budgetPeriod}.csv`);
      res.status(200).send(csv);
    } else {
      res.status(200).json({
        success: true,
        data: allocation
      });
    }

    console.log(`Exported budget allocation: ${allocation.budgetPeriod} in ${format} format`);
  } catch (error) {
    console.error('Error exporting budget allocation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while exporting budget allocation',
      error: error.message 
    });
  }
};