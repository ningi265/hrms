// models/Bid.js
const mongoose = require('mongoose');
const Tenders = require('./tenders');
const Vendor = require('./vendor');

const bidSchema = new mongoose.Schema({
   technicalScore: {
    type: Number,
    min: 0,
    max: 100
  },
  financialScore: {
    type: Number,
    min: 0,
    max: 100
  },
  totalScore: {
    type: Number,
    min: 0,
    max: 100
  },
  evaluationComments: String,
  recommendation: {
    type: String,
    enum: ['award', 'shortlist', 'reject', '']
  },
  awardedAt: Date,
  tender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenders',
    required: true
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  bidAmount: {
    type: Number,
    default: 0
  },
  proposal: {
    type: String,
    default: ""
  },
  documents: [
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    filePath: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    size: { type: Number },
  }
],
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'technical_evaluation', 'financial_evaluation', 'awarded', 'rejected'],
    default: 'draft'
  },
  submittedAt: Date,
  evaluatedAt: Date,
  awardedAt: Date,
  notes: String
}, {
  timestamps: true
});

// Compound index to ensure one bid per vendor per tender
bidSchema.index({ tender: 1, vendor: 1 }, { unique: true });

module.exports = mongoose.model('Bid', bidSchema);