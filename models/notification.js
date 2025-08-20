// models/notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  travelRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'TravelRequest' },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sentTo: String,
  subject: String,
  message: String,
  amount: Number,
  currency: String,
  status: { type: String, enum: ['sent', 'failed'], default: 'sent' },
  sendGridResponse: Number,
  error: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);