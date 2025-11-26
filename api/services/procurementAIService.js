const { Requisition } = require('../models/requisition');
const { Vendor } = require('../models/vendor');
const { RFQ } = require('../models/rfq');
const { PurchaseOrder } = require('../models/purchaseOrder');
const { Tender } = require('../models/tender');
const { User } = require('../models/user');

class ProcurementAIService {
  async getUserRequisitionStats(userId) {
    try {
      const stats = await Requisition.aggregate([
        { $match: { createdBy: userId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getPendingApprovals(userId) {
    try {
      // Based on your existing approval logic
      const user = await User.findById(userId);
      let query = { status: 'pending_approval' };
      
      // If user is an approver, show approvals assigned to them
      if (user.role === 'approver' || user.role === 'admin') {
        query = { 
          $or: [
            { 'approvals.approverId': userId, 'approvals.status': 'pending' },
            { status: 'pending_approval' }
          ]
        };
      }

      const pendingRequisitions = await Requisition.find(query)
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(10);

      return {
        success: true,
        data: pendingRequisitions
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getRecommendedVendors(department, category = null) {
    try {
      let query = { status: 'approved' };
      if (category) {
        query.category = category;
      }

      const vendors = await Vendor.find(query)
        .sort({ performanceScore: -1 })
        .limit(5);

      return {
        success: true,
        data: vendors
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getActiveRFQs(userId) {
    try {
      const activeRFQs = await RFQ.find({
        status: { $in: ['open', 'in_progress'] },
        $or: [
          { createdBy: userId },
          { 'bidders.vendorId': userId } // If user is also a vendor
        ]
      })
      .sort({ deadline: 1 })
      .limit(5);

      return {
        success: true,
        data: activeRFQs
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getRequisitionSuggestions(userId) {
    try {
      const user = await User.findById(userId);
      const [pendingRequisitions, pendingApprovals, activeRFQs] = await Promise.all([
        Requisition.countDocuments({ createdBy: userId, status: 'pending_approval' }),
        this.getPendingApprovals(userId),
        this.getActiveRFQs(userId)
      ]);

      const suggestions = [];

      if (pendingRequisitions > 0) {
        suggestions.push(`Follow up on ${pendingRequisitions} pending requisitions`);
      }

      if (pendingApprovals.success && pendingApprovals.data.length > 0) {
        suggestions.push(`Review ${pendingApprovals.data.length} pending approvals`);
      }

      if (activeRFQs.success && activeRFQs.data.length > 0) {
        suggestions.push(`Track ${activeRFQs.data.length} active RFQs`);
      }

      // Role-based suggestions
      if (user.role === 'procurement_manager') {
        suggestions.push('Analyze vendor performance', 'Generate spend report');
      } else if (user.role === 'vendor') {
        suggestions.push('Browse open RFQs', 'Update vendor profile');
      }

      suggestions.push('Create new requisition', 'Check policy updates');

      return {
        success: true,
        data: suggestions.slice(0, 6)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

const procurementAIService = new ProcurementAIService();
module.exports = { procurementAIService };