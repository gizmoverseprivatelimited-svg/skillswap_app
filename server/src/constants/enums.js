const { MAIN_CATEGORIES } = require('./categories');

module.exports = {
  SkillCategories: MAIN_CATEGORIES,

  SkillLevels: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],

  ResourceTypes: ['Article', 'Video', 'Document', 'Collection'],

  PremiumTiers: ['free', 'basic', 'premium', 'elite', 'monthly', 'quarterly', 'yearly'],

  SwapStatuses: [
    'pending',
    'negotiating',
    'scheduled',
    'declined',
    'completed'
  ],

  SwapTypes: ['teach', 'learn', 'swap'],

  SwapResponseStatuses: ['pending', 'accepted', 'declined'],

  VerificationStatuses: ['none', 'pending', 'verified', 'rejected']
};
