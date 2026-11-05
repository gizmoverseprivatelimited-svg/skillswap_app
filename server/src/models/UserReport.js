const mongoose = require('mongoose');

const UserReportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reportedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      enum: [
        'harassment',
        'inappropriate_content',
        'spam_or_scam',
        'fake_profile',
        'hate_speech',
        'threats',
        'other',
      ],
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'actioned', 'dismissed'],
      default: 'pending',
    },
    action: {
      type: String,
      enum: ['warning', 'suspend', 'ban', 'dismiss'],
    },
    adminNote: {
      type: String,
      trim: true,
    },
    reviewedAt: {
      type: Date,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('UserReport', UserReportSchema);
