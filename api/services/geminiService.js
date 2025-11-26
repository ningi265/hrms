const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.genAI = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
        // Updated model name - use the latest available model
        this.modelName = 'gemini-1.5-flash-latest'; // or 'gemini-pro' for older accounts
    }

    async generateResponse(messages, context = {}) {
        try {
            // Check if Gemini is configured
            if (!this.genAI) {
                console.log('❌ Gemini API not configured - missing API key');
                return {
                    success: false,
                    error: 'Gemini API not configured'
                };
            }

            console.log(`🔧 Using Gemini model: ${this.modelName}`);
            
            const model = this.genAI.getGenerativeModel({ 
                model: this.modelName,
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1000,
                }
            });

            const prompt = this.buildPrompt(messages, context);
            
            console.log('📤 Sending request to Gemini API...');
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            console.log('✅ Gemini response received successfully');
            
            return {
                success: true,
                message: text,
                usage: {
                    totalTokens: response.usageMetadata?.totalTokenCount || 0
                }
            };
        } catch (error) {
            console.error('❌ Gemini API Error:', error.message);
            
            // Handle specific Gemini errors
            if (error.message.includes('404') || error.message.includes('not found')) {
                console.log('🔄 Model not found, trying alternative model...');
                return await this.tryAlternativeModel(messages, context);
            }
            
            if (error.message.includes('API key') || error.message.includes('auth')) {
                console.log('❌ Gemini API key issue');
                return {
                    success: false,
                    error: 'Invalid Gemini API key'
                };
            }
            
            return {
                success: false,
                error: error.message || 'Failed to generate Gemini response'
            };
        }
    }

    async tryAlternativeModel(messages, context) {
        try {
            console.log('🔄 Trying alternative Gemini models...');
            
            // Try different model names
            const alternativeModels = [
                'gemini-1.5-flash',
                'gemini-1.0-pro',
                'gemini-pro',
                'models/gemini-pro'
            ];
            
            for (const modelName of alternativeModels) {
                try {
                    console.log(`🔧 Trying model: ${modelName}`);
                    const model = this.genAI.getGenerativeModel({ 
                        model: modelName,
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 1000,
                        }
                    });

                    const prompt = this.buildPrompt(messages, context);
                    const result = await model.generateContent(prompt);
                    const response = await result.response;
                    const text = response.text();

                    console.log(`✅ Success with model: ${modelName}`);
                    this.modelName = modelName; // Remember working model
                    
                    return {
                        success: true,
                        message: text,
                        usage: {
                            totalTokens: response.usageMetadata?.totalTokenCount || 0
                        }
                    };
                } catch (modelError) {
                    console.log(`❌ Model ${modelName} failed:`, modelError.message);
                    continue;
                }
            }
            
            throw new Error('All Gemini models failed');
            
        } catch (error) {
            console.error('❌ All alternative models failed:', error.message);
            return {
                success: false,
                error: 'All Gemini models unavailable'
            };
        }
    }

    buildPrompt(messages, context) {
        const lastMessage = messages[messages.length - 1];
        const conversationHistory = messages.slice(0, -1);
        
        let prompt = `You are an AI Procurement Assistant for the NexusMWI procurement platform. Be helpful, professional, and concise.

USER PROFILE:
- Name: ${context.user?.firstName || 'User'} ${context.user?.lastName || ''}
- Role: ${context.user?.role || 'Not specified'}
- Department: ${context.user?.department || 'Not specified'}

`;

        // Include procurement data if available
        const procurementSummary = context.procurementData?.summary;
        if (procurementSummary) {
            prompt += `PROCUREMENT CONTEXT:\n`;
            if (procurementSummary.totalRequisitions > 0) {
                prompt += `- Total Requisitions: ${procurementSummary.totalRequisitions}\n`;
            }
            if (procurementSummary.pendingApprovalsCount > 0) {
                prompt += `- Pending Approvals: ${procurementSummary.pendingApprovalsCount}\n`;
            }
            if (procurementSummary.activeRFQsCount > 0) {
                prompt += `- Active RFQs: ${procurementSummary.activeRFQsCount}\n`;
            }
            prompt += '\n';
        }

        // Include conversation history
        if (conversationHistory.length > 0) {
            prompt += `CONVERSATION HISTORY:\n`;
            const recentMessages = conversationHistory.slice(-4); // Last 4 exchanges
            recentMessages.forEach(msg => {
                prompt += `${msg.sender === 'user' ? 'USER' : 'ASSISTANT'}: ${msg.text}\n`;
            });
            prompt += '\n';
        }

        prompt += `CURRENT QUESTION: "${lastMessage.text}"\n\n`;
        prompt += `Please provide a helpful response focused on procurement assistance.`;

        return prompt;
    }

    formatProcurementData(procurementData) {
        if (!procurementData) {
            return "No procurement data available.";
        }

        let formattedData = '';
        const summary = procurementData.summary || {};

        if (summary.totalRequisitions > 0) {
            formattedData += `• Total Requisitions: ${summary.totalRequisitions}\n`;
        }
        if (summary.pendingApprovalsCount > 0) {
            formattedData += `• Pending Approvals: ${summary.pendingApprovalsCount}\n`;
        }
        if (summary.activeRFQsCount > 0) {
            formattedData += `• Active RFQs: ${summary.activeRFQsCount}\n`;
        }
        if (summary.recommendedVendorsCount > 0) {
            formattedData += `• Recommended Vendors: ${summary.recommendedVendorsCount}\n`;
        }

        return formattedData || "No specific procurement data available.";
    }

    async checkStatus() {
        try {
            if (!this.genAI) {
                console.log('❌ Gemini not configured');
                return false;
            }

            console.log('🔍 Checking Gemini API status...');
            
            // Try multiple models for status check
            const testModels = [
                'gemini-1.5-flash-latest',
                'gemini-1.5-flash',
                'gemini-1.0-pro',
                'gemini-pro'
            ];
            
            for (const modelName of testModels) {
                try {
                    const model = this.genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent('Say "online"');
                    await result.response;
                    
                    console.log(`✅ Gemini status check passed with model: ${modelName}`);
                    this.modelName = modelName; // Set working model
                    return true;
                } catch (error) {
                    console.log(`❌ Gemini model ${modelName} failed:`, error.message);
                    continue;
                }
            }
            
            console.log('❌ All Gemini models failed status check');
            return false;
            
        } catch (error) {
            console.error('❌ Gemini status check failed:', error.message);
            return false;
        }
    }
}

const geminiService = new GeminiService();
module.exports = { geminiService };