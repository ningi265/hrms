const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        required: true
    },
    sender: {
        type: String,
        enum: ['user', 'ai'],
        required: true
    },
    context: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

const conversationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    messages: [messageSchema],
    context: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },
    lastActive: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

const Message = mongoose.model('Message', messageSchema);
const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = { Message, Conversation };