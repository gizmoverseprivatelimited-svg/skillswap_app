const mongoose = require('mongoose');

const paymentOrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    cfOrderId: {
      type: String,
      default: null,
    },
    paymentSessionId: {
      type: String,
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    purchaseType: {
      type: String,
      enum: ['credits', 'premium'],
      required: true,
    },
    packageId: {
      type: String,
      default: null,
    },
    tier: {
      type: String,
      default: null,
    },
    duration: {
      type: String,
      enum: ['monthly', 'yearly', null],
      default: null,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'USER_DROPPED', 'CANCELLED', 'EXPIRED'],
      default: 'PENDING',
      index: true,
    },
    gateway: {
      type: String,
      default: 'cashfree',
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    subscriptionId: {
      type: String,
      default: null,
      index: true,
    },
    subReferenceId: {
      type: String,
      default: null,
    },
    planId: {
      type: String,
      default: null,
    },
    authLink: {
      type: String,
      default: null,
    },
    paymentDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    creditedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentOrder', paymentOrderSchema);

