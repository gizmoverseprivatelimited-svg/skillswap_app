const mongoose = require('mongoose');

const VerificationRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    type: {
      type: String,
      enum: ['identity', 'email', 'phone', 'linkedin', 'portfolio'],
      required: true,
    },

    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },

    details: String,
    documentUrl: String,

    moderatedAt: Date,
    moderationNote: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('VerificationRequest', VerificationRequestSchema);