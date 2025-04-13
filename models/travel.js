const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const TravelRequestSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  purpose: { type: String, required: true },
  departureDate: { type: Date, required: true },
  returnDate: { type: Date, required: true },
  location: { type: String, required: false },
  fundingCodes: { type: String, required: true },
  country: { type: String, required: false},
  currency: { type: String, required: false }, 
  reconciled:{type: Boolean, default: false},
  documents: [{
    name: String,  
    url: String   
  }],
  
  meansOfTravel: { 
    type: String, 
    enum: ['own', 'company', 'rental', 'public_transport','other'],
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'supervisor_approved', 'final_approved', 'rejected','pending_reconciliation', 'completed'],
    default: 'pending'
  },
  supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  supervisorApproval: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  supervisorComments: String,
  supervisorApprovalDate: Date,
  finalApprover: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  finalApproval: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  finalApproverComments: String,
  finalApprovalDate: Date,
  financeStatus: {
    type: String,
    enum: ['pending', 'processed', 'paid'],
    default: 'pending'
  },
  travelType: {
    type: String,
    enum: ['local', 'international'],
    default: 'local'
  },
  assignedDriver: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  fleetNotification: {
    sent: { type: Boolean, default: false },
    sentAt: Date,
    recipients: [{
      type: String,
      enum: ['employee', 'driver', 'manager']
    }],
    subject: String,
    message: String,
    includeItinerary: Boolean,
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  reconciliation: {
    submittedDate: Date,
    approvedDate: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    totalSpent: Number,
    remainingBalance: Number,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'pending_reconciliation'],
      default: 'pending'
    },
    notes: String,
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actualReturnDate: Date,  // Add this field to store the actual return date
    tripReport: String       // Add this field for the trip summary
  },
  payment: {
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    processedAt: Date,
    paymentMethod: String,
    perDiemRate: Number,
    perDiemAmount: Number,
    advanceAmount: Number,
    expenses: [{
      category: String,
      amount: Number,
      description: String
    }],
    totalAmount: Number,
    notes: String
  }
}, { timestamps: true });


TravelRequestSchema.plugin(mongoosePaginate);

const TravelRequest = mongoose.model('TravelRequest', TravelRequestSchema);

module.exports = TravelRequest;