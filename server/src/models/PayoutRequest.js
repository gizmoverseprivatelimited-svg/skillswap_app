const mongoose = require('mongoose');

const payoutRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userAvatar: {
      type: String,
      default: '',
    },
    points: {
      type: Number,
      required: true,
    },
    credits: {
      type: Number,
      default: 0,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    method: {
      type: String,
      enum: ['store_credit', 'bank_transfer', 'upi', 'paypal'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'processing', 'completed', 'rejected', 'cancelled'],
      default: 'pending',
    },
    payoutDetails: {
      type: Object,
      default: {},
    },
    reviewedBy: {
      type: String,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    transactionRef: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PayoutRequest', payoutRequestSchema);
