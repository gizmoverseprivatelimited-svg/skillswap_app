const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema(
  {
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    revieweeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    rating: { type: Number, min: 1, max: 5 },
    comment: String,

    skillId: { type: mongoose.Schema.Types.ObjectId, ref: 'Skill' },

    flaggedAt: Date,
    flagReason: String,
    flagReporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    moderatedAt: Date,
    moderationNote: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Review', ReviewSchema);
