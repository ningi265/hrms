const { deepseekService } = require('./deepseekService');
const { geminiService } = require('./geminiService');

class AIServiceManager {
    constructor() {
        this.services = [
            { name: 'DeepSeek', service: deepseekService, priority: 1 },
            { name: 'Gemini', service: geminiService, priority: 2 }
        ];
        this.currentServiceIndex = 0;
    }

    async generateResponse(messages, context = {}) {
        console.log('\n🔄 AI Service Manager: Generating response...');
        console.log(`📝 Message: "${messages[messages.length - 1]?.text}"`);
        
        // Try services in priority order
        for (let i = 0; i < this.services.length; i++) {
            const serviceInfo = this.services[i];
            console.log(`\n🔧 Attempt ${i + 1}: Trying ${serviceInfo.name}...`);
            
            try {
                const result = await serviceInfo.service.generateResponse(messages, context);
                
                if (result.success) {
                    console.log(`✅ ${serviceInfo.name} response successful`);
                    console.log(`🤖 Provider: ${serviceInfo.name}`);
                    return {
                        ...result,
                        provider: serviceInfo.name
                    };
                } else {
                    console.log(`❌ ${serviceInfo.name} failed:`, result.error);
                }
            } catch (error) {
                console.log(`❌ ${serviceInfo.name} error:`, error.message);
            }
        }

        // All services failed, use fallback
        console.log('\n❌ All AI services failed, using enhanced fallback');
        return this.getEnhancedFallbackResponse(messages, context);
    }

    getEnhancedFallbackResponse(messages, context) {
        const lastMessage = messages[messages.length - 1]?.text || '';
        const userContext = context.user || {};
        const userName = userContext.firstName || 'there';
        const userRole = userContext.role || 'user';
        
        console.log(`🔄 Creating fallback response for: "${lastMessage}"`);
        
        const message = lastMessage.toLowerCase();
        
        // Enhanced role-based fallback responses
        const roleResponses = {
            'Enterprise(CEO, CFO, etc.)': {
                'who are you': `Hello ${userName}! I'm your AI Procurement Assistant, specifically designed to help executives like you with strategic procurement oversight. I can assist with budget monitoring, vendor performance analytics, approval workflows, and high-level procurement insights to support your decision-making.`,
                'what can you do': `As an executive assistant, I can help you:\n\n• Monitor departmental spending and budget utilization\n• Review vendor performance metrics and risk assessments\n• Oversee approval workflows and delegation rules\n• Generate strategic procurement reports and analytics\n• Configure budget thresholds and approval limits\n• Track procurement efficiency and cost savings\n\nWhat aspect would you like to explore?`
            },
            'procurement_officer': {
                'who are you': `Hello ${userName}! I'm your AI Procurement Assistant, here to help you manage daily procurement operations. I can assist with requisition creation, vendor management, RFQ processes, approval workflows, and procurement analytics.`,
                'what can you do': `I can help you with:\n\n• Creating and tracking requisitions\n• Managing vendor relationships and evaluations\n• Running RFQ and bidding processes\n• Handling approval workflows\n• Generating procurement reports\n• Ensuring compliance with procurement policies`
            }
        };

        // Check for role-specific responses
        const roleResponse = roleResponses[userRole];
        if (roleResponse) {
            for (const [key, response] of Object.entries(roleResponse)) {
                if (message.includes(key)) {
                    return {
                        success: true,
                        message: response,
                        provider: 'Fallback'
                    };
                }
            }
        }

        // General responses
        if (message.includes('who are you') || message.includes('what are you')) {
            return {
                success: true,
                message: `Hello${userName ? ' ' + userName : ''}! I'm your AI Procurement Assistant for the NexusMWI platform. I'm here to help you with all aspects of procurement management, from creating requisitions to analyzing vendor performance and managing approvals.\n\nWhile I'm currently operating in basic mode, I can still provide comprehensive guidance on procurement processes and platform navigation. How can I assist you today?`,
                provider: 'Fallback'
            };
        }

        if (message.includes('what can you do') || message.includes('help')) {
            return {
                success: true,
                message: `I can help you with various procurement tasks:\n\n📋 **Requisitions** - Create, track, and manage purchase requests\n✅ **Approvals** - Review and process approval workflows\n🏢 **Vendor Management** - Register and evaluate suppliers\n📝 **RFQ Process** - Manage bidding and tender processes\n📊 **Reports & Analytics** - Generate insights and performance metrics\n💰 **Budget Management** - Track spending and budget utilization\n⚙️ **Workflow Configuration** - Set up approval rules\n\nWhat would you like to start with?`,
                provider: 'Fallback'
            };
        }

        // Default intelligent response
        return {
            success: true,
            message: `Hello${userName ? ' ' + userName : ''}! I'm your Procurement Assistant. I can help you with requisitions, approvals, vendor management, RFQs, reports, and more.\n\nWhile I'm currently in basic mode, I can still provide detailed guidance on procurement processes and help you navigate the platform effectively. What specific area would you like assistance with today?`,
            provider: 'Fallback'
        };
    }

    async checkServiceStatus() {
        console.log('\n🔍 Checking AI service status...');
        const status = {
            services: {},
            overall: 'offline',
            onlineServices: 0,
            totalServices: this.services.length
        };
        
        for (const serviceInfo of this.services) {
            try {
                console.log(`\n🔧 Checking ${serviceInfo.name}...`);
                const isOnline = await serviceInfo.service.checkStatus();
                status.services[serviceInfo.name] = {
                    online: isOnline,
                    priority: serviceInfo.priority
                };
                
                if (isOnline) {
                    status.onlineServices++;
                    console.log(`✅ ${serviceInfo.name}: Online`);
                } else {
                    console.log(`❌ ${serviceInfo.name}: Offline`);
                }
            } catch (error) {
                status.services[serviceInfo.name] = {
                    online: false,
                    priority: serviceInfo.priority,
                    error: error.message
                };
                console.log(`❌ ${serviceInfo.name} status check failed:`, error.message);
            }
        }

        // Determine overall status
        status.overall = status.onlineServices > 0 ? 'online' : 'offline';
        
        console.log(`\n📊 Overall Status: ${status.overall.toUpperCase()}`);
        console.log(`🟢 Online Services: ${status.onlineServices}/${status.totalServices}`);

        return status;
    }

    getAvailableServices() {
        return this.services.map(s => ({
            name: s.name,
            priority: s.priority
        }));
    }
}

const aiServiceManager = new AIServiceManager();
module.exports = { aiServiceManager };