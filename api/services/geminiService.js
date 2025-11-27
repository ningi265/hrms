const axios = require('axios');

class GeminiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        
        // Initialize with specific configuration for newer API versions
        this.genAI = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
        
        // Updated model configuration for current Gemini API
        this.availableModels = [
            'gemini-1.5-flash',      // Current recommended model
            'gemini-1.0-pro',        // Alternative model
            'gemini-pro',            // Legacy model name
        ];
        
        this.currentModelIndex = 0;
    }

    async generateResponse(messages, context = {}) {
        try {
            if (!this.client) {
                console.log('❌ Gemini API not configured - missing API key');
                return {
                    success: false,
                    error: 'Gemini API not configured'
                };
            }

            console.log('🔧 Starting Gemini request...');
            
            // Try each available model
            for (let i = 0; i < this.availableModels.length; i++) {
                const modelName = this.availableModels[i];
                console.log(`🤖 Trying model: ${modelName}`);
                
                try {
                    const result = await this.tryModel(messages, context, modelName);
                    if (result.success) {
                        this.currentModelIndex = i; // Remember working model
                        return result;
                    }
                } catch (error) {
                    console.log(`❌ Model ${modelName} failed:`, error.message);
                    continue;
                }
            }
            
            throw new Error('All Gemini models failed');
            
        } catch (error) {
            console.error('❌ All Gemini models failed:', error.message);
            return {
                success: false,
                error: 'All Gemini models unavailable: ' + error.message
            };
        }
    }

    async tryModel(messages, context, modelName) {
        try {
            const model = this.genAI.getGenerativeModel({ 
                model: modelName,
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1000,
                },
                // Add safety settings to avoid blocking
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH", 
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            });

            const candidates = response.data.candidates || [];
            const text = candidates.length > 0
                ? (candidates[0].content?.parts || [])
                    .map(part => part.text || '')
                    .join(' ')
                    .trim()
                : '';

            console.log(`✅ Gemini response successful with model: ${modelName}`);
            
            return {
                success: true,
                message: text || 'Gemini returned an empty response',
                usage: {
                    totalTokens: response.data.usageMetadata?.totalTokenCount || 0
                }
            };
        } catch (error) {
            // Re-throw to continue to next model
            throw error;
        }
    }

    buildPrompt(messages, context) {
        const lastMessage = messages[messages.length - 1];
        const conversationHistory = messages.slice(0, -1);
        
        let prompt = `You are an AI Procurement Assistant for the NexusMWI procurement platform. 

ROLE: You help users with procurement-related tasks including requisitions, approvals, vendor management, RFQs, and procurement analytics.

USER CONTEXT:
- Name: ${context.user?.firstName || 'User'} ${context.user?.lastName || ''}
- Role: ${context.user?.role || 'General User'}
- Department: ${context.user?.department || 'Not specified'}

`;

        // Add procurement context if available
        const procurementData = context.procurementData || {};
        const summary = procurementData.summary || {};
        
        if (summary.totalRequisitions > 0 || summary.pendingApprovalsCount > 0) {
            prompt += `CURRENT PROCUREMENT STATUS:\n`;
            if (summary.totalRequisitions > 0) prompt += `- Total Requisitions: ${summary.totalRequisitions}\n`;
            if (summary.pendingApprovalsCount > 0) prompt += `- Pending Approvals: ${summary.pendingApprovalsCount}\n`;
            if (summary.activeRFQsCount > 0) prompt += `- Active RFQs: ${summary.activeRFQsCount}\n`;
            prompt += '\n';
        }

        // Add conversation history
        if (conversationHistory.length > 0) {
            prompt += `CONVERSATION HISTORY:\n`;
            const recentMessages = conversationHistory.slice(-3);
            recentMessages.forEach(msg => {
                const role = msg.sender === 'user' ? 'USER' : 'ASSISTANT';
                prompt += `${role}: ${msg.text}\n`;
            });
            prompt += '\n';
        }

        prompt += `CURRENT USER MESSAGE: "${lastMessage.text}"\n\n`;
        prompt += `Please provide a helpful, professional response focused on procurement assistance.`;

        return prompt;
    }

    async checkStatus() {
        try {
            if (!this.genAI) {
                console.log('❌ Gemini not configured - no API key');
                return false;
            }

            console.log('🔍 Checking Gemini API status...');
            
            // Test with a simple message
            const testModels = [
                'gemini-1.5-flash',
                'gemini-1.0-pro', 
                'gemini-pro'
            ];
            
            for (const modelName of testModels) {
                try {
                    const model = this.genAI.getGenerativeModel({ 
                        model: modelName,
                        generationConfig: {
                            maxOutputTokens: 10,
                        }
                    });
                    
                    const result = await model.generateContent('Say "online"');
                    const response = await result.response;
                    const text = response.text();
                    
                    if (text && text.toLowerCase().includes('online')) {
                        console.log(`✅ Gemini status check passed with model: ${modelName}`);
                        this.currentModelIndex = testModels.indexOf(modelName);
                        return true;
                    }
                } catch (error) {
                    console.log(`❌ Gemini model ${modelName} failed:`, error.message);
                    continue;
                }
            }

            if (apiReachable) {
                console.log('ℹ️ Gemini API reachable but model request failed during status check');
                return true;
            }

            console.log('❌ Gemini status check failed - API not reachable');
            return false;
        } catch (error) {
            console.error('❌ Gemini status check failed:', error.message);
            return false;
        }
    }

    // Method to manually set API key if needed
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        this.genAI = new GoogleGenerativeAI(apiKey);
        console.log('✅ Gemini API key updated');
    }
}

const geminiService = new GeminiService();
module.exports = { geminiService };