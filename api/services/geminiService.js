const axios = require('axios');

class GeminiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.baseURL = 'https://generativelanguage.googleapis.com/v1';
        this.client = this.apiKey
            ? axios.create({
                baseURL: this.baseURL,
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': this.apiKey
                },
                timeout: 30000
            })
            : null;
        // Optional: allow overriding model via environment
        this.configuredModel = process.env.GEMINI_MODEL || null;
        // Default Gemini model; will be overridden when a working model is detected
        this.modelName = this.configuredModel || 'gemini-1.5-flash-latest';
        this.modelResolved = !!this.configuredModel;
    }

    async ensureModel() {
        try {
            if (!this.client) {
                return false;
            }

            // If we already resolved a working model, reuse it
            if (this.modelResolved && this.modelName) {
                return true;
            }

            // If an explicit model is configured, trust it once
            if (this.configuredModel && !this.modelResolved) {
                this.modelName = this.configuredModel;
                this.modelResolved = true;
                console.log(`🔧 Using configured Gemini model from env: ${this.modelName}`);
                return true;
            }

            console.log('🔍 Discovering available Gemini models via ListModels...');
            const res = await this.client.get('/models');
            const models = res.data.models || [];

            if (!models.length) {
                console.log('❌ No models returned from Gemini ListModels');
                return false;
            }

            // Prefer Gemini models that support generateContent
            const generativeGemini = models.find(m =>
                (m.supportedGenerationMethods || []).includes('generateContent') &&
                m.name && m.name.includes('gemini')
            );
            const anyGenerative = models.find(m =>
                (m.supportedGenerationMethods || []).includes('generateContent')
            );

            const chosen = generativeGemini || anyGenerative;
            if (!chosen) {
                console.log('❌ No models with generateContent support found in ListModels');
                return false;
            }

            const fullName = chosen.name; // e.g. 'models/gemini-1.0-pro'
            const shortName = fullName && fullName.startsWith('models/')
                ? fullName.substring('models/'.length)
                : fullName;

            this.modelName = shortName;
            this.modelResolved = true;

            console.log(`✅ Using discovered Gemini model: ${fullName} (short: ${this.modelName})`);
            return true;
        } catch (error) {
            const msg = error.response?.data?.error?.message || error.message;
            console.error('❌ Failed to discover Gemini models via ListModels:', msg);
            return false;
        }
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

            const hasModel = await this.ensureModel();
            if (!hasModel) {
                console.log('❌ No suitable Gemini model available for generateContent');
                return {
                    success: false,
                    error: 'No suitable Gemini model available for generateContent'
                };
            }

            console.log(`🔧 Using Gemini model: ${this.modelName}`);

            const prompt = this.buildPrompt(messages, context);

            console.log('📤 Sending request to Gemini API (v1)...');
            const response = await this.client.post(`/models/${this.modelName}:generateContent`, {
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: prompt }]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1000
                }
            });

            const candidates = response.data.candidates || [];
            const text = candidates.length > 0
                ? (candidates[0].content?.parts || [])
                    .map(part => part.text || '')
                    .join(' ')
                    .trim()
                : '';

            console.log('✅ Gemini response received successfully');

            return {
                success: true,
                message: text || 'Gemini returned an empty response',
                usage: {
                    totalTokens: response.data.usageMetadata?.totalTokenCount || 0
                }
            };
        } catch (error) {
            const message = error.response?.data?.error?.message || error.message || 'Unknown Gemini error';
            console.error('❌ Gemini API Error:', message);

            if (error.response) {
                if (error.response.status === 404) {
                    console.log('🔄 Model not found, trying alternative model...');
                    return await this.tryAlternativeModel(messages, context);
                }

                if (error.response.status === 401 || error.response.status === 403) {
                    console.log('❌ Gemini API key or auth issue');
                    return {
                        success: false,
                        error: 'Invalid or unauthorized Gemini API key'
                    };
                }
            }

            return {
                success: false,
                error: message || 'Failed to generate Gemini response'
            };
        }
    }

    async tryAlternativeModel(messages, context) {
        try {
            if (!this.client) {
                console.log('❌ Gemini API not configured - missing API key');
                return {
                    success: false,
                    error: 'Gemini API not configured'
                };
            }

            console.log('🔄 Trying alternative Gemini models...');

            // Try different model names
            const alternativeModels = [
                'gemini-1.5-flash',
                'gemini-1.5-flash-latest',
                'gemini-1.0-pro',
                'gemini-pro'
            ];

            for (const modelName of alternativeModels) {
                try {
                    console.log(`🔧 Trying model: ${modelName}`);

                    const prompt = this.buildPrompt(messages, context);
                    const response = await this.client.post(`/models/${modelName}:generateContent`, {
                        contents: [
                            {
                                role: 'user',
                                parts: [{ text: prompt }]
                            }
                        ],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 1000
                        }
                    });

                    const candidates = response.data.candidates || [];
                    const text = candidates.length > 0
                        ? (candidates[0].content?.parts || [])
                            .map(part => part.text || '')
                            .join(' ')
                            .trim()
                        : '';

                    console.log(`✅ Success with model: ${modelName}`);
                    this.modelName = modelName; // Remember working model

                    return {
                        success: true,
                        message: text || 'Gemini returned an empty response',
                        usage: {
                            totalTokens: response.data.usageMetadata?.totalTokenCount || 0
                        }
                    };
                } catch (modelError) {
                    const msg = modelError.response?.data?.error?.message || modelError.message;
                    console.log(`❌ Model ${modelName} failed:`, msg);
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
            prompt += `PROCUREMENT CONTEXT (summary):\n`;
            if (procurementSummary.totalRequisitions > 0) {
                prompt += `- Total Requisitions: ${procurementSummary.totalRequisitions}\n`;
            }
            if (procurementSummary.pendingApprovalsCount > 0) {
                prompt += `- Pending Approvals Assigned To User: ${procurementSummary.pendingApprovalsCount}\n`;
            }
            if (procurementSummary.activeRFQsCount > 0) {
                prompt += `- Active RFQs (open or pending): ${procurementSummary.activeRFQsCount}\n`;
            }
            if (typeof procurementSummary.recommendedVendorsCount === 'number' && procurementSummary.recommendedVendorsCount > 0) {
                prompt += `- Recommended Vendors: ${procurementSummary.recommendedVendorsCount}\n`;
            }
            if (typeof procurementSummary.myRequisitionsCount === 'number' && procurementSummary.myRequisitionsCount > 0) {
                prompt += `- Recent Requisitions Created By User: ${procurementSummary.myRequisitionsCount}\n`;
            }
            prompt += '\n';
        }

        // Add structured procurement detail block for the model
        if (context.procurementData) {
            prompt += `DETAILED PROCUREMENT DATA (for grounding):\n`;
            prompt += this.formatProcurementData(context.procurementData) + '\n\n';
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
            formattedData += `• Pending Approvals Assigned To User: ${summary.pendingApprovalsCount}\n`;
        }
        if (summary.activeRFQsCount > 0) {
            formattedData += `• Active RFQs (open or pending): ${summary.activeRFQsCount}\n`;
        }
        if (summary.recommendedVendorsCount > 0) {
            formattedData += `• Recommended Vendors: ${summary.recommendedVendorsCount}\n`;
        }
        if (summary.myRequisitionsCount > 0) {
            formattedData += `• Recent Requisitions Created By User: ${summary.myRequisitionsCount}\n`;
        }

        // Add detailed requisition information when available
        if (procurementData.myRequisitions && procurementData.myRequisitions.length > 0) {
            formattedData += `\nRecent Requisitions:\n`;
            procurementData.myRequisitions.forEach(req => {
                const employeeName = req.employee
                    ? `${req.employee.firstName || ''} ${req.employee.lastName || ''}`.trim()
                    : 'Unknown employee';
                const cost = typeof req.estimatedCost === 'number'
                    ? req.estimatedCost.toFixed(2)
                    : 'N/A';
                formattedData += `- ${req.itemName || 'Requisition'} | Cost: ${cost} | Status: ${req.status || 'unknown'} | Urgency: ${req.urgency || 'medium'} | Employee: ${employeeName}\n`;
            });
        }

        if (procurementData.recommendedVendors && procurementData.recommendedVendors.length > 0) {
            formattedData += `\nTop Vendors:\n`;
            procurementData.recommendedVendors.forEach(vendor => {
                const rating = typeof vendor.rating === 'number' ? vendor.rating.toFixed(1) : 'N/A';
                const categories = Array.isArray(vendor.categories) && vendor.categories.length > 0
                    ? vendor.categories.join(', ')
                    : 'Unspecified categories';
                const description = vendor.businessDescription || 'No description provided';
                formattedData += `- ${vendor.name || 'Vendor'} | Rating: ${rating}/5 | Categories: ${categories} | ${description}\n`;
            });
        }

        return formattedData || "No specific procurement data available.";
    }

    async checkStatus() {
        try {
            if (!this.client) {
                console.log('❌ Gemini not configured');
                return false;
            }

            console.log('🔍 Checking Gemini API status...');

            const hasModel = await this.ensureModel();
            if (!hasModel) {
                console.log('❌ No suitable Gemini model available during status check');
                return false;
            }

            const modelName = this.modelName;
            let apiReachable = false;

            try {
                const response = await this.client.post(`/models/${modelName}:generateContent`, {
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: 'Say "online"' }]
                        }
                    ],
                    generationConfig: {
                        maxOutputTokens: 10,
                        temperature: 0.1
                    }
                });

                if (response.status === 200) {
                    console.log(`✅ Gemini status check passed with model: ${modelName}`);
                    return true;
                }
            } catch (error) {
                if (error.response) {
                    apiReachable = true; // Service responded, even if with an error status
                    const msg = error.response.data?.error?.message || error.message;
                    console.log(`❌ Gemini status check failed for model ${modelName}:`, msg);
                } else if (error.request) {
                    console.log(`❌ Gemini status check failed with no response (network issue)`);
                } else {
                    console.log(`❌ Gemini status check configuration error:`, error.message);
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
}

const geminiService = new GeminiService();
module.exports = { geminiService };