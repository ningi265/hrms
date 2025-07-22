const Department = require('../../models/departments');
const User = require('../../models/user'); 
// Get all departments
exports.getAllDepartmentsAdmin = async (req, res) => {
  try {
    const departments = await Department.find()
      .populate('headEmployeeId', 'firstName lastName email phoneNumber')
      .populate('parentDepartment', 'name departmentCode')
      .populate('subDepartments', 'name departmentCode employeeCount')
      .sort({ createdAt: -1 });

    console.log(`Fetched ${departments.length} departments`);
    res.status(200).json(departments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ message: 'Server error while fetching departments' });
  }
};

exports.getAllDepartments = async (req, res) => {
  try {
    // Get the requesting user's company
    console.log("Requesting user ID:", req.user._id);
    const requestingUser = await User.findById(req.user._id).select('company isEnterpriseAdmin');
    if (!requestingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Base query - filter by company unless user is enterprise admin with special privileges
    const baseQuery = requestingUser.isEnterpriseAdmin && req.query.allCompanies ? {} : { company: requestingUser.company };

    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get sorting parameters
    const sortField = req.query.sortBy || 'name';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
    const sort = { [sortField]: sortOrder };

    // Get departments with full details
    const departments = await Department.find(baseQuery)
      .populate({
        path: 'headEmployeeId',
        select: 'firstName lastName email phoneNumber position avatar',
        populate: {
          path: 'department',
          select: 'name departmentCode'
        }
      })
      .populate({
        path: 'parentDepartment',
        select: 'name departmentCode company',
        populate: {
          path: 'company',
          select: 'name'
        }
      })
      .populate({
        path: 'subDepartments',
        select: 'name departmentCode status employeeCount budget',
        options: { sort: { name: 1 } }
      })
      .populate({
        path: 'company',
        select: 'name industry'
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalCount = await Department.countDocuments(baseQuery);

    // Get department statistics
    const stats = await Department.aggregate([
      { $match: baseQuery },
      { 
        $group: {
          _id: null,
          totalDepartments: { $sum: 1 },
          activeDepartments: { 
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } 
          },
          inactiveDepartments: { 
            $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] } 
          },
          totalBudget: { $sum: "$budget" },
          avgEmployeeCount: { $avg: "$employeeCount" }
        }
      }
    ]);

    // Get department distribution by location
    const locationDistribution = await Department.aggregate([
      { $match: baseQuery },
      { 
        $group: {
          _id: "$location",
          count: { $sum: 1 },
          totalBudget: { $sum: "$budget" }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log(`Fetched ${departments.length} departments for company ${requestingUser.company}`);

    res.status(200).json({
      success: true,
      data: departments,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        sort: `${sortField}:${sortOrder === 1 ? 'asc' : 'desc'}`,
        stats: stats[0] || {},
        locationDistribution,
        context: {
          company: requestingUser.company,
          isEnterpriseAdmin: requestingUser.isEnterpriseAdmin,
          allCompanies: req.query.allCompanies ? true : false
        }
      }
    });

  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching departments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get department by ID
exports.getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('headEmployeeId', 'firstName lastName email phoneNumber position')
      .populate('parentDepartment', 'name departmentCode')
      .populate('subDepartments', 'name departmentCode employeeCount')
      .populate('employees', 'firstName lastName email position status')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    console.log("Fetching department with ID:", req.params.id);

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    res.status(200).json(department);
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).json({ message: 'Server error while fetching department' });
  }
};

// Create new department
exports.createDepartment = async (req, res) => {
  try {
    // Get the requesting user's company
    const requestingUser = await User.findById(req.user._id).select('company isEnterpriseAdmin');
    if (!requestingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const {
      name,
      description,
      departmentHead,
      headEmail,
      headPhone,
      location,
      budget,
      status,
      goals,
      establishedDate,
      parentDepartment,
      maxCapacity,
      floor,
      building,
      departmentCode
    } = req.body;

    // Validate required fields
    if (!name || !headEmail) {
      return res.status(400).json({
        message: "Department name and head email are required",
        requiredFields: ['name', 'headEmail']
      });
    }

    // Check if department already exists in this company
    const existingDepartment = await Department.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      company: requestingUser.company
    });
    
    if (existingDepartment) {
      return res.status(400).json({ 
        message: 'Department with this name already exists in your company' 
      });
    }

    // Check if department code is unique within company
    if (departmentCode) {
      const existingCode = await Department.findOne({
        departmentCode,
        company: requestingUser.company
      });
      if (existingCode) {
        return res.status(400).json({ 
          message: 'Department code must be unique within your company' 
        });
      }
    }

    // Verify head email belongs to an employee in the same company
    const headEmployee = await User.findOne({ 
      email: headEmail,
      company: requestingUser.company,
      role: { $in: ['Sales/Marketing', 'Management', 'Executive(CEO, CFO, etc.)','Enterprise(CEO, CFO, etc.)'] }
    });
    
    if (!headEmployee) {
      return res.status(400).json({ 
        message: 'Head email must belong to an existing employee in your company with appropriate role' 
      });
    }

    // Validate parent department belongs to same company
    let validParentDepartment = null;
    if (parentDepartment) {
      const parentDept = await Department.findOne({
        _id: parentDepartment,
        company: requestingUser.company
      });
      if (!parentDept) {
        return res.status(400).json({ 
          message: 'Parent department not found in your company' 
        });
      }
      validParentDepartment = parentDept._id;
    }

    // Create new department
    const newDepartment = new Department({
      name,
      description,
      departmentCode: departmentCode || generateDepartmentCode(name),
      departmentHead,
      headEmail,
      headPhone,
      headEmployeeId: headEmployee._id,
      location,
      floor,
      building,
      budget: budget ? parseFloat(budget) : null,
      status: status || 'active',
      goals: goals || [],
      establishedDate: establishedDate ? new Date(establishedDate) : new Date(),
      parentDepartment: validParentDepartment,
      maxCapacity: maxCapacity ? parseInt(maxCapacity) : null,
      company: requestingUser.company,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    const savedDepartment = await newDepartment.save();
    
    // Update the head employee's department assignment
    await User.findByIdAndUpdate(headEmployee._id, {
      $addToSet: { departments: savedDepartment._id },
      department: savedDepartment._id,
      isDepartmentHead: true
    });

    // Populate the response with detailed information
    const populatedDepartment = await Department.findById(savedDepartment._id)
      .populate({
        path: 'headEmployeeId',
        select: 'firstName lastName email phoneNumber position',
        populate: {
          path: 'department',
          select: 'name'
        }
      })
      .populate({
        path: 'parentDepartment',
        select: 'name departmentCode'
      })
      .populate({
        path: 'company',
        select: 'name industry'
      });

    console.log(`Created new department: ${name} in company ${requestingUser.company}`);

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      department: populatedDepartment
    });

  } catch (error) {
    console.error('Error creating department:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `Department with this ${field} already exists`,
        field
      });
    }
    
    res.status(500).json({ 
      message: 'Server error while creating department',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper function to generate department code
function generateDepartmentCode(name) {
  const prefix = name.substring(0, 3).toUpperCase();
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${randomNum}`;
}

// Update department
exports.updateDepartment = async (req, res) => {
  try {
    const departmentId = req.params.id;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.departmentCode;
    delete updateData.employeeCount;
    delete updateData.employees;

    // Update timestamp and user
    updateData.updatedAt = new Date();
    updateData.updatedBy = req.user._id;

    // If budget is being updated, convert to number
    if (updateData.budget) {
      updateData.budget = parseFloat(updateData.budget);
    }

    // If establishedDate is being updated, convert to Date
    if (updateData.establishedDate) {
      updateData.establishedDate = new Date(updateData.establishedDate);
    }

    // If head email is being updated, try to find the corresponding employee
    if (updateData.headEmail) {
      const headEmployee = await User.findOne({ 
        email: updateData.headEmail, 
        role: 'employee' 
      });
      if (headEmployee) {
        updateData.headEmployeeId = headEmployee._id;
      } else {
        updateData.headEmployeeId = null;
      }
    }

    const updatedDepartment = await Department.findByIdAndUpdate(
      departmentId,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('headEmployeeId', 'firstName lastName email phoneNumber')
    .populate('parentDepartment', 'name departmentCode');

    if (!updatedDepartment) {
      return res.status(404).json({ message: 'Department not found' });
    }

    console.log(`Updated department: ${updatedDepartment.name}`);
    res.status(200).json({
      message: 'Department updated successfully',
      department: updatedDepartment
    });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ message: 'Server error while updating department' });
  }
};

// Delete department
exports.deleteDepartment = async (req, res) => {
  try {
    const departmentId = req.params.id;

    // Check if department has employees
    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    if (department.employeeCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete department with active employees. Please reassign employees first.' 
      });
    }

    // Check if department has sub-departments
    if (department.subDepartments && department.subDepartments.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete department with sub-departments. Please handle sub-departments first.' 
      });
    }

    const deletedDepartment = await Department.findByIdAndDelete(departmentId);

    console.log(`Deleted department: ${deletedDepartment.name}`);
    res.status(200).json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ message: 'Server error while deleting department' });
  }
};

// Get department employees
exports.getDepartmentEmployees = async (req, res) => {
  try {
    const departmentId = req.params.id;

    // First check if department exists
    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Get employees in this department
    const employees = await User.find({ 
      role: 'employee',
      department: department.name 
    })
    .select('-password')
    .sort({ firstName: 1 });

    console.log(`Found ${employees.length} employees in ${department.name} department`);
    res.status(200).json({
      department: {
        _id: department._id,
        name: department.name,
        departmentHead: department.departmentHead
      },
      employees
    });
  } catch (error) {
    console.error('Error fetching department employees:', error);
    res.status(500).json({ message: 'Server error while fetching department employees' });
  }
};

// Add employee to department
exports.addEmployeeToDepartment = async (req, res) => {
  try {
    const { departmentId, employeeId } = req.params;

    const department = await Department.findById(departmentId);
    const employee = await User.findById(employeeId);

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Update employee's department
    employee.department = department.name;
    await employee.save();

    // Add employee to department's employee list
    await department.addEmployee(employeeId);

    console.log(`Added employee ${employee.firstName} ${employee.lastName} to ${department.name}`);
    res.status(200).json({ 
      message: 'Employee added to department successfully',
      department: department.name,
      employee: `${employee.firstName} ${employee.lastName}`
    });
  } catch (error) {
    console.error('Error adding employee to department:', error);
    res.status(500).json({ message: 'Server error while adding employee to department' });
  }
};

// Remove employee from department
exports.removeEmployeeFromDepartment = async (req, res) => {
  try {
    const { departmentId, employeeId } = req.params;

    const department = await Department.findById(departmentId);
    const employee = await User.findById(employeeId);

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Remove employee from department
    employee.department = null;
    await employee.save();

    // Remove employee from department's employee list
    await department.removeEmployee(employeeId);

    console.log(`Removed employee ${employee.firstName} ${employee.lastName} from ${department.name}`);
    res.status(200).json({ 
      message: 'Employee removed from department successfully',
      department: department.name,
      employee: `${employee.firstName} ${employee.lastName}`
    });
  } catch (error) {
    console.error('Error removing employee from department:', error);
    res.status(500).json({ message: 'Server error while removing employee from department' });
  }
};

// Get department performance
exports.getDepartmentPerformance = async (req, res) => {
  try {
    const departmentId = req.params.id;

    const department = await Department.findById(departmentId)
      .populate('employees', 'firstName lastName position performanceRatings');

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Calculate performance metrics
    const performanceData = {
      department: {
        _id: department._id,
        name: department.name,
        performance: department.performance
      },
      budget: {
        allocated: department.budget,
        spent: department.actualSpending,
        utilization: department.budgetUtilization,
        remaining: department.budget - department.actualSpending
      },
      employees: {
        total: department.employeeCount,
        capacity: department.maxCapacity,
        utilization: department.capacityUtilization
      },
      projects: {
        active: department.activeProjects,
        completed: department.completedProjects,
        total: department.totalProjects
      },
      kpis: department.kpis || [],
      performanceHistory: department.performanceHistory || [],
      objectives: department.objectives || []
    };

    console.log(`Generated performance data for ${department.name} department`);
    res.status(200).json(performanceData);
  } catch (error) {
    console.error('Error fetching department performance:', error);
    res.status(500).json({ message: 'Server error while fetching department performance' });
  }
};

// Update department performance
exports.updateDepartmentPerformance = async (req, res) => {
  try {
    const departmentId = req.params.id;
    const { performance, period, kpis, objectives } = req.body;

    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Update performance score
    if (performance !== undefined) {
      await department.updatePerformance(performance, period);
    }

    // Update KPIs if provided
    if (kpis) {
      department.kpis = kpis;
    }

    // Update objectives if provided
    if (objectives) {
      department.objectives = objectives;
    }

    department.updatedBy = req.user._id;
    await department.save();

    console.log(`Updated performance for ${department.name} department`);
    res.status(200).json({
      message: 'Department performance updated successfully',
      department: {
        name: department.name,
        performance: department.performance
      }
    });
  } catch (error) {
    console.error('Error updating department performance:', error);
    res.status(500).json({ message: 'Server error while updating department performance' });
  }
};

// Search departments
exports.searchDepartments = async (req, res) => {
  try {
    const { query, status, minBudget, maxBudget, location } = req.query;
    
    let searchCriteria = {};

    // Text search across name, description, head, location
    if (query) {
      searchCriteria.$or = [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { departmentHead: { $regex: query, $options: 'i' } },
        { location: { $regex: query, $options: 'i' } },
        { departmentCode: { $regex: query, $options: 'i' } }
      ];
    }

    // Filter by status
    if (status) {
      searchCriteria.status = status;
    }

    // Filter by budget range
    if (minBudget || maxBudget) {
      searchCriteria.budget = {};
      if (minBudget) searchCriteria.budget.$gte = parseFloat(minBudget);
      if (maxBudget) searchCriteria.budget.$lte = parseFloat(maxBudget);
    }

    // Filter by location
    if (location) {
      searchCriteria.location = { $regex: location, $options: 'i' };
    }

    const departments = await Department.find(searchCriteria)
      .populate('headEmployeeId', 'firstName lastName email')
      .sort({ createdAt: -1 });

    console.log(`Search returned ${departments.length} departments`);
    res.status(200).json(departments);
  } catch (error) {
    console.error('Error searching departments:', error);
    res.status(500).json({ message: 'Server error while searching departments' });
  }
};

// Get department statistics
exports.getDepartmentStats = async (req, res) => {
  try {
    const totalDepartments = await Department.countDocuments();
    const activeDepartments = await Department.countDocuments({ status: 'active' });
    const inactiveDepartments = await Department.countDocuments({ status: 'inactive' });
    const restructuringDepartments = await Department.countDocuments({ status: 'restructuring' });

    // Total budget and spending
    const budgetStats = await Department.aggregate([
      {
        $group: {
          _id: null,
          totalBudget: { $sum: '$budget' },
          totalSpending: { $sum: '$actualSpending' },
          avgBudget: { $avg: '$budget' },
          maxBudget: { $max: '$budget' },
          minBudget: { $min: '$budget' }
        }
      }
    ]);

    // Employee distribution
    const employeeStats = await Department.aggregate([
      {
        $group: {
          _id: null,
          totalEmployees: { $sum: '$employeeCount' },
          avgEmployeesPerDept: { $avg: '$employeeCount' },
          maxEmployees: { $max: '$employeeCount' },
          totalCapacity: { $sum: '$maxCapacity' }
        }
      }
    ]);

    // Performance distribution
    const performanceStats = await Department.aggregate([
      {
        $group: {
          _id: null,
          avgPerformance: { $avg: '$performance' },
          maxPerformance: { $max: '$performance' },
          minPerformance: { $min: '$performance' }
        }
      }
    ]);

    // Department sizes (by employee count)
    const sizeDistribution = await Department.aggregate([
      {
        $bucket: {
          groupBy: '$employeeCount',
          boundaries: [0, 10, 25, 50, 100, 1000],
          default: 'Other',
          output: {
            count: { $sum: 1 },
            departments: { $push: '$name' }
          }
        }
      }
    ]);

    // Recent departments (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentDepartments = await Department.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    const stats = {
      overview: {
        total: totalDepartments,
        active: activeDepartments,
        inactive: inactiveDepartments,
        restructuring: restructuringDepartments,
        recentlyAdded: recentDepartments
      },
      budget: budgetStats[0] || {
        totalBudget: 0,
        totalSpending: 0,
        avgBudget: 0,
        maxBudget: 0,
        minBudget: 0
      },
      employees: employeeStats[0] || {
        totalEmployees: 0,
        avgEmployeesPerDept: 0,
        maxEmployees: 0,
        totalCapacity: 0
      },
      performance: performanceStats[0] || {
        avgPerformance: 0,
        maxPerformance: 0,
        minPerformance: 0
      },
      sizeDistribution
    };

    console.log('Generated department statistics');
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error generating department stats:', error);
    res.status(500).json({ message: 'Server error while generating statistics' });
  }
};

// Bulk operations
exports.bulkUpdateDepartments = async (req, res) => {
  try {
    const { departmentIds, updateData } = req.body;

    if (!departmentIds || !Array.isArray(departmentIds) || departmentIds.length === 0) {
      return res.status(400).json({ message: 'Department IDs array is required' });
    }

    // Remove sensitive fields
    delete updateData.departmentCode;
    delete updateData.employees;
    delete updateData._id;

    updateData.updatedAt = new Date();
    updateData.updatedBy = req.user._id;

    const result = await Department.updateMany(
      { _id: { $in: departmentIds } },
      updateData
    );

    console.log(`Bulk updated ${result.modifiedCount} departments`);
    res.status(200).json({
      message: `Successfully updated ${result.modifiedCount} departments`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(500).json({ message: 'Server error during bulk update' });
  }
};

// Export departments data
exports.exportDepartments = async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    const departments = await Department.find()
      .populate('headEmployeeId', 'firstName lastName email')
      .sort({ name: 1 });

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = [
        'Name', 'Code', 'Description', 'Department Head', 'Head Email', 
        'Location', 'Budget', 'Actual Spending', 'Employee Count', 'Status', 
        'Performance', 'Established Date'
      ].join(',');

      const csvData = departments.map(dept => [
        dept.name || '',
        dept.departmentCode || '',
        (dept.description || '').replace(/,/g, ';'), // Replace commas to avoid CSV issues
        dept.departmentHead || '',
        dept.headEmail || '',
        dept.location || '',
        dept.budget || 0,
        dept.actualSpending || 0,
        dept.employeeCount || 0,
        dept.status || '',
        dept.performance || 0,
        dept.establishedDate ? dept.establishedDate.toISOString().split('T')[0] : ''
      ].join(',')).join('\n');

      const csv = `${csvHeaders}\n${csvData}`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=departments.csv');
      res.status(200).send(csv);
    } else {
      // Return JSON format
      res.status(200).json(departments);
    }

    console.log(`Exported ${departments.length} departments in ${format} format`);
  } catch (error) {
    console.error('Error exporting departments:', error);
    res.status(500).json({ message: 'Server error while exporting departments' });
  }
};