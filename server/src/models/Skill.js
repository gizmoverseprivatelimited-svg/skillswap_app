const mongoose = require('mongoose');
const { SkillCategories, SkillLevels } = require('../constants/enums');

const SkillSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, required: true },
    subCategory: { type: String },
    description: { type: String },
    level: { type: String, enum: SkillLevels, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    imageUrl: { type: String },
    pricingModel: { type: String, enum: ['free', 'per_session', 'monthly'], default: 'free' },
    pricePerSession: { type: Number },
    monthlyPrice: { type: Number },
    promoted: { type: Boolean, default: false },
    promoTagline: { type: String },
    certificateUri: { type: String },
    certificateStatus: { type: String, enum: ['pending', 'approved', 'rejected'] },
    certificateReviewNote: { type: String },
    certificateReviewedAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Skill', SkillSchema);
