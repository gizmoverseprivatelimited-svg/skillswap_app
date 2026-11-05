const mongoose = require('mongoose');

const pointTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['earned', 'redeemed'],
      required: true,
    },
    source: {
      type: String,
      enum: [
        'swap_completed',
        'class_taught',
        'monthly_subscription',
        'monthly_subscription_autodebit',
        'monthly_subscription_payout',
        'bonus',
        'referral',
        'admin_adjustment',
        'payout',
        'learner_bonus',
        'top_up',
        'purchase',
      ],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    swapId: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PointTransaction', pointTransactionSchema);
