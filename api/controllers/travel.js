const express = require("express");
const mongoose = require('mongoose');
const { body, validationResult } = require("express-validator");
const TravelRequest = require("../../models/travel");
const { protect }=require("../../api/middleware/authMiddleware");


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
        fundingCodes: fundingCodes || [],
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

exports.getPendingRequestsAll = async (req, res) => {
  try {
     

      const travelRequests = await TravelRequest.find({ 
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
    }).populate("employee", "name"); // Populate employee details if needed

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

    // Validate input
    if (!driverId) {
      return res.status(400).json({ message: 'Driver ID is required' });
    }

    // Find the travel request
    const travelRequest = await TravelRequest.findById(id);
    if (!travelRequest) {
      return res.status(404).json({ message: 'Travel request not found' });
    }

    // Check if the request is approved (optional business rule)
    if (travelRequest.finalApproval !== 'approved') {
      return res.status(400).json({ 
        message: 'Cannot assign driver to a request that is not finally approved' 
      });
    }

    // Check if the request is already assigned to a driver
    if (travelRequest.assignedDriver) {
      return res.status(400).json({ 
        message: 'This travel request already has an assigned driver',
        currentDriver: travelRequest.assignedDriver
      });
    }

    // Update the travel request with the assigned driver
    travelRequest.assignedDriver = driverId;
    await travelRequest.save();

    res.status(200).json({
      message: 'Driver assigned successfully',
      travelRequest: {
        id: travelRequest._id,
        employee: travelRequest.employee,
        assignedDriver: travelRequest.assignedDriver,
        departureDate: travelRequest.departureDate,
        returnDate: travelRequest.returnDate,
        location: travelRequest.location
      }
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
      financeStatus: "pending"
    }).populate("employee", "name email department");
    
    res.status(200).json(approvedRequests);
  } catch (error) {
    console.error("Error fetching finance pending requests:", error);
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
    const { amount, currency, processingFee, totalAmount,perDiemAmount } = req.body;
    console.log(req.body);
    
    const travelRequest = await TravelRequest.findById(id);
    if (!travelRequest) {
      return res.status(404).json({ message: "Travel request not found" });
    }

    if (travelRequest.finalApproval !== "approved") {
      return res.status(400).json({ message: "Request not finally approved" });
    }

    // Create or update payment object with all details
    travelRequest.payment = {
      ...travelRequest.payment, // Keep existing payment data if any
      processedBy: req.user._id,
      processedAt: new Date(),
      perDiemAmount: amount, // Store the per diem amount in payment
      totalAmount: totalAmount,
      paymentMethod: "bank transfer" // or whatever method you're using
    };

    travelRequest.financeStatus = "processed";
    travelRequest.currency = currency; // Make sure currency is saved
    
    await travelRequest.save();

    console.log(`Processed payment of $${amount} ${currency} for ${travelRequest.employee._id}`);

    res.status(200).json({
      message: "Finance processing completed",
      perDiemAmount: amount,
      travelRequest
    });
  } catch (error) {
    console.error("Error in finance processing:", error);
    res.status(500).json({ message: "Server error" });
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
// @route   POST /api/v1/travel-requests/:id/send-notifications
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
    ).populate('employee', 'name email')
     .populate('assignedDriver', 'name email phone');

    if (!travelRequest) {
      return res.status(404).json({ message: 'Travel request not found' });
    }

    // SIMULATE EMAIL SENDING WITH CONSOLE LOGS
    console.log('\n=== SIMULATING FLEET NOTIFICATIONS ===');
    console.log(`Travel Request ID: ${id}`);
    console.log(`Subject: "${subject}"`);
    console.log('Recipients:', recipients.join(', '));
    console.log('Notification saved to travel request:', travelRequest.fleetNotification);
    console.log('\n=== END OF SIMULATION ===\n');

    res.status(200).json({
      success: true,
      message: 'Fleet notifications processed successfully',
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
    console.log(req.body);
    
    // Validate the ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        message: "Invalid travel request ID" 
      });
    }

    const { 
      totalSpent, 
      remainingBalance, 
      additionalNotes 
    } = req.body;

    // Validate input
    if (typeof totalSpent !== 'number' || typeof remainingBalance !== 'number') {
      return res.status(400).json({ 
        message: "totalSpent and remainingBalance must be numbers" 
      });
    }

    // Find and update the travel request
    const travelRequest = await TravelRequest.findByIdAndUpdate(
      id,
      {

        reconciliation: {
          submittedDate: new Date(),
          approvedDate: null,
          approvedBy: null,
          totalSpent,
          remainingBalance,
          status: "pending",
          notes: additionalNotes,
          submittedBy: req.user._id
        }
      },
      { new: true }
    ).populate('employee', 'name email');

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