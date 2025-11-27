const { Conversation, Message } = require('../../models/aiChat');
const { aiServiceManager } = require('../services/aiServiceManager');
const { contextBuilderService } = require('../services/contextBuilderService');

exports.processMessage = async (req, res) => {
  try {
    const { message } = req.body;
    
    console.log('💬 Processing AI message:', message);
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required - no user ID found'
      });
    }

    const userId = req.user._id;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Get or create conversation
    let conversation = await Conversation.findOne({ userId })
      .populate('messages');
    
    if (!conversation) {
      conversation = new Conversation({ 
        userId, 
        messages: [] 
      });
    }

    // Add user message to conversation
    const userMessage = new Message({
      userId: userId,
      text: message,
      sender: 'user'
    });

    await userMessage.save();
    conversation.messages.push(userMessage);
    conversation.lastActive = new Date();

    // Build context for AI response
    const context = await contextBuilderService.buildUserContext(userId, message);

    // Generate AI response using the service manager
    const aiResponse = await aiServiceManager.generateResponse(
      conversation.messages.map(msg => ({
        sender: msg.sender,
        text: msg.text
      })),
      context
    );

    // Add AI response to conversation
    const aiMessage = new Message({
      userId: userId,
      text: aiResponse.message,
      sender: 'ai',
      metadata: {
        ...(context.procurementData ? exports.summarizeContext(context.procurementData) : {}),
        aiProvider: aiResponse.provider || 'unknown'
      }
    });

    await aiMessage.save();
    conversation.messages.push(aiMessage);
    await conversation.save();

    // Emit real-time update via Socket.IO
    if (req.io) {
      req.io.to(`user-${userId}`).emit('ai-chat-update', {
        type: 'new_message',
        message: aiMessage
      });
    }

    // Format response to match frontend expectations
    res.json({
      success: true,
      data: {
        response: aiResponse.message,
        metadata: {
          ...(context.procurementData ? exports.summarizeContext(context.procurementData) : {}),
          aiProvider: aiResponse.provider || 'unknown'
        }
      }
    });

  } catch (error) {
    console.error('❌ AI Chat processing error:', error);
    
    // Use service manager fallback for general errors too
    const fallbackResponse = aiServiceManager.getFallbackResponse(
      [{ text: req.body?.message || '', sender: 'user' }],
      {}
    );
    
    res.status(500).json({
      success: false,
      error: 'Failed to process message',
      data: {
        response: fallbackResponse.message
      }
    });
  }
};
exports.getConversationHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const conversation = await Conversation.findOne({ userId })
      .populate('messages')
      .sort({ 'messages.createdAt': 1 }); // Chronological order

    if (!conversation || conversation.messages.length === 0) {
      return res.json({
        success: true,
        data: {
          messages: []
        }
      });
    }

    // Format messages to match frontend expectations
    const formattedMessages = conversation.messages.map(msg => ({
      id: msg._id,
      text: msg.text,
      sender: msg.sender,
      timestamp: msg.createdAt.toISOString(),
      metadata: msg.metadata || {}
    }));

    res.json({
      success: true,
      data: {
        messages: formattedMessages
      }
    });

  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation history'
    });
  }
};

exports.getSuggestions = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const context = await contextBuilderService.buildUserContext(userId, 'suggestions');
    
    res.json({
      success: true,
      data: {
        suggestions: context.suggestions || []
      }
    });

  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch suggestions'
    });
  }
};

exports.getAIStatus = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const userId = req.user._id;
    
    // Check all AI services status
    const status = await aiServiceManager.checkServiceStatus();
    
    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('AI status check error:', error);
    res.json({
      success: true,
      data: { 
        overall: 'offline',
        onlineServices: 0,
        totalServices: 2,
        error: error.message
      }
    });
  }
};
exports.clearConversation = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find and delete all messages for this user
    await Message.deleteMany({ userId });
    
    // Delete the conversation
    await Conversation.findOneAndDelete({ userId });
    
    res.json({
      success: true,
      data: {
        message: 'Conversation cleared successfully'
      }
    });

  } catch (error) {
    console.error('Clear conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear conversation'
    });
  }
};

exports.summarizeContext = (procurementData) => {
  if (!procurementData) return {};
  
  const summary = {};
  
  if (procurementData.requisitionStats) {
    summary.requisitions = procurementData.requisitionStats.length;
  }
  
  if (procurementData.pendingApprovals) {
    summary.pendingApprovals = procurementData.pendingApprovals.length;
  }
  
  if (procurementData.activeRFQs) {
    summary.activeRFQs = procurementData.activeRFQs.length;
  }
  
  if (procurementData.recommendedVendors) {
    summary.recommendedVendors = procurementData.recommendedVendors.length;
  }

  return summary;
};

exports.getFallbackResponse = (userMessage) => {
  if (!userMessage) {
    return "I'm here to help with procurement tasks. You can ask about requisitions, approvals, vendors, RFQs, or reports.";
  }

  // Simple fallback responses when AI service is down
  const fallbacks = {
    'requisition': "I can help you create or track requisitions. Please go to the Requisitions section in the main menu.",
    'approval': "Check your approval queue in the Approvals section. I can help prioritize urgent items.",
    'vendor': "Vendor information is available in the Vendor Management section. I can recommend top performers.",
    'rfq': "RFQ management is in the Bidding section. You can create new RFQs or track existing ones.",
    'report': "Reports are generated in the Analytics section. Common reports include spend analysis and vendor performance.",
    'order': "Purchase orders can be managed in the Orders section. You can track order status and delivery timelines.",
    'contract': "Contract management is handled in the Contracts section. I can help with contract renewals and compliance."
  };

  const message = userMessage.toLowerCase();
  for (const [key, response] of Object.entries(fallbacks)) {
    if (message.includes(key)) {
      return response;
    }
  }

  return "I'm here to help with procurement tasks. You can ask about requisitions, approvals, vendors, RFQs, or reports.";
};