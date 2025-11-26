const axios = require('axios');

class DeepSeekService {
    constructor() {
        this.apiKey = process.env.DEEPSEEK_API_KEY;
        this.baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 second timeout
        });
    }

    async generateResponse(messages, context = {}) {
        try {
            const prompt = this.buildPrompt(messages, context);
            
            const response = await this.client.post('/chat/completions', {
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: this.getSystemPrompt(context)
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000,
                stream: false
            });

            return {
                success: true,
                message: response.data.choices[0].message.content,
                usage: response.data.usage
            };
        } catch (error) {
            console.error('DeepSeek API Error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.error?.message || 'Failed to generate AI response'
            };
        }
    }

    async checkStatus() {
        try {
            // Try to make a lightweight request to check API status
            const response = await this.client.post('/chat/completions', {
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'user',
                        content: 'Say "online" if you can hear me.'
                    }
                ],
                max_tokens: 10,
                temperature: 0.1
            }, {
                timeout: 10000 // 10 second timeout for status check
            });

            // If we get a successful response, service is online
            return response.status === 200 && 
                   response.data.choices && 
                   response.data.choices.length > 0;
            
        } catch (error) {
            console.error('DeepSeek Status Check Failed:', error.response?.data || error.message);
            
            // Check for specific error types that indicate service status
            if (error.response) {
                // API responded with error status (4xx, 5xx)
                const status = error.response.status;
                if (status === 401) {
                    console.error('DeepSeek API: Invalid API key');
                } else if (status === 429) {
                    console.error('DeepSeek API: Rate limit exceeded');
                } else if (status >= 500) {
                    console.error('DeepSeek API: Server error');
                }
                // Even with errors, if we got a response, the service is technically "reachable"
                return true;
            } else if (error.request) {
                // Request was made but no response received (network issue)
                console.error('DeepSeek API: No response received - service may be offline');
                return false;
            } else {
                // Other errors (configuration, etc.)
                console.error('DeepSeek API: Configuration error');
                return false;
            }
        }
    }

    buildPrompt(messages, context) {
        const lastMessage = messages[messages.length - 1];
        const conversationHistory = messages.slice(0, -1);
        
        let prompt = `
USER PROFILE:
- Role: ${context.user?.role || 'Not specified'}
- Department: ${context.user?.department || 'Not specified'}
- Name: ${context.user?.firstName || ''} ${context.user?.lastName || ''}

CONVERSATION HISTORY:
`;

        // Include recent conversation history (last 5 exchanges)
        const recentMessages = conversationHistory.slice(-10);
        if (recentMessages.length > 0) {
            recentMessages.forEach(msg => {
                prompt += `${msg.sender === 'user' ? 'USER' : 'ASSISTANT'}: ${msg.text}\n`;
            });
        } else {
            prompt += "No previous conversation history.\n";
        }

        prompt += `
CURRENT REAL-TIME DATA:
${this.formatProcurementData(context.procurementData)}

CURRENT USER MESSAGE: "${lastMessage.text}"

Please provide a helpful, professional response based on the user's context, conversation history, and available real-time data.`;

        return prompt;
    }

    formatProcurementData(procurementData) {
        if (!procurementData) {
            return "No real-time data available at the moment.";
        }

        let formattedData = '';
        
        if (procurementData.requisitionStats && procurementData.requisitionStats.length > 0) {
            formattedData += `REQUISITIONS:\n`;
            procurementData.requisitionStats.forEach(req => {
                formattedData += `- ${req.title || 'Requisition'} (${req.status || 'Unknown'}): ${req.description || 'No description'}\n`;
            });
        }
        
        if (procurementData.pendingApprovals && procurementData.pendingApprovals.length > 0) {
            formattedData += `\nPENDING APPROVALS: ${procurementData.pendingApprovals.length} items\n`;
        }
        
        if (procurementData.activeRFQs && procurementData.activeRFQs.length > 0) {
            formattedData += `\nACTIVE RFQs: ${procurementData.activeRFQs.length} open requests\n`;
        }
        
        if (procurementData.recommendedVendors && procurementData.recommendedVendors.length > 0) {
            formattedData += `\nRECOMMENDED VENDORS: ${procurementData.recommendedVendors.length} suggestions\n`;
        }

        return formattedData || "No specific procurement data available.";
    }

    getSystemPrompt(context) {
        return `You are an AI Procurement Assistant for the NexusMWI procurement platform. 

YOUR IDENTITY AND CAPABILITIES:
- You are an integrated AI assistant within the NexusMWI procurement system
- You have access to real-time procurement data including requisitions, approvals, vendors, RFQs, and purchase orders
- You can provide step-by-step guidance for platform features and navigation
- You analyze available data to give personalized recommendations
- You help users navigate the complete procurement workflow
- You assist with vendor management, bidding processes, and tender management

RESPONSE GUIDELINES:
1. Use actual numbers and data from the context when available - be specific
2. Reference specific requisition IDs, vendor names, or approval items when mentioned in data
3. Provide actionable next steps with clear platform navigation tips (mention specific menu items or sections)
4. Be concise but thorough - balance detail with readability
5. Suggest optimizations based on the user's role and department context
6. If suggesting actions, mention exactly where to click in the platform interface
7. Acknowledge when data is limited and suggest where to find more information
8. Maintain professional but approachable tone

TONE AND STYLE:
- Professional, helpful, and data-driven
- Confident but not arrogant
- Clear and specific in recommendations
- Empathetic to user's procurement challenges
- Encouraging and supportive in guidance

PLATFORM KNOWLEDGE:
You are deeply familiar with the NexusMWI platform structure including:
- Requisitions management
- Approval workflows  
- Vendor portal
- RFQ/Bidding system
- Purchase order tracking
- Contract management
- Analytics and reporting

Always work within your knowledge boundaries and suggest contacting support for complex technical issues.`;
    }

    // Optional: Method for quick health check without full API call
    async quickHealthCheck() {
        try {
            // Simple API call that should be fast
            const response = await this.client.get('/models', {
                timeout: 5000 // 5 second timeout
            });
            return response.status === 200;
        } catch (error) {
            console.error('DeepSeek Quick Health Check Failed:', error.message);
            return false;
        }
    }
}

const deepseekService = new DeepSeekService();
module.exports = { deepseekService };