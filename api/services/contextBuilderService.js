// Enhanced import handling with multiple fallback paths
let User, Requisition, RFQ, Vendor;
const mongoose = require('mongoose');

console.log('🔧 Initializing ContextBuilderService...');

// Function to try multiple import paths
const tryImport = (modelName, paths) => {
  for (const path of paths) {
    try {
      const model = require(path);
      console.log(`✅ ${modelName} model loaded from: ${path}`);
      return model;
    } catch (error) {
      console.log(`❌ Failed to load ${modelName} from ${path}: ${error.message}`);
    }
  }
  return null;
};

// Try importing User model with multiple paths
User = tryImport('User', [
  '../../models/user',
  '../../../models/user',
  '../models/user',
  './models/user',
  '../../models/User',
  '../../../models/User'
]);

// Try importing Requisition model
Requisition = tryImport('Requisition', [
  '../../models/requisition',
  '../../../models/requisition',
  '../models/requisition',
  './models/requisition'
]);

// Try importing RFQ model
RFQ = tryImport('RFQ', [
  '../../models/RFQ',
  '../../../models/RFQ',
  '../models/RFQ',
  './models/RFQ',
  '../../models/rfq',
  '../../../models/rfq'
]);

// Try importing Vendor model
Vendor = tryImport('Vendor', [
  '../../models/vendor',
  '../../../models/vendor',
  '../models/vendor',
  './models/vendor'
]);

// Log final import status
console.log('📊 Model Import Status:');
console.log(`   User: ${User ? '✅ Loaded' : '❌ Failed'}`);
console.log(`   Requisition: ${Requisition ? '✅ Loaded' : '❌ Failed'}`);
console.log(`   RFQ: ${RFQ ? '✅ Loaded' : '❌ Failed'}`);
console.log(`   Vendor: ${Vendor ? '✅ Loaded' : '❌ Failed'}`);

class ContextBuilderService {
    async buildUserContext(userId, userMessage) {
        console.log('\n🔄 Building user context...');
        console.log(`   User ID: ${userId}`);
        console.log(`   Message: ${userMessage || 'No message'}`);
        
        try {
            // Validate userId
            if (!userId) {
                console.warn('❌ User ID is undefined');
                return this.getFallbackContext(userMessage);
            }

            // Validate MongoDB ObjectId format
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                console.warn(`❌ Invalid User ID format: ${userId}`);
                return this.getFallbackContext(userMessage);
            }

            // Check if User model is available
            if (!User) {
                console.warn('❌ User model not available');
                return this.getFallbackContext(userMessage);
            }

            console.log('🔍 Fetching user from database...');
            const user = await User.findById(userId)
                .populate('company', 'name industry')
                .select('firstName lastName role department company');
            
            if (!user) {
                console.warn(`❌ User not found with ID: ${userId}`);
                return this.getFallbackContext(userMessage);
            }

            console.log('✅ User found:', {
                name: `${user.firstName} ${user.lastName}`,
                role: user.role,
                department: user.department
            });

            const context = {
                user: {
                    id: user._id.toString(),
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    department: user.department,
                    company: user.company
                },
                procurementData: {
                    requisitionStats: [],
                    pendingApprovals: [],
                    activeRFQs: [],
                    recommendedVendors: [],
                    // Recent requisitions created by this user (employee)
                    myRequisitions: [],
                    summary: {
                        totalRequisitions: 0,
                        pendingApprovalsCount: 0,
                        activeRFQsCount: 0,
                        recommendedVendorsCount: 0,
                        myRequisitionsCount: 0
                    }
                },
                suggestions: []
            };

            // Build procurement data context
            await this.buildProcurementContext(context, userMessage, userId);
            
            // Generate suggestions based on context
            context.suggestions = this.generateSuggestions(context, userMessage);
            
            console.log('✅ Context built successfully:', {
                user: context.user.firstName,
                requisitions: context.procurementData.summary.totalRequisitions,
                approvals: context.procurementData.summary.pendingApprovalsCount,
                rfqs: context.procurementData.summary.activeRFQsCount,
                vendors: context.procurementData.summary.recommendedVendorsCount,
                suggestions: context.suggestions.length
            });
            
            return context;
        } catch (error) {
            console.error('❌ Context building error:', error.message);
            console.error('Stack trace:', error.stack);
            return this.getFallbackContext(userMessage);
        }
    }

    async buildProcurementContext(context, userMessage, userId) {
        const message = userMessage?.toLowerCase() || '';
        console.log('🔍 Building procurement context...');

        try {
            // Get requisition stats if model is available
            if (Requisition) {
                try {
                    console.log('📊 Fetching requisition statistics...');
                    const requisitionStats = await Requisition.aggregate([
                        { $match: { employee: new mongoose.Types.ObjectId(userId) } },
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 },
                                // Sum based on actual schema field name
                                totalAmount: { $sum: '$estimatedCost' }
                            }
                        }
                    ]);
                    
                    context.procurementData.requisitionStats = requisitionStats || [];
                    context.procurementData.summary.totalRequisitions = requisitionStats?.reduce((sum, stat) => sum + stat.count, 0) || 0;
                    console.log(`✅ Requisitions: ${context.procurementData.summary.totalRequisitions} total`);

                    // Also fetch the most recent requisitions created by this user
                    console.log('📋 Fetching recent user requisitions...');
                    const myRequisitions = await Requisition.find({ employee: userId })
                        .populate('employee', 'firstName lastName')
                        .sort({ createdAt: -1 })
                        .limit(5);

                    context.procurementData.myRequisitions = myRequisitions || [];
                    context.procurementData.summary.myRequisitionsCount = myRequisitions?.length || 0;
                    console.log(`✅ Recent requisitions: ${context.procurementData.summary.myRequisitionsCount}`);
                } catch (error) {
                    console.error('❌ Error fetching requisition stats:', error.message);
                }
            } else {
                console.log('⏭️  Requisition model not available, skipping requisition data');
            }

            // Get approval data if relevant and model available
            if (this.shouldIncludeApprovals(message) && Requisition) {
                try {
                    console.log('📋 Fetching pending approvals...');
                    const pendingApprovals = await Requisition.find({
                        approver: userId,
                        status: 'pending'
                    })
                    .populate('employee', 'firstName lastName')
                    .populate('approver', 'firstName lastName')
                    .sort({ createdAt: -1 })
                    .limit(5);
                    
                    context.procurementData.pendingApprovals = pendingApprovals || [];
                    context.procurementData.summary.pendingApprovalsCount = pendingApprovals?.length || 0;
                    console.log(`✅ Pending approvals: ${context.procurementData.summary.pendingApprovalsCount}`);
                } catch (error) {
                    console.error('❌ Error fetching pending approvals:', error.message);
                }
            } else {
                console.log(`⏭️  Skipping approvals - include: ${this.shouldIncludeApprovals(message)}, model: ${!!Requisition}`);
            }

            // Get vendor data if relevant and model available
            if (this.shouldIncludeVendors(message) && Vendor) {
                try {
                    console.log('🏢 Fetching vendor data...');
                    const vendors = await Vendor.find({ registrationStatus: 'approved' })
                        .sort({ rating: -1 })
                        .limit(5)
                        // Populate both possible user references for contact info
                        .populate('vendor', 'firstName lastName email')
                        .populate('user', 'firstName lastName email');

                    // Debug logging to verify populated contact data
                    if (vendors && vendors.length > 0) {
                        const sample = vendors[0];
                        console.log('🔍 Sample vendor contact data:', {
                            vendorId: sample._id?.toString(),
                            businessName: sample.name,
                            rating: sample.rating,
                            contactVendor: sample.vendor ? {
                                id: sample.vendor._id?.toString(),
                                name: `${sample.vendor.firstName || ''} ${sample.vendor.lastName || ''}`.trim(),
                                email: sample.vendor.email || null
                            } : null,
                            contactUser: sample.user ? {
                                id: sample.user._id?.toString(),
                                name: `${sample.user.firstName || ''} ${sample.user.lastName || ''}`.trim(),
                                email: sample.user.email || null
                            } : null
                        });
                    } else {
                        console.log('ℹ️ No approved vendors found to recommend');
                    }
                    
                    context.procurementData.recommendedVendors = vendors || [];
                    context.procurementData.summary.recommendedVendorsCount = vendors?.length || 0;
                    console.log(`✅ Recommended vendors: ${context.procurementData.summary.recommendedVendorsCount}`);
                } catch (error) {
                    console.error('❌ Error fetching vendors:', error.message);
                }
            } else {
                console.log(`⏭️  Skipping vendors - include: ${this.shouldIncludeVendors(message)}, model: ${!!Vendor}`);
            }

            // Get RFQ data if relevant and model available
            if (this.shouldIncludeRFQs(message) && RFQ) {
                try {
                    console.log('📝 Fetching RFQ data...');
                    const activeRFQs = await RFQ.find({
                        status: { $in: ['open', 'pending'] },
                        $or: [
                            { procurementOfficer: userId },
                            { vendors: userId }
                        ]
                    })
                    .sort({ deadline: 1 })
                    .limit(5);
                    
                    context.procurementData.activeRFQs = activeRFQs || [];
                    context.procurementData.summary.activeRFQsCount = activeRFQs?.length || 0;
                    console.log(`✅ Active RFQs: ${context.procurementData.summary.activeRFQsCount}`);
                } catch (error) {
                    console.error('❌ Error fetching RFQs:', error.message);
                }
            } else {
                console.log(`⏭️  Skipping RFQs - include: ${this.shouldIncludeRFQs(message)}, model: ${!!RFQ}`);
            }

            console.log('✅ Procurement context completed');
        } catch (error) {
            console.error('❌ Error building procurement context:', error.message);
            // Ensure we always have the basic structure
            context.procurementData = context.procurementData || {
                requisitionStats: [],
                pendingApprovals: [],
                activeRFQs: [],
                recommendedVendors: [],
                myRequisitions: [],
                summary: {
                    totalRequisitions: 0,
                    pendingApprovalsCount: 0,
                    activeRFQsCount: 0,
                    recommendedVendorsCount: 0,
                    myRequisitionsCount: 0
                }
            };
        }
    }

    shouldIncludeApprovals(message) {
        const shouldInclude = message.includes('approval') || 
               message.includes('approve') || 
               message.includes('pending') ||
               message.includes('review');
        console.log(`🔍 Should include approvals: ${shouldInclude} (message: "${message}")`);
        return shouldInclude;
    }

    shouldIncludeVendors(message) {
        const shouldInclude = message.includes('vendor') || 
               message.includes('supplier') || 
               message.includes('partner') ||
               message.includes('performance');
        console.log(`🔍 Should include vendors: ${shouldInclude} (message: "${message}")`);
        return shouldInclude;
    }

    shouldIncludeRFQs(message) {
        const shouldInclude = message.includes('rfq') || 
               message.includes('bid') || 
               message.includes('tender') ||
               message.includes('bidding') ||
               message.includes('proposal');
        console.log(`🔍 Should include RFQs: ${shouldInclude} (message: "${message}")`);
        return shouldInclude;
    }

    generateSuggestions(context, userMessage) {
        console.log('💡 Generating suggestions...');
        const message = userMessage?.toLowerCase() || '';
        const baseSuggestions = [
            "How do I create a requisition?",
            "Check procurement workflow",
            "View vendor performance",
            "Generate procurement report"
        ];

        const roleBasedSuggestions = this.getRoleBasedSuggestions(context.user?.role);
        const dataDrivenSuggestions = this.getDataDrivenSuggestions(context.procurementData);
        const messageBasedSuggestions = this.getMessageBasedSuggestions(message);

        // Combine and deduplicate suggestions
        const allSuggestions = [
            ...baseSuggestions,
            ...roleBasedSuggestions,
            ...dataDrivenSuggestions,
            ...messageBasedSuggestions
        ];

        // Remove duplicates and limit to 8 suggestions
        const finalSuggestions = [...new Set(allSuggestions)].slice(0, 8);
        console.log(`✅ Generated ${finalSuggestions.length} suggestions`);
        return finalSuggestions;
    }

    getRoleBasedSuggestions(userRole) {
        const suggestions = {
            'procurement_officer': [
                "Create new requisition",
                "Review pending approvals",
                "Manage active RFQs",
                "Vendor evaluation",
                "Generate spend analysis"
            ],
            'admin': [
                "System configuration",
                "User management",
                "Budget overview",
                "Analytics dashboard",
                "System health check"
            ],
            'vendor': [
                "View open RFQs",
                "Submit bid proposal",
                "Update vendor profile",
                "Check payment status",
                "View contract terms"
            ],
            'Executive (CEO, CFO, etc.)': [
                "Budget overview",
                "Approval queue",
                "Strategic reports",
                "Vendor performance",
                "Spend analysis"
            ],
            'Management': [
                "Team performance",
                "Budget tracking",
                "Approval workflows",
                "Department reports"
            ],
            'IT/Technical': [
                "System integration",
                "Technical specifications",
                "Vendor technical evaluation",
                "Infrastructure procurement"
            ]
        };

        const roleSuggestions = suggestions[userRole] || [];
        console.log(`👤 Role-based suggestions for ${userRole}: ${roleSuggestions.length}`);
        return roleSuggestions;
    }

    getDataDrivenSuggestions(procurementData) {
        const suggestions = [];
        const summary = procurementData?.summary || {};

        if (summary.pendingApprovalsCount > 0) {
            suggestions.push(`Review ${summary.pendingApprovalsCount} pending approvals`);
        }

        if (summary.activeRFQsCount > 0) {
            suggestions.push(`Track ${summary.activeRFQsCount} active RFQs`);
        }

        if (summary.recommendedVendorsCount > 0) {
            suggestions.push(`View ${summary.recommendedVendorsCount} recommended vendors`);
        }

        if (summary.totalRequisitions > 0) {
            suggestions.push("View requisition history");
        }

        console.log(`📈 Data-driven suggestions: ${suggestions.length}`);
        return suggestions;
    }

    getMessageBasedSuggestions(message) {
        if (!message) return [];

        let messageSuggestions = [];

        if (message.includes('requisition') || message.includes('create')) {
            messageSuggestions = [
                "Requisition workflow steps",
                "Required documents for requisition",
                "Approval process timeline",
                "Budget allocation check"
            ];
        } else if (message.includes('approval') || message.includes('approve')) {
            messageSuggestions = [
                "Approval workflow",
                "Delegation options",
                "Urgent approvals",
                "Approval history"
            ];
        } else if (message.includes('vendor') || message.includes('supplier')) {
            messageSuggestions = [
                "Vendor registration process",
                "Vendor evaluation criteria",
                "Contract management",
                "Performance reviews"
            ];
        } else if (message.includes('rfq') || message.includes('bid')) {
            messageSuggestions = [
                "RFQ creation process",
                "Bid evaluation criteria",
                "Vendor communication",
                "Award process"
            ];
        }

        console.log(`💬 Message-based suggestions: ${messageSuggestions.length}`);
        return messageSuggestions;
    }

    getFallbackContext(userMessage) {
        console.log('🔄 Using fallback context');
        
        const fallbackContext = {
            user: {
                id: 'unknown',
                firstName: 'User',
                lastName: '',
                role: 'user',
                department: 'General',
                company: null
            },
            procurementData: {
                requisitionStats: [],
                pendingApprovals: [],
                activeRFQs: [],
                recommendedVendors: [],
                summary: {
                    totalRequisitions: 0,
                    pendingApprovalsCount: 0,
                    activeRFQsCount: 0,
                    recommendedVendorsCount: 0
                }
            },
            suggestions: this.getFallbackSuggestions(userMessage)
        };
        
        console.log('✅ Fallback context created');
        return fallbackContext;
    }

    getFallbackSuggestions(userMessage) {
        const fallbackSuggestions = [
            "Create new requisition",
            "Check approval workflow",
            "View vendor management",
            "RFQ process guidance",
            "Generate reports",
            "Budget tracking",
            "Contract management",
            "Procurement policies"
        ];

        console.log(`🔄 Using ${fallbackSuggestions.length} fallback suggestions`);
        return fallbackSuggestions;
    }
}

const contextBuilderService = new ContextBuilderService();
console.log('✅ ContextBuilderService initialized successfully');

module.exports = { contextBuilderService };