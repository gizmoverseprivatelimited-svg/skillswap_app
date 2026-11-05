const mongoose = require('mongoose');
const {
  ResourceTypes,
  SkillCategories,
  SkillLevels
} = require('../constants/enums');

const ResourceSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    type: { type: String, enum: ResourceTypes },

    url: String,
    coverImageUrl: String,

    categories: [{ type: String, enum: SkillCategories }],

    contributorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    contributorName: String,
    contributorAvatarUrl: String,

    difficulty: {
      type: String,
      enum: [...SkillLevels, 'All Levels']
    },

    durationMinutes: Number,
    formatBadge: String,

    publishedAt: Date,

    endorsements: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },

    tags: [String]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resource', ResourceSchema);
