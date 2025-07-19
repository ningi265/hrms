// models/Plan.js
const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ['starter', 'professional', 'enterprise']
  },
  priceId: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'usd'
  },
  interval: {
    type: String,
    enum: ['month', 'year'],
    default: 'month'
  },
  features: {
    type: Map,
    of: Boolean
  },
  apiCallLimit: Number,
  storageLimit: Number, // in MB
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Plan', PlanSchema);