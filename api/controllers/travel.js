const express = require("express");
const mongoose = require('mongoose');
const { body, validationResult } = require("express-validator");
const TravelRequest = require("../../models/travel");
const { protect }=require("../../api/middleware/authMiddleware");
const { sendNotifications } = require('../../api/services/notificationService');
const User = require("../../models/user");
const Notification = require("../../models/notification");
const { format } = require('date-fns');



const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);




// @desc    Get travel expense analytics data for charts
// @route   GET /api/travel-requests/analytics
// @access  Private
exports.getTravelExpenseAnalytics = async (req, res) => {
  try {
    console.log('Request User:', req.query); 
    const {
      period = 'monthly',
      start_date = '2024-01-01',
      end_date = '2024-12-31',
      department_id,
      expense_type,
      travel_type
    } = req.query;

    console.log('Processing with:', { period, start_date, end_date });

    const userId = req.user._id;
    const userRole = req.user.role;

    // Build match criteria based on user role and filters
    let matchCriteria = {
      createdAt: {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      },
      status: { $in: ['approved', 'travel_completed', 'pending_reconciliation'] }
    };

    // Add user-based filtering (employees see only their data, admins see all)
    if (userRole !== 'admin' && userRole !== 'finance' && userRole !== 'procurement_officer') {
      matchCriteria.employee = userId;
    }

    // Add optional filters
    if (department_id) {
      matchCriteria['employee.department'] = department_id;
    }
    if (travel_type) {
      matchCriteria.travelType = travel_type;
    }

    // Get time series data
    const timeSeriesData = await getTimeSeriesData(matchCriteria, period);
    
    // Get breakdown data
    const breakdownData = await getBreakdownData(matchCriteria);
    
    // Calculate metrics
    const metrics = await calculateTravelMetrics(matchCriteria, userId, userRole);
    
    // Get metadata
    const metadata = await getTravelMetadata(userId, userRole);

    const response = {
      status: 'success',
      data: {
        travel_expenses: {
          time_series_data: timeSeriesData,
          breakdown_data: breakdownData,
          metrics: metrics,
          metadata: metadata
        }
      },
      meta: {
        pagination: null,
        filters_applied: {
          date_range: {
            start: start_date,
            end: end_date
          },
          departments: department_id ? [department_id] : ['all'],
          expense_types: expense_type ? [expense_type] : ['domestic_travel', 'international_travel', 'accommodation', 'transportation', 'meals']
        },
        cache_ttl: 300,
        generated_at: new Date().toISOString()
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error in getTravelExpenseAnalytics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch travel expense analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Helper function to get metadata
async function getTravelMetadata(userId, userRole) {
  const totalBudget = 1200000; // This should come from your budget system
  
  try {
    const usedBudget = await TravelRequest.aggregate([
      {
        $match: {
          ...(userRole !== 'admin' && userRole !== 'finance' ? { employee: userId } : {}),
          status: { $in: ['approved', 'travel_completed', 'pending_reconciliation'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ['$estimatedCost', 0] } }
        }
      }
    ]);

    const used = usedBudget[0]?.total || 0;

    return {
      currency: 'MWK',
      currency_symbol: 'MWK',
      last_updated: new Date().toISOString(),
      data_period: 'monthly',
      fiscal_year: new Date().getFullYear(),
      total_budget: totalBudget,
      budget_used_percentage: totalBudget > 0 ? Math.round((used / totalBudget * 100) * 10) / 10 : 0
    };
  } catch (error) {
    console.error('Error in getTravelMetadata:', error);
    return {
      currency: 'MWK',
      currency_symbol: 'MWK',
      last_updated: new Date().toISOString(),
      data_period: 'monthly',
      fiscal_year: new Date().getFullYear(),
      total_budget: totalBudget,
      budget_used_percentage: 0
    };
  }
}

// COMPLETE REPLACEMENT FUNCTIONS - Replace these in your travel.js file

// Helper function to get time series data
async function getTimeSeriesData(matchCriteria, period) {
  let dateGrouping;
  let dateFormat;
  
  switch (period) {
    case 'monthly':
      dateGrouping = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
      dateFormat = 'MMM';
      break;
    case 'quarterly':
      dateGrouping = {
        year: { $year: '$createdAt' },
        quarter: {
          $ceil: { $divide: [{ $month: '$createdAt' }, 3] }
        }
      };
      dateFormat = 'Q';
      break;
    case 'yearly':
      dateGrouping = {
        year: { $year: '$createdAt' }
      };
      dateFormat = 'YYYY';
      break;
    default:
      dateGrouping = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
      dateFormat = 'MMM';
  }

  const results = await TravelRequest.aggregate([
    { $match: matchCriteria },
    {
      $addFields: {
        actualCost: {
          $cond: [
            {
              $and: [
                { $ne: ['$reconciliation.totalSpent', null] },
                { $ne: ['$reconciliation.totalSpent', undefined] },
                { $gte: ['$reconciliation.totalSpent', 0] }
              ]
            },
            '$reconciliation.totalSpent',
            {
              $cond: [
                {
                  $and: [
                    { $ne: ['$payment.totalAmount', null] },
                    { $ne: ['$payment.totalAmount', undefined] },
                    { $gte: ['$payment.totalAmount', 0] }
                  ]
                },
                '$payment.totalAmount',
                { $ifNull: ['$estimatedCost', 0] }
              ]
            }
          ]
        }
      }
    },
    {
      $group: {
        _id: dateGrouping,
        revenue: { $sum: '$actualCost' },
        count: { $sum: 1 },
        estimatedTotal: { $sum: { $ifNull: ['$estimatedCost', 0] } },
        maxDate: { $max: '$createdAt' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.quarter': 1 } }
  ]);

  // Transform results and calculate growth
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return results.map((item, index) => {
    let periodLabel;
    if (period === 'monthly') {
      periodLabel = monthNames[item._id.month - 1];
    } else if (period === 'quarterly') {
      periodLabel = `Q${item._id.quarter}`;
    } else {
      periodLabel = item._id.year.toString();
    }

    // Calculate target (90% of estimated for this example)
    const target = item.estimatedTotal * 0.9;
    
    // Calculate growth compared to previous period
    const prevRevenue = index > 0 ? results[index - 1].revenue : item.revenue;
    const growth = prevRevenue > 0 ? ((item.revenue - prevRevenue) / prevRevenue * 100) : 0;

    return {
      period: periodLabel,
      revenue: Math.round(item.revenue || 0),
      target: Math.round(target || 0),
      growth: Math.round(growth * 10) / 10, // Round to 1 decimal
      timestamp: item.maxDate
    };
  });
}

// Helper function to get breakdown data by expense categories
async function getBreakdownData(matchCriteria) {
  const results = await TravelRequest.aggregate([
    { $match: matchCriteria },
    {
      $addFields: {
        actualCost: {
          $cond: [
            {
              $and: [
                { $ne: ['$reconciliation.totalSpent', null] },
                { $ne: ['$reconciliation.totalSpent', undefined] },
                { $gte: ['$reconciliation.totalSpent', 0] }
              ]
            },
            '$reconciliation.totalSpent',
            {
              $cond: [
                {
                  $and: [
                    { $ne: ['$payment.totalAmount', null] },
                    { $ne: ['$payment.totalAmount', undefined] },
                    { $gte: ['$payment.totalAmount', 0] }
                  ]
                },
                '$payment.totalAmount',
                { $ifNull: ['$estimatedCost', 0] }
              ]
            }
          ]
        }
      }
    },
    {
      $group: {
        _id: '$travelType',
        totalAmount: { $sum: '$actualCost' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Also get expense breakdown from payment.expenses if available
  const expenseBreakdown = await TravelRequest.aggregate([
    { $match: matchCriteria },
    { $unwind: { path: '$payment.expenses', preserveNullAndEmptyArrays: true } },
    {
      $match: {
        'payment.expenses': { $ne: null }
      }
    },
    {
      $group: {
        _id: '$payment.expenses.category',
        totalAmount: { $sum: '$payment.expenses.amount' },
        count: { $sum: 1 }
      }
    },
    { $match: { _id: { $ne: null } } }
  ]);

  const totalAmount = results.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  
  // Category mapping for travel types
  const categoryMapping = {
    'local': { name: 'Domestic Travel', color: '#3B82F6' },
    'international': { name: 'International Travel', color: '#10B981' },
    'accommodation': { name: 'Accommodation', color: '#F59E0B' },
    'transportation': { name: 'Transportation', color: '#8B5CF6' },
    'meals': { name: 'Meals & Entertainment', color: '#EF4444' }
  };

  // Combine travel type and expense category data
  let combinedData = results.map(item => {
    const category = categoryMapping[item._id] || { name: item._id, color: '#6B7280' };
    const percentage = totalAmount > 0 ? ((item.totalAmount / totalAmount) * 100) : 0;
    
    return {
      category: category.name,
      value: Math.round(percentage * 10) / 10,
      amount: Math.round(item.totalAmount || 0),
      color: category.color,
      description: `${category.name} expenses`
    };
  });

  // Add expense breakdown data if available
  const expenseTotal = expenseBreakdown.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  if (expenseTotal > 0 && expenseBreakdown.length > 0) {
    const expenseData = expenseBreakdown.map(item => {
      const category = categoryMapping[item._id] || { name: item._id, color: '#6B7280' };
      const percentage = expenseTotal > 0 ? ((item.totalAmount / expenseTotal) * 100) : 0;
      
      return {
        category: category.name,
        value: Math.round(percentage * 10) / 10,
        amount: Math.round(item.totalAmount || 0),
        color: category.color,
        description: `${category.name} expenses`
      };
    });
    
    // Merge or replace with expense data based on your preference
    combinedData = expenseData.length > combinedData.length ? expenseData : combinedData;
  }

  return combinedData.length > 0 ? combinedData : [
    { category: 'Domestic Travel', value: 60, amount: 0, color: '#3B82F6', description: 'Local business trips' },
    { category: 'International Travel', value: 40, amount: 0, color: '#10B981', description: 'International business trips' }
  ];
}

// Helper function to calculate metrics
async function calculateTravelMetrics(matchCriteria, userId, userRole) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  // Current month expenses
  const currentMonthData = await TravelRequest.aggregate([
    {
      $match: {
        ...matchCriteria,
        createdAt: { $gte: currentMonthStart }
      }
    },
    {
      $addFields: {
        actualCost: {
          $cond: [
            {
              $and: [
                { $ne: ['$reconciliation.totalSpent', null] },
                { $ne: ['$reconciliation.totalSpent', undefined] },
                { $gte: ['$reconciliation.totalSpent', 0] }
              ]
            },
            '$reconciliation.totalSpent',
            { $ifNull: ['$estimatedCost', 0] }
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$actualCost' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Previous month expenses
  const previousMonthData = await TravelRequest.aggregate([
    {
      $match: {
        ...matchCriteria,
        createdAt: { 
          $gte: previousMonthStart,
          $lt: currentMonthStart
        }
      }
    },
    {
      $addFields: {
        actualCost: {
          $cond: [
            {
              $and: [
                { $ne: ['$reconciliation.totalSpent', null] },
                { $ne: ['$reconciliation.totalSpent', undefined] },
                { $gte: ['$reconciliation.totalSpent', 0] }
              ]
            },
            '$reconciliation.totalSpent',
            { $ifNull: ['$estimatedCost', 0] }
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$actualCost' }
      }
    }
  ]);

  // Year to date expenses
  const ytdData = await TravelRequest.aggregate([
    {
      $match: {
        ...matchCriteria,
        createdAt: { $gte: yearStart }
      }
    },
    {
      $addFields: {
        actualCost: {
          $cond: [
            {
              $and: [
                { $ne: ['$reconciliation.totalSpent', null] },
                { $ne: ['$reconciliation.totalSpent', undefined] },
                { $gte: ['$reconciliation.totalSpent', 0] }
              ]
            },
            '$reconciliation.totalSpent',
            { $ifNull: ['$estimatedCost', 0] }
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$actualCost' }
      }
    }
  ]);

  const currentTotal = currentMonthData[0]?.total || 0;
  const previousTotal = previousMonthData[0]?.total || 0;
  const ytdTotal = ytdData[0]?.total || 0;

  // Calculate percentage changes
  const currentVsPrevious = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal * 100) : 0;
  const projectedQuarter = currentTotal * 3; // Simple projection

  return {
    current_month: {
      value: Math.round(currentTotal),
      change_percentage: Math.round(currentVsPrevious * 10) / 10,
      change_amount: Math.round(currentTotal - previousTotal),
      trend: currentTotal > previousTotal ? 'up' : 'down'
    },
    previous_month: {
      value: Math.round(previousTotal),
      change_percentage: 8.3, // You can calculate this based on month before previous
      change_amount: Math.round(previousTotal * 0.083),
      trend: 'up'
    },
    year_to_date: {
      value: Math.round(ytdTotal),
      change_percentage: 5.7, // Compare with previous year if you have historical data
      change_amount: Math.round(ytdTotal * 0.057),
      trend: 'up'
    },
    projected_quarter: {
      value: Math.round(projectedQuarter),
      change_percentage: -2.1,
      change_amount: Math.round(projectedQuarter * -0.021),
      trend: 'down'
    }
  };
}

// @desc    Get travel expense breakdown for detailed analysis
// @route   GET /api/travel-requests/breakdown
// @access  Private
exports.getTravelExpenseBreakdown = async (req, res) => {
  try {
    const {
      start_date = '2024-01-01',
      end_date = '2024-12-31',
      group_by = 'category' // 'category', 'department', 'travel_type'
    } = req.query;

    const userId = req.user._id;
    const userRole = req.user.role;

    let matchCriteria = {
      createdAt: {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      },
      status: { $in: ['approved', 'travel_completed', 'pending_reconciliation'] }
    };

    // Add user-based filtering
    if (userRole !== 'admin' && userRole !== 'finance' && userRole !== 'procurement_officer') {
      matchCriteria.employee = userId;
    }

    let groupField;
    switch (group_by) {
      case 'travel_type':
        groupField = '$travelType';
        break;
      case 'department':
        groupField = '$employee.department';
        break;
      case 'status':
        groupField = '$status';
        break;
      default:
        groupField = '$travelType';
    }

    const breakdown = await TravelRequest.aggregate([
      { $match: matchCriteria },
      {
        $lookup: {
          from: 'users',
          localField: 'employee',
          foreignField: '_id',
          as: 'employeeDetails'
        }
      },
      {
        $addFields: {
          actualCost: {
            $cond: [
              {
                $and: [
                  { $ne: ['$reconciliation.totalSpent', null] },
                  { $ne: ['$reconciliation.totalSpent', undefined] },
                  { $gte: ['$reconciliation.totalSpent', 0] }
                ]
              },
              '$reconciliation.totalSpent',
              { $ifNull: ['$estimatedCost', 0] }
            ]
          }
        }
      },
      {
        $group: {
          _id: groupField,
          totalAmount: { $sum: '$actualCost' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$actualCost' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.status(200).json({
      status: 'success',
      data: breakdown
    });
  } catch (error) {
    console.error('Error in getTravelExpenseBreakdown:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch breakdown data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Fixed helper functions for travel analytics

// Helper function to get breakdown data by expense categories
async function getBreakdownData(matchCriteria) {
  const results = await TravelRequest.aggregate([
    { $match: matchCriteria },
    {
      $addFields: {
        actualCost: {
          $cond: [
            {
              $and: [
                { $ne: ['$reconciliation.totalSpent', null] },
                { $ne: ['$reconciliation.totalSpent', undefined] },
                { $gte: ['$reconciliation.totalSpent', 0] }
              ]
            },
            '$reconciliation.totalSpent',
            {
              $cond: [
                {
                  $and: [
                    { $ne: ['$payment.totalAmount', null] },
                    { $ne: ['$payment.totalAmount', undefined] },
                    { $gte: ['$payment.totalAmount', 0] }
                  ]
                },
                '$payment.totalAmount',
                { $ifNull: ['$estimatedCost', 0] }
              ]
            }
          ]
        }
      }
    },
    {
      $group: {
        _id: '$travelType',
        totalAmount: { $sum: '$actualCost' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Also get expense breakdown from payment.expenses if available
  const expenseBreakdown = await TravelRequest.aggregate([
    { $match: matchCriteria },
    { $unwind: { path: '$payment.expenses', preserveNullAndEmptyArrays: true } },
    {
      $match: {
        'payment.expenses': { $ne: null }
      }
    },
    {
      $group: {
        _id: '$payment.expenses.category',
        totalAmount: { $sum: '$payment.expenses.amount' },
        count: { $sum: 1 }
      }
    },
    { $match: { _id: { $ne: null } } }
  ]);

  const totalAmount = results.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  
  // Category mapping for travel types
  const categoryMapping = {
    'local': { name: 'Domestic Travel', color: '#3B82F6' },
    'international': { name: 'International Travel', color: '#10B981' },
    'accommodation': { name: 'Accommodation', color: '#F59E0B' },
    'transportation': { name: 'Transportation', color: '#8B5CF6' },
    'meals': { name: 'Meals & Entertainment', color: '#EF4444' }
  };

  // Combine travel type and expense category data
  let combinedData = results.map(item => {
    const category = categoryMapping[item._id] || { name: item._id || 'Other', color: '#6B7280' };
    const percentage = totalAmount > 0 ? ((item.totalAmount / totalAmount) * 100) : 0;
    
    return {
      category: category.name,
      value: Math.round(percentage * 10) / 10,
      amount: Math.round(item.totalAmount || 0),
      color: category.color,
      description: `${category.name} expenses`
    };
  });

  // Add expense breakdown data if available
  const expenseTotal = expenseBreakdown.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  if (expenseTotal > 0 && expenseBreakdown.length > 0) {
    const expenseData = expenseBreakdown.map(item => {
      const category = categoryMapping[item._id] || { name: item._id || 'Other', color: '#6B7280' };
      const percentage = expenseTotal > 0 ? ((item.totalAmount / expenseTotal) * 100) : 0;
      
      return {
        category: category.name,
        value: Math.round(percentage * 10) / 10,
        amount: Math.round(item.totalAmount || 0),
        color: category.color,
        description: `${category.name} expenses`
      };
    });
    
    // Merge or replace with expense data based on your preference
    combinedData = expenseData.length > combinedData.length ? expenseData : combinedData;
  }

  return combinedData.length > 0 ? combinedData : [
    { category: 'Domestic Travel', value: 60, amount: 0, color: '#3B82F6', description: 'Local business trips' },
    { category: 'International Travel', value: 40, amount: 0, color: '#10B981', description: 'International business trips' }
  ];
}

// Helper function to calculate metrics
async function calculateTravelMetrics(matchCriteria, userId, userRole) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  // Current month expenses
  const currentMonthData = await TravelRequest.aggregate([
    {
      $match: {
        ...matchCriteria,
        createdAt: { $gte: currentMonthStart }
      }
    },
    {
      $addFields: {
        actualCost: {
          $cond: [
            {
              $and: [
                { $ne: ['$reconciliation.totalSpent', null] },
                { $ne: ['$reconciliation.totalSpent', undefined] },
                { $gte: ['$reconciliation.totalSpent', 0] }
              ]
            },
            '$reconciliation.totalSpent',
            { $ifNull: ['$estimatedCost', 0] }
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$actualCost' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Previous month expenses
  const previousMonthData = await TravelRequest.aggregate([
    {
      $match: {
        ...matchCriteria,
        createdAt: { 
          $gte: previousMonthStart,
          $lt: currentMonthStart
        }
      }
    },
    {
      $addFields: {
        actualCost: {
          $cond: [
            {
              $and: [
                { $ne: ['$reconciliation.totalSpent', null] },
                { $ne: ['$reconciliation.totalSpent', undefined] },
                { $gte: ['$reconciliation.totalSpent', 0] }
              ]
            },
            '$reconciliation.totalSpent',
            { $ifNull: ['$estimatedCost', 0] }
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$actualCost' }
      }
    }
  ]);

  // Year to date expenses
  const ytdData = await TravelRequest.aggregate([
    {
      $match: {
        ...matchCriteria,
        createdAt: { $gte: yearStart }
      }
    },
    {
      $addFields: {
        actualCost: {
          $cond: [
            {
              $and: [
                { $ne: ['$reconciliation.totalSpent', null] },
                { $ne: ['$reconciliation.totalSpent', undefined] },
                { $gte: ['$reconciliation.totalSpent', 0] }
              ]
            },
            '$reconciliation.totalSpent',
            { $ifNull: ['$estimatedCost', 0] }
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$actualCost' }
      }
    }
  ]);

  const currentTotal = currentMonthData[0]?.total || 0;
  const previousTotal = previousMonthData[0]?.total || 0;
  const ytdTotal = ytdData[0]?.total || 0;

  // Calculate percentage changes
  const currentVsPrevious = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal * 100) : 0;
  const projectedQuarter = currentTotal * 3; // Simple projection

  return {
    current_month: {
      value: Math.round(currentTotal),
      change_percentage: Math.round(currentVsPrevious * 10) / 10,
      change_amount: Math.round(currentTotal - previousTotal),
      trend: currentTotal > previousTotal ? 'up' : 'down'
    },
    previous_month: {
      value: Math.round(previousTotal),
      change_percentage: 8.3, // You can calculate this based on month before previous
      change_amount: Math.round(previousTotal * 0.083),
      trend: 'up'
    },
    year_to_date: {
      value: Math.round(ytdTotal),
      change_percentage: 5.7, // Compare with previous year if you have historical data
      change_amount: Math.round(ytdTotal * 0.057),
      trend: 'up'
    },
    projected_quarter: {
      value: Math.round(projectedQuarter),
      change_percentage: -2.1,
      change_amount: Math.round(projectedQuarter * -0.021),
      trend: 'down'
    }
  };
}

// Fixed version of getTravelExpenseBreakdown method
exports.getTravelExpenseBreakdown = async (req, res) => {
  try {
    const {
      start_date = '2024-01-01',
      end_date = '2024-12-31',
      group_by = 'category' // 'category', 'department', 'travel_type'
    } = req.query;

    const userId = req.user._id;
    const userRole = req.user.role;

    let matchCriteria = {
      createdAt: {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      },
      status: { $in: ['approved', 'travel_completed', 'pending_reconciliation'] }
    };

    // Add user-based filtering
    if (userRole !== 'admin' && userRole !== 'finance' && userRole !== 'procurement_officer') {
      matchCriteria.employee = userId;
    }

    let groupField;
    switch (group_by) {
      case 'travel_type':
        groupField = '$travelType';
        break;
      case 'department':
        groupField = '$employee.department';
        break;
      case 'status':
        groupField = '$status';
        break;
      default:
        groupField = '$travelType';
    }

    const breakdown = await TravelRequest.aggregate([
      { $match: matchCriteria },
      {
        $lookup: {
          from: 'users',
          localField: 'employee',
          foreignField: '_id',
          as: 'employeeDetails'
        }
      },
      {
        $addFields: {
          actualCost: {
            $cond: [
              {
                $and: [
                  { $ne: ['$reconciliation.totalSpent', null] },
                  { $ne: ['$reconciliation.totalSpent', undefined] },
                  { $gte: ['$reconciliation.totalSpent', 0] }
                ]
              },
              '$reconciliation.totalSpent',
              { $ifNull: ['$estimatedCost', 0] }
            ]
          }
        }
      },
      {
        $group: {
          _id: groupField,
          totalAmount: { $sum: '$actualCost' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$actualCost' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.status(200).json({
      status: 'success',
      data: breakdown
    });
  } catch (error) {
    console.error('Error in getTravelExpenseBreakdown:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch breakdown data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Helper function to calculate metrics
async function calculateTravelMetrics(matchCriteria, userId, userRole) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  // Current month expenses
  const currentMonthData = await TravelRequest.aggregate([
    {
      $match: {
        ...matchCriteria,
        createdAt: { $gte: currentMonthStart }
      }
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ['$reconciliation.totalSpent', null] }, { $ne: ['$reconciliation.totalSpent', undefined] }] },
              '$reconciliation.totalSpent',
              '$estimatedCost'
            ]
          }
        },
        count: { $sum: 1 }
      }
    }
  ]);

  // Previous month expenses
  const previousMonthData = await TravelRequest.aggregate([
    {
      $match: {
        ...matchCriteria,
        createdAt: { 
          $gte: previousMonthStart,
          $lt: currentMonthStart
        }
      }
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ['$reconciliation.totalSpent', null] }, { $ne: ['$reconciliation.totalSpent', undefined] }] },
              '$reconciliation.totalSpent',
              '$estimatedCost'
            ]
          }
        }
      }
    }
  ]);

  // Year to date expenses
  const ytdData = await TravelRequest.aggregate([
    {
      $match: {
        ...matchCriteria,
        createdAt: { $gte: yearStart }
      }
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ['$reconciliation.totalSpent', null] }, { $ne: ['$reconciliation.totalSpent', undefined] }] },
              '$reconciliation.totalSpent',
              '$estimatedCost'
            ]
          }
        }
      }
    }
  ]);

  const currentTotal = currentMonthData[0]?.total || 0;
  const previousTotal = previousMonthData[0]?.total || 0;
  const ytdTotal = ytdData[0]?.total || 0;

  // Calculate percentage changes
  const currentVsPrevious = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal * 100) : 0;
  const projectedQuarter = currentTotal * 3; // Simple projection

  return {
    current_month: {
      value: Math.round(currentTotal),
      change_percentage: Math.round(currentVsPrevious * 10) / 10,
      change_amount: Math.round(currentTotal - previousTotal),
      trend: currentTotal > previousTotal ? 'up' : 'down'
    },
    previous_month: {
      value: Math.round(previousTotal),
      change_percentage: 8.3, // You can calculate this based on month before previous
      change_amount: Math.round(previousTotal * 0.083),
      trend: 'up'
    },
    year_to_date: {
      value: Math.round(ytdTotal),
      change_percentage: 5.7, // Compare with previous year if you have historical data
      change_amount: Math.round(ytdTotal * 0.057),
      trend: 'up'
    },
    projected_quarter: {
      value: Math.round(projectedQuarter),
      change_percentage: -2.1,
      change_amount: Math.round(projectedQuarter * -0.021),
      trend: 'down'
    }
  };
}

// Helper function to get metadata
async function getTravelMetadata(userId, userRole) {
  const totalBudget = 1200000; // This should come from your budget system
  const usedBudget = await TravelRequest.aggregate([
    {
      $match: {
        ...(userRole !== 'admin' && userRole !== 'finance' ? { employee: userId } : {}),
        status: { $in: ['approved', 'travel_completed', 'pending_reconciliation'] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$estimatedCost' }
      }
    }
  ]);

  const used = usedBudget[0]?.total || 0;

  return {
    currency: 'MWK',
    currency_symbol: 'MWK',
    last_updated: new Date().toISOString(),
    data_period: 'monthly',
    fiscal_year: new Date().getFullYear(),
    total_budget: totalBudget,
    budget_used_percentage: totalBudget > 0 ? Math.round((used / totalBudget * 100) * 10) / 10 : 0
  };
}

// @desc    Get travel expense breakdown for detailed analysis
// @route   GET /api/travel-requests/breakdown
// @access  Private
exports.getTravelExpenseBreakdown = async (req, res) => {
  try {
    const {
      start_date = '2024-01-01',
      end_date = '2024-12-31',
      group_by = 'category' // 'category', 'department', 'travel_type'
    } = req.query;

    const userId = req.user._id;
    const userRole = req.user.role;

    let matchCriteria = {
      createdAt: {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      },
      status: { $in: ['approved', 'travel_completed', 'pending_reconciliation'] }
    };

    // Add user-based filtering
    if (userRole !== 'admin' && userRole !== 'finance' && userRole !== 'procurement_officer') {
      matchCriteria.employee = userId;
    }

    let groupField;
    switch (group_by) {
      case 'travel_type':
        groupField = '$travelType';
        break;
      case 'department':
        groupField = '$employee.department';
        break;
      case 'status':
        groupField = '$status';
        break;
      default:
        groupField = '$travelType';
    }

    const breakdown = await TravelRequest.aggregate([
      { $match: matchCriteria },
      {
        $lookup: {
          from: 'users',
          localField: 'employee',
          foreignField: '_id',
          as: 'employeeDetails'
        }
      },
      {
        $group: {
          _id: groupField,
          totalAmount: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ['$reconciliation.totalSpent', null] }, { $ne: ['$reconciliation.totalSpent', undefined] }] },
                '$reconciliation.totalSpent',
                '$estimatedCost'
              ]
            }
          },
          count: { $sum: 1 },
          avgAmount: {
            $avg: {
              $cond: [
                { $and: [{ $ne: ['$reconciliation.totalSpent', null] }, { $ne: ['$reconciliation.totalSpent', undefined] }] },
                '$reconciliation.totalSpent',
                '$estimatedCost'
              ]
            }
          }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.status(200).json({
      status: 'success',
      data: breakdown
    });
  } catch (error) {
    console.error('Error in getTravelExpenseBreakdown:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch breakdown data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Export travel expense data to CSV
// @route   GET /api/travel-requests/export
// @access  Private
exports.exportTravelExpenseData = async (req, res) => {
  try {
    const {
      start_date = '2024-01-01',
      end_date = '2024-12-31',
      format = 'csv'
    } = req.query;

    const userId = req.user._id;
    const userRole = req.user.role;

    let matchCriteria = {
      createdAt: {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      }
    };

    // Add user-based filtering
    if (userRole !== 'admin' && userRole !== 'finance' && userRole !== 'procurement_officer') {
      matchCriteria.employee = userId;
    }

    const travelRequests = await TravelRequest.find(matchCriteria)
      .populate('employee', 'firstName lastName email department')
      .populate('supervisor', 'firstName lastName')
      .populate('finalApprover', 'firstName lastName')
      .sort({ createdAt: -1 });

    if (format === 'csv') {
      // Generate CSV
      const csv = generateCSV(travelRequests);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=travel-expenses.csv');
      res.send(csv);
    } else {
      // Return JSON
      res.status(200).json({
        status: 'success',
        data: travelRequests
      });
    }
  } catch (error) {
    console.error('Error in exportTravelExpenseData:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to export data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Helper function to generate CSV
function generateCSV(travelRequests) {
  const headers = [
    'ID', 'Employee', 'Purpose', 'Travel Type', 'Destination', 'Departure Date', 
    'Return Date', 'Estimated Cost', 'Actual Cost', 'Currency', 'Status', 
    'Supervisor Approval', 'Final Approval', 'Created Date'
  ];

  const rows = travelRequests.map(request => [
    request._id,
    request.employee ? `${request.employee.firstName} ${request.employee.lastName}` : '',
    request.purpose,
    request.travelType,
    request.location || request.destination || '',
    request.departureDate ? new Date(request.departureDate).toISOString().split('T')[0] : '',
    request.returnDate ? new Date(request.returnDate).toISOString().split('T')[0] : '',
    request.estimatedCost || 0,
    request.reconciliation?.totalSpent || request.payment?.totalAmount || 0,
    request.currency || 'MWK',
    request.status,
    request.supervisorApproval || 'pending',
    request.finalApproval || 'pending',
    request.createdAt ? new Date(request.createdAt).toISOString().split('T')[0] : ''
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  return csvContent;
}
/// Create a new travel request (local or international)
exports.travelRequest = async (req, res) => {
    try {
      const { 
        employee, 
        purpose, 
        departureDate, 
        returnDate, 
        location, 
        destination, // Added for international
        fundingCodes, 
        meansOfTravel,
        travelType, // 'local' or 'international'
        currency, // Added for international (e.g., 'ZAR')
        estimatedCost, // Added for budget tracking
        documents = [], // Array of document references
        additionalNotes // Any extra information
      } = req.body;
      console.log(req.body);
  
      // Validate required fields for international travel
      if (travelType === 'international') {
        if (!destination || !currency) {
          return res.status(400).json({ 
            message: "Destination country and currency are required for international travel" 
          });
        }
      }
      if (req.body.documents && Array.isArray(req.body.documents)) {
        req.body.documents = req.body.documents.map(doc => 
          typeof doc === 'object' && doc.url ? doc.url : String(doc)
        );
      }
      
  
      // Calculate duration
      const startDate = new Date(departureDate);
      const endDate = new Date(returnDate);
      const durationInDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  
      // Create a new travel request
      const travelRequest = new TravelRequest({
        employee,
        purpose,
        departureDate,
        returnDate,
        duration: durationInDays, // Calculated field
        location,
        destination: travelType === 'international' ? destination : undefined,
      fundingCodes: fundingCodes,

        meansOfTravel,
        travelType: travelType || 'local', // Default to local if not specified
        currency: travelType === 'international' ? currency : 'MWK',
        estimatedCost,
        documents,
        additionalNotes,
        status: 'pending', // Initial status
        createdAt: new Date()
      });
  
      // Save the travel request to the database
      await travelRequest.save();
  
      // Respond with the created travel request
      res.status(201).json({
        message: "Travel request created successfully",
        travelRequest: {
          ...travelRequest.toObject(),
          duration: `${durationInDays} days` // Formatted duration for response
        }
      });
    } catch (error) {
      console.error("Error creating travel request:", error);
      res.status(500).json({ 
        message: "Server error",
        error: error.message 
      });
    }
  };

// Supervisor approves or rejects a travel request
exports.supervisorApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { supervisorId, decision } = req.body; // decision: "approved" or "rejected"

    // Validate decision
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "Invalid decision. Must be 'approved' or 'rejected'." });
    }

    // Find the travel request
    const travelRequest = await TravelRequest.findById(id);
    if (!travelRequest) {
      return res.status(404).json({ message: "Travel request not found" });
    }

    // Update supervisor approval status
    travelRequest.supervisor = supervisorId;
    travelRequest.supervisorApproval = decision;

    // If rejected, update the overall status
    if (decision === "rejected") {
      travelRequest.status = "rejected";
    }

    await travelRequest.save();

    res.status(200).json(travelRequest);
  } catch (error) {
    console.error("Error updating supervisor approval:", error);
    res.status(500).json({ message: "Server error" });
  }
};



exports.getPendingApprovalsStats = async (req, res) => {
  try {
    console.log("Request User:", req.user); // Debug the entire user object

    if (!req.user?._id) {
      return res.status(401).json({ message: "User not authenticated properly" });
    }

    const userId = req.user._id;
    console.log("User ID from token:", userId);

    // Fetch only pending approvals where user is a supervisor
    const travelRequests = await TravelRequest.find({ 
      employee: userId, // Ensure the user is a supervisor
      status: "pending"
    })
    .populate("employee", "name email")
    .populate("supervisor", "name email")
    .exec();

    // Count pending approvals by type
    const pendingLocal = travelRequests.filter(req => req.travelType === "local").length;
    const pendingInternational = travelRequests.filter(req => req.travelType === "international").length;
    
    res.status(200).json({
      totalPending: pendingLocal + pendingInternational,
      pendingLocal,
      pendingInternational,
      requests: travelRequests
    });
  } catch (error) {
    console.error("Error in getPendingApprovals:", error);
    res.status(500).json({ 
      message: "Server error",
      error: error.message 
    });
  }
};

exports.getPendingReconciliation = async (req, res) => {
  try {
     

      const travelRequests = await TravelRequest.find({ 
         status:  { $in: ["pending_reconciliation", "approved"] },
      })
      .populate("employee", "name email")
      .populate("supervisor", "name email")
      .exec();

      res.status(200).json(travelRequests);
  } catch (error) {
      console.error("Error in getPendingRequests:", error);
      res.status(500).json({ 
          message: "Server error",
          error: error.message 
      });
  }
};

exports.getApprovedReconciliation = async (req, res) => {
  try {
     

      const travelRequests = await TravelRequest.find({ 
         status: "approved", 
      })
      .populate("employee", "name email")
      .populate("supervisor", "name email")
      .exec();

      res.status(200).json(travelRequests);
  } catch (error) {
      console.error("Error in getPendingRequests:", error);
      res.status(500).json({ 
          message: "Server error",
          error: error.message 
      });
  }
};

exports.getPendingRequestsAll = async (req, res) => {
  try {
     

      const travelRequests = await TravelRequest.find({ 
          supervisorApproval: "pending" 
      })
      .populate("employee", "firstName lastName email")
      .populate("supervisor", "name email")
      .exec();

      res.status(200).json(travelRequests);
  } catch (error) {
      console.error("Error in getPendingRequests:", error);
      res.status(500).json({ 
          message: "Server error",
          error: error.message 
      });
  }
};


exports.getFinanceProcessedRequestsUser = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "User not authenticated properly" });
  }
  const userId = req.user._id;
      console.log("User ID from token:", userId);
    const approvedRequests = await TravelRequest.find({
      employee: userId,
      finalApproval: "approved",
      financeStatus: "processed"
    }).populate("employee", "name email department");
    
    res.status(200).json(approvedRequests);
  } catch (error) {
    console.error("Error fetching finance pending requests:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Fetch pending travel requests for the authenticated user
exports.getPendingRequests = async (req, res) => {
  try {
      console.log("Request User:", req.user); // Debug the entire user object
      
      if (!req.user?._id) {
          return res.status(401).json({ message: "User not authenticated properly" });
      }

      const userId = req.user._id;
      console.log("User ID from token:", userId); // Should now show the ID

      const travelRequests = await TravelRequest.find({ 
          employee: userId,
          supervisorApproval: "pending" 
      })
      .populate("employee", "name email")
      .populate("supervisor", "name email")
      .exec();

      res.status(200).json(travelRequests);
  } catch (error) {
      console.error("Error in getPendingRequests:", error);
      res.status(500).json({ 
          message: "Server error",
          error: error.message 
      });
  }
};
// GET all supervisor-approved requests pending final approval
exports.getSupervisorApprovedRequests = async (req, res) => {
  try {
    const supervisorApprovedRequests = await TravelRequest.find({
      supervisorApproval: "approved",
      finalApproval: "pending",
    }).populate("employee", "firstName lastName email"); 

    res.status(200).json(supervisorApprovedRequests);
  } catch (error) {
    console.error("Error fetching supervisor-approved requests:", error);
    res.status(500).json({ message: "Failed to fetch supervisor-approved requests" });
  }
};

// Final approval by admin
exports.finalApproval = async (req, res) => {
  const { id } = req.params;
  const { finalApproverId, decision } = req.body; // decision can be "final approved" or "denied"

  try {
    // Find the travel request by ID
    const travelRequest = await TravelRequest.findById(id);
    if (!travelRequest) {
      return res.status(404).json({ message: "Travel request not found" });
    }

    // Check if the request is already processed
    if (travelRequest.finalApproval !== "pending") {
      return res.status(400).json({ message: "This request has already been processed" });
    }

    // Update the travel request with the final decision
    travelRequest.finalApproval = decision;
    travelRequest.finalApprover = finalApproverId;
    travelRequest.finalApprovalDate = new Date();

    // Save the updated travel request
    await travelRequest.save();

    // If approved, forward to Finance (you can add additional logic here)
    if (decision === "final approved") {
      // Example: Trigger a notification or update Finance records
      console.log("Travel request forwarded to Finance for per diem processing");
    }

    res.status(200).json({ message: `Travel request ${decision} successfully` });
  } catch (error) {
    console.error("Error updating final approval:", error);
    res.status(500).json({ message: "Failed to update travel request" });
  }
};

// Assign a driver to a travel request (PO/admin only)
exports.assignDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({ message: 'Driver ID is required' });
    }

    let travelRequest = await TravelRequest.findById(id);
    if (!travelRequest) {
      return res.status(404).json({ message: 'Travel request not found' });
    }

    if (travelRequest.finalApproval !== 'approved') {
      return res.status(400).json({ 
        message: 'Cannot assign driver to a request that is not finally approved' 
      });
    }

    if (travelRequest.assignedDriver) {
      return res.status(400).json({ 
        message: 'This travel request already has an assigned driver',
        currentDriver: travelRequest.assignedDriver
      });
    }

    travelRequest.assignedDriver = driverId;
    await travelRequest.save();

    // Populate driver and employee before sending back
    travelRequest = await TravelRequest.findById(id)
      .populate("employee", "name email department")
      .populate("assignedDriver", "name phone location");

    res.status(200).json({
      message: 'Driver assigned successfully',
      travelRequest
    });

  } catch (error) {
    console.error('Error assigning driver:', error);
    res.status(500).json({ 
      message: 'Server error while assigning driver',
      error: error.message 
    });
  }
};


// GET all finally approved requests ready for finance processing
exports.getFinancePendingRequests = async (req, res) => {
  try {
    const approvedRequests = await TravelRequest.find({
      finalApproval: "approved",
      financeStatus:  { $in: ["pending", "processed"] },
    }).populate("employee", "firstName lastName email phoneNumber role ")
    .populate("assignedDriver", "firstName lastName email phoneNumber");
    res.status(200).json(approvedRequests);
  } catch (error) { 
    console.error("Error fetching finance pending requests:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/travel-requests/:id
exports.getTravelRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await TravelRequest.findById(id)
      .populate("employee", "fistName email lastName phoneNumber role")
      .populate("assignedDriver", "firstName phoneNumber lastName email role");

    if (!request) {
      return res.status(404).json({ message: "Travel request not found" });
    }

    res.status(200).json(request);
  } catch (error) {
    console.error("Error fetching travel request:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// GET all finally approved requests ready for finance processing
exports.getFinanceProcessedRequests = async (req, res) => {
  try {
    const approvedRequests = await TravelRequest.find({
      finalApproval: "approved",
      financeStatus: "processed"
    }).populate("employee", "name email department");
    
    res.status(200).json(approvedRequests);
  } catch (error) {
    console.error("Error fetching finance pending requests:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Finance processing endpoint
exports.financeProcess = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, currency, processingFee, totalAmount, transferDate } = req.body;
    
    // Validate required fields
    if (!amount || !currency || !totalAmount) {
      return res.status(400).json({ 
        message: "Missing required fields: amount, currency, and totalAmount are required" 
      });
    }

    // Validate currency format (example: must be 3 letters)
    if (typeof currency !== 'string' || currency.length !== 3) {
      return res.status(400).json({ 
        message: "Invalid currency format. Must be 3-letter currency code (e.g., USD, EUR)" 
      });
    }

    const travelRequest = await TravelRequest.findById(id);
    if (!travelRequest) {
      return res.status(404).json({ message: "Travel request not found" });
    }

    if (travelRequest.finalApproval !== "approved") {
      return res.status(400).json({ message: "Request not finally approved" });
    }

    // Temporary workaround for fleetNotification validation issue
    // This assumes you want to keep the existing fleetNotification data
    const fleetNotification = travelRequest.fleetNotification || {};
    
    // Create or update payment object with all details
    const payment = {
      ...travelRequest.payment, // Keep existing payment data if any
      processedBy: req.user._id,
      processedAt: new Date(),
      perDiemAmount: amount,
      totalAmount: totalAmount,
      processingFee: processingFee || 0,
      transferDate: transferDate ? new Date(transferDate) : new Date(),
      paymentMethod: "bank transfer",
      currency: currency
    };

    // Update the travel request
    const updatedRequest = await TravelRequest.findByIdAndUpdate(
      id,
      {
        $set: {
          payment: payment,
          financeStatus: "processed",
          currency: currency,
          fleetNotification: fleetNotification // Preserve existing fleetNotification
        }
      },
      { new: true, runValidators: false } // Temporarily disable validators
    );

    console.log(`Processed payment of ${amount} ${currency} for ${travelRequest.employee._id}`);

    res.status(200).json({
      message: "Finance processing completed",
      perDiemAmount: amount,
      travelRequest: updatedRequest
    });
  } catch (error) {
    console.error("Error in finance processing:", error);
    res.status(500).json({ 
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Travel Execution - Mark as completed
exports.completeTravel = async (req, res) => {
  try {
    const { id } = req.params;
    const travelRequest = await TravelRequest.findByIdAndUpdate(
      id,
      { 
        status: 'travel_completed',
        actualReturnDate: new Date() 
      },
      { new: true }
    );
    res.status(200).json(travelRequest);
  } catch (error) {
    res.status(500).json({ message: 'Error completing travel', error });
  }
};

// Submit Reconciliation
exports.submitReconciliation = [
  body('expenses').isArray(),
  body('expenses.*.category').isString(),
  body('expenses.*.amount').isNumeric(),
  body('expenses.*.description').optional().isString(),
  body('additionalNotes').optional().isString(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { expenses, additionalNotes } = req.body;

      const travelRequest = await TravelRequest.findByIdAndUpdate(
        id,
        { 
          reconciliation: {
            submittedBy: req.user.id,
            submittedAt: new Date(),
            expenses,
            additionalNotes,
            status: 'pending_supervisor'
          },
          status: 'reconciliation_pending'
        },
        { new: true }
      );

      res.status(200).json(travelRequest);
    } catch (error) {
      res.status(500).json({ message: 'Error submitting reconciliation', error });
    }
  }
];

// Supervisor Approve Reconciliation
exports.approveReconciliation = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalComments } = req.body;

    const travelRequest = await TravelRequest.findByIdAndUpdate(
      id,
      { 
        'reconciliation.status': 'pending_finance',
        'reconciliation.supervisorApproval': {
          approvedBy: req.user.id,
          approvedAt: new Date(),
          comments: approvalComments
        },
        status: 'reconciliation_supervisor_approved'
      },
      { new: true }
    );

    res.status(200).json(travelRequest);
  } catch (error) {
    res.status(500).json({ message: 'Error approving reconciliation', error });
  }
};

// Finance Final Review
exports.financeReview = [
  body('action').isIn(['approve', 'reject', 'request_changes']),
  body('comments').optional().isString(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { action, comments } = req.body;

      let update = {
        'reconciliation.financeReview': {
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
          action,
          comments
        }
      };

      if (action === 'approve') {
        update.status = 'completed';
        update['reconciliation.status'] = 'approved';
      } else if (action === 'reject') {
        update.status = 'reconciliation_rejected';
        update['reconciliation.status'] = 'rejected';
      } else {
        update.status = 'reconciliation_changes_requested';
        update['reconciliation.status'] = 'changes_requested';
      }

      const travelRequest = await TravelRequest.findByIdAndUpdate(
        id,
        update,
        { new: true }
      );

      res.status(200).json(travelRequest);
    } catch (error) {
      res.status(500).json({ message: 'Error processing finance review', error });
    }
  }
];

// Get travel requests needing reconciliation (for employee)
exports.getReconcilePendingRequests = async (req, res) => {
  try {
    const requests = await TravelRequest.find({
      employee: req.params.employeeId,
      status: 'travel_completed',
      $or: [
        { reconciliation: { $exists: false } },
        { 'reconciliation.status': 'changes_requested' }
      ]
    }).populate('finalApprover', 'name');
    
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Submit reconciliation with expenses
exports.submitReconciliationWithExpenses = [
  body('expenses').isArray(),
  body('expenses.*.category').isString(),
  body('expenses.*.amount').isNumeric().toFloat(),
  body('expenses.*.description').optional().isString(),
  body('expenses.*.receipt').optional().isString(),
  body('tripReport').optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { expenses, tripReport } = req.body;
      const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

      const updated = await TravelRequest.findByIdAndUpdate(
        req.params.id,
        {
          reconciliation: {
            submittedAt: new Date(),
            expenses,
            totalExpenses,
            tripReport,
            status: 'pending_supervisor'
          },
          status: 'reconciliation_pending'
        },
        { new: true }
      );

      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
];


exports.saveExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, amount, description } = req.body;

    // Validate input
    if (!category || !amount || !description) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const updatedRequest = await TravelRequest.findByIdAndUpdate(
      id,
      {
        $push: {
          'payment.expenses': {
            category,
            amount: Number(amount),
            description
          }
        }
      },
      { new: true }
    );

    if (!updatedRequest) {
      return res.status(404).json({ message: 'Travel request not found' });
    }

    res.json(updatedRequest);
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get reconciliation status
exports.getReconciliationStatus = async (req, res) => {
  try {
    const request = await TravelRequest.findById(req.params.id)
      .populate('reconciliation.reviewedBy', 'name')
      .populate('reconciliation.supervisorApproval.approvedBy', 'name');
      
    if (!request) {
      return res.status(404).json({ message: 'Travel request not found' });
    }

    res.json({
      status: request.reconciliation?.status || 'not_submitted',
      details: request.reconciliation
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get processed travel requests for employee
exports.getEmployeeProcessedRequests = async (req, res) => {
  try {
    const { id } = req.params;

    // Find travel requests that:
    // 1. Belong to the current user
    // 2. Have been processed by finance
    // 3. Either have no reconciliation or need changes
    const requests = await TravelRequest.find({
      employee: req.user.id,
      financeStatus: 'processed',
      $or: [
        { reconciliation: { $exists: false } },
        { 'reconciliation.status': 'changes_requested' }
      ]
    })
    .populate('employee', 'name email')
    .populate('finalApprover', 'name')
    .sort({ returnDate: -1 });

    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching processed travel requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Dashboard overview
exports.getDashboardOverview = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get total trips count
    const totalTrips = await TravelRequest.countDocuments({ employee: userId });
    
    // Get pending approvals count
    const pendingApprovals = await TravelRequest.countDocuments({ 
      employee: userId,
      $or: [
        { supervisorApproval: "pending" },
        { finalApproval: "pending" }
      ]
    });
    
    // Get upcoming trips count (trips with departure date in future)
    const upcomingTrips = await TravelRequest.countDocuments({
      employee: userId,
      departureDate: { $gte: new Date() }
    });
    
    // Calculate budget used (this would depend on your business logic)
    const budgetUsed = await TravelRequest.aggregate([
      { $match: { employee: userId } },
      { $group: { _id: null, total: { $sum: "$estimatedCost" } } }
    ]);
    
    res.status(200).json({
      totalTrips,
      pendingApprovals,
      upcomingTrips,
      budgetUsed: budgetUsed.length > 0 ? budgetUsed[0].total : 0,
      nextTrip: await getNextTrip(userId)
    });
  } catch (error) {
    console.error("Error fetching dashboard overview:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get travel history by month (last 6 months)
    const travelHistory = await getTravelHistory(userId);
    
    // Get travel by type (local/international)
    const travelByType = await getTravelByType(userId);
    
    // Get top destinations
    const topDestinations = await getTopDestinations(userId);
    
    // Get expense breakdown
    const expenseBreakdown = await getExpenseBreakdown(userId);
    
    res.status(200).json({
      travelHistory,
      travelByType,
      topDestinations,
      expenseBreakdown
    });
  } catch (error) {
    console.error("Error fetching travel stats:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Dashboard quick links
exports.getDashboardQuickLinks = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const pendingReports = await TravelRequest.countDocuments({
      employee: userId,
      status: "travel_completed",
      "reconciliation.status": { $exists: false }
    });
    
    const expiringDocuments = 2; // This would come from your documents service
    
    res.status(200).json({
      totalRequests: await TravelRequest.countDocuments({ employee: userId }),
      pendingReports,
      expiringDocuments
    });
  } catch (error) {
    console.error("Error fetching quick links data:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get upcoming trips
exports.getUpcomingTrips = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const upcomingTrips = await TravelRequest.find({
      employee: userId,
      departureDate: { $gte: new Date() }
    })
    .sort({ departureDate: 1 })
    .limit(5);
    
    res.status(200).json(upcomingTrips);
  } catch (error) {
    console.error("Error fetching upcoming trips:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get recent travel requests
exports.getRecentRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const recentRequests = await TravelRequest.find({ employee: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("supervisor finalApprover", "name");
    
    res.status(200).json(recentRequests);
  } catch (error) {
    console.error("Error fetching recent requests:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Helper functions
async function getNextTrip(userId) {
  const nextTrip = await TravelRequest.findOne({
    employee: userId,
    departureDate: { $gte: new Date() }
  })
  .sort({ departureDate: 1 })
  .limit(1);
  
  return nextTrip ? {
    destination: nextTrip.location,
    date: nextTrip.departureDate
  } : null;
}

async function getTravelHistory(userId) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const results = await TravelRequest.aggregate([
    { 
      $match: { 
        employee: userId,
        departureDate: { $gte: sixMonthsAgo }
      } 
    },
    {
      $group: {
        _id: {
          month: { $month: "$departureDate" },
          year: { $year: "$departureDate" },
          isInternational: { $cond: [{ $eq: ["$travelType", "international"] }, true, false] }
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: {
          month: "$_id.month",
          year: "$_id.year"
        },
        trips: {
          $push: {
            isInternational: "$_id.isInternational",
            count: "$count"
          }
        }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);
  
  // Format the data for the frontend chart
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formattedData = results.map(item => {
    const monthData = {
      name: monthNames[item._id.month - 1],
      local: 0,
      international: 0
    };
    
    item.trips.forEach(trip => {
      if (trip.isInternational) {
        monthData.international = trip.count;
      } else {
        monthData.local = trip.count;
      }
    });
    
    return monthData;
  });
  
  return formattedData.slice(-6); // Return last 6 months
}

async function getTravelByType(userId) {
  const results = await TravelRequest.aggregate([
    { $match: { employee: userId } },
    {
      $group: {
        _id: "$travelType",
        count: { $sum: 1 }
      }
    }
  ]);
  
  const totalTrips = results.reduce((sum, item) => sum + item.count, 0);
  
  return {
    local: {
      count: results.find(item => item._id === "local")?.count || 0,
      percentage: Math.round(((results.find(item => item._id === "local")?.count || 0) / totalTrips * 100)
    )},
    international: {
      count: results.find(item => item._id === "international")?.count || 0,
      percentage: Math.round(((results.find(item => item._id === "international")?.count || 0) / totalTrips * 100)
    )
    }
  };
}

async function getTopDestinations(userId, limit = 3) {
  return await TravelRequest.aggregate([
    { $match: { employee: userId } },
    {
      $group: {
        _id: "$location",
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
}

async function getExpenseBreakdown(userId) {
  // This would depend on your expense tracking implementation
  // Here's a sample structure
  return {
    flights: {
      amount: 2450,
      percentage: 56.7
    },
    accommodation: {
      amount: 1200,
      percentage: 27.8
    },
    transport: {
      amount: 420,
      percentage: 9.7
    },
    meals: {
      amount: 250,
      percentage: 5.8
    },
    total: 4320
  };
}


// @desc    Send notifications to relevant parties about travel arrangements
// @route   POST /api/travel-requests/:id/send-notifications
// @access  Private (PO/admin)
exports.sendTravelNotifications = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      recipients,
      subject,
      message,
      includeItinerary
    } = req.body;

    // Validate input
    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ message: 'At least one recipient is required' });
    }
    if (!subject || !message) {
      return res.status(400).json({ message: 'Subject and message are required' });
    }

    // Find and update the travel request
    const travelRequest = await TravelRequest.findByIdAndUpdate(
      id,
      {
        $set: {
          'fleetNotification.sent': true,
          'fleetNotification.sentAt': new Date(),
          'fleetNotification.recipients': recipients,
          'fleetNotification.subject': subject,
          'fleetNotification.message': message,
          'fleetNotification.includeItinerary': includeItinerary,
          'fleetNotification.sentBy': req.user.id,
        }
      },
      { new: true }
    ).populate('employee', 'firstName email phoneNumber')
     .populate('assignedDriver', 'firstName email phoneNumber');

    if (!travelRequest) {
      return res.status(404).json({ message: 'Travel request not found' });
    }

    // Validate recipient IDs are valid ObjectIds
    const validRecipients = recipients.filter(recipientId => 
      mongoose.Types.ObjectId.isValid(recipientId)
    );

    if (validRecipients.length === 0) {
      return res.status(400).json({ message: 'No valid recipient IDs provided' });
    }

    // Send notifications to all valid recipients
    const notificationPromises = validRecipients.map(async recipientId => {
      try {
        const user = await User.findById(recipientId);
        if (user) {
          await sendNotifications(
            recipientId,
            subject,
            message
          );
        }
      } catch (error) {
        console.error(`Error sending notification to user ${recipientId}:`, error);
      }
    });

    await Promise.all(notificationPromises);

    res.status(200).json({
      success: true,
      message: 'Fleet notifications sent successfully',
      data: {
        fleetNotification: travelRequest.fleetNotification,
        travelRequestStatus: travelRequest.status
      }
    });

  } catch (error) {
    console.error('Error sending fleet notifications:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while sending fleet notifications',
      error: error.message 
    });
  }   
};


// @desc    Submit travel reconciliation
// @route   POST /api/travel-requests/:id/reconcile
// @access  Private
exports.submitReconciliation = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate the ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        message: "Invalid travel request ID" 
      });
    }

    const { 
      totalSpent, 
      remainingBalance, 
      additionalNotes,
      returnDate,       // Add this from req.body
      tripReport        // Add this from req.body
    } = req.body;

    // Validate input
    if (typeof totalSpent !== 'number' || typeof remainingBalance !== 'number') {
      return res.status(400).json({ 
        message: "totalSpent and remainingBalance must be numbers" 
      });
    }

    // Validate returnDate if provided
    if (returnDate && isNaN(new Date(returnDate).getTime())) {
      return res.status(400).json({
        message: "Invalid return date format"
      });
    }

    // Prepare update object
    const updateData = {
      status: 'pending_reconciliation', // Update the main status
      reconciled: true,                 // Mark as reconciled
      reconciliation: {
        submittedDate: new Date(),
        approvedDate: null,
        approvedBy: null,
        totalSpent,
        remainingBalance,
        status: "pending_reconciliation",
        notes: additionalNotes,
        submittedBy: req.user._id,
        actualReturnDate: returnDate ? new Date(returnDate) : undefined,
        tripReport
      },
      $push: {  // Optionally add to payment.expenses if needed
        'payment.expenses': req.body.expenses || []
      }
    };

    // Find and update the travel request
    const travelRequest = await TravelRequest.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('employee', 'name email')
     .populate('reconciliation.submittedBy', 'name email');

    if (!travelRequest) {
      return res.status(404).json({ message: "Travel request not found" });
    }

    res.status(200).json({
      message: "Reconciliation submitted successfully",
      travelRequest
    });

  } catch (error) {
    console.error("Error submitting reconciliation:", error);
    res.status(500).json({ 
      message: "Server error",
      error: error.message 
    });
  }
};

// In your reconciliation controller file
exports.processReconciliation = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate the ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        message: "Invalid travel request ID" 
      });
    }

    const { 
      decision, // "approve" or "reject"
      internalNotes,
      expenseNotes,
      reimbursementMethod,
      reimbursementAmount,
      reimbursementCurrency,
      reimbursementDate
    } = req.body;

    // Validate input
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ 
        message: "Decision must be either 'approve' or 'reject'" 
      });
    }

    // Prepare base update object
    const updateData = {
      status: decision === 'approve' ? 'approved' : 'rejected',
      'reconciliation.status': decision === 'approve' ? 'approved' : 'rejected',
      'reconciliation.approvedDate': new Date(),
      'reconciliation.approvedBy': req.user._id,
      'reconciliation.notes': internalNotes,
      reconciled: decision === 'approve',
    };

    // Add reimbursement details if applicable
    if (decision === 'approve' && reimbursementMethod !== 'n/a') {
      updateData['reconciliation.reimbursementDetails'] = {
        method: reimbursementMethod,
        amount: reimbursementAmount,
        currency: reimbursementCurrency,
        processedDate: new Date(reimbursementDate)
      };
    }

    // Initialize options without arrayFilters
    const options = { new: true };

    // Only add expense updates if expenseNotes exist
    if (expenseNotes && typeof expenseNotes === 'object' && Object.keys(expenseNotes).length > 0) {
      const expenseUpdates = {};
      Object.entries(expenseNotes).forEach(([expenseId, note]) => {
        expenseUpdates[`payment.expenses.$[elem].status`] = decision === 'approve' ? 'approved' : 'rejected';
        expenseUpdates[`payment.expenses.$[elem].notes`] = note;
      });

      // Add expense updates to the main update operation
      updateData['payment.expenses'] = {
        $each: [],
        $position: 0
      };
      Object.assign(updateData, expenseUpdates);

      // Add arrayFilters only when we're actually using them
      options.arrayFilters = [{ 'elem._id': { $in: Object.keys(expenseNotes) } }];
    }

    // Find and update the travel request
    const travelRequest = await TravelRequest.findByIdAndUpdate(
      id,
      { $set: updateData },
      options
    ).populate('employee', 'name email')
     .populate('reconciliation.approvedBy', 'name');

    if (!travelRequest) {
      return res.status(404).json({ message: "Travel request not found" });
    }

    res.status(200).json({
      message: `Reconciliation ${decision === 'approve' ? 'approved' : 'rejected'} successfully`,
      travelRequest
    });

  } catch (error) {
    console.error("Error processing reconciliation:", error);
    res.status(500).json({ 
      message: "Server error",
      error: error.message 
    });
  }
};


exports.sendTravelNotification = async (req, res) => {
  console.log(req.body);
  console.log(req.params);
  try {
    const { id } = req.params;
    const { 
      recipient, 
      subject, 
      message, 
      includeBreakdown, 
      sendCopy,
      amount,
      currency 
    } = req.body;

    // Validate required fields
    if (!recipient || !subject || !message) {
      return res.status(400).json({ 
        message: "Recipient, subject, and message are required"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient)) {
      return res.status(400).json({ 
        message: "Invalid recipient email format"
      });
    }

    const travelRequest = await TravelRequest.findById(id).populate('employee');
    if (!travelRequest) {
      return res.status(404).json({ message: "Travel request not found" });
    }

    if (!process.env.SENDGRID_API_KEY) {
      return res.status(500).json({ 
        message: "Email service not configured properly"
      });
    }

    // Prepare email content with proper validation
    const emailContent = {
      to: recipient.trim(),
      from: {
        name: 'NexusMWI Finance',
        email: process.env.SENDGRID_FROM_EMAIL || 'finance@nexusmwi.com'
      },
      subject: subject.substring(0, 78), // Truncate to 78 chars (SendGrid limit)
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <h2 style="color: #333;">${subject.substring(0, 78)}</h2>
          <p>${message.replace(/\n/g, '<br>').substring(0, 10000)}</p>
          ${includeBreakdown ? `
            <div style="margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 8px;">
              <h3 style="margin-top: 0;">Payment Details</h3>
              <p><strong>Amount:</strong> ${formatCurrency(amount, currency)}</p>
              <p><strong>Destination:</strong> ${travelRequest.city}, ${travelRequest.country}</p>
              <p><strong>Travel Dates:</strong> ${format(travelRequest.departureDate, 'MMM d, yyyy')} - ${format(travelRequest.returnDate, 'MMM d, yyyy')}</p>
            </div>
          ` : ''}
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            This is an automated message from NexusMWI Travel System
          </p>
        </div>
      `,
      text: `${subject.substring(0, 78)}\n\n${message.substring(0, 10000)}\n\n` + 
        (includeBreakdown ? 
          `Payment Details:\nAmount: ${formatCurrency(amount, currency)}\n` +
          `Destination: ${travelRequest.city}, ${travelRequest.country}\n` +
          `Travel Dates: ${format(travelRequest.departureDate, 'MMM d, yyyy')} - ${format(travelRequest.returnDate, 'MMM d, yyyy')}\n\n` : '') +
        `This is an automated message from NexusMWI Travel System`
    };

    // Add CC if requested
    if (sendCopy) {
      const financeEmail = process.env.FINANCE_TEAM_EMAIL || 'finance@nexusmwi.com';
      if (emailRegex.test(financeEmail)) {
        emailContent.cc = financeEmail;
      }
    }

    // Debug log before sending
    console.log('Sending email with content:', {
      to: emailContent.to,
      subject: emailContent.subject,
      text_length: emailContent.text?.length,
      html_length: emailContent.html?.length
    });

    // Send email via SendGrid API
    await sgMail.send(emailContent);
    
    // Update travel request status
    travelRequest.financeStatus = "completed";
    travelRequest.transferredAt = new Date();
    await travelRequest.save();

    res.status(200).json({ 
      message: "Travel notification sent successfully"
    });

  } catch (error) {
    console.error("Detailed SendGrid error:", {
      message: error.message,
      code: error.code,
      response: error.response?.body
    });
    
    res.status(500).json({ 
      message: "Failed to send travel notification",
      details: error.response?.body?.errors || error.message
    });
  }
};


function formatCurrency(amount, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}