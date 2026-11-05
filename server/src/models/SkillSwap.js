const mongoose = require('mongoose');
const {
  SwapStatuses,
  SwapResponseStatuses,
  SwapTypes
} = require('../constants/enums');

const SwapTimeProposalSchema = new mongoose.Schema(
  {
    proposedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    startISO: Date,
    endISO: Date,
    status: {
      type: String,
      enum: SwapResponseStatuses,
      default: 'pending'
    }
  },
  { _id: true }
);

const SwapMessageSchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    body: String,
    isSystem: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const SkillSwapSchema = new mongoose.Schema(
  {
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requesterSkillId: { type: mongoose.Schema.Types.ObjectId, ref: 'Skill', default: null },

    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recipientSkillId: { type: mongoose.Schema.Types.ObjectId, ref: 'Skill' },

    swapType: {
      type: String,
      enum: SwapTypes,
      default: 'swap'
    },
    recipientPaid: { type: Boolean, default: false },

    status: {
      type: String,
      enum: SwapStatuses,
      default: 'pending'
    },

    locationPreference: { type: String },

    proposedTimes: [SwapTimeProposalSchema],
    acceptedTimeId: mongoose.Schema.Types.ObjectId,

    negotiationNotes: [SwapMessageSchema],

    calendarEventId: String,
    hmsRoomId: String,
    lastAutoDebitedAt: { type: Date, default: null },
    recordings: [{
      url: String,
      recordedAt: Date,
      duration: Number
    }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('SkillSwap', SkillSwapSchema);
