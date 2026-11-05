// const mongoose = require('mongoose');
// const { PremiumTiers } = require('../constants/enums');

// const UserSchema = new mongoose.Schema(
//   {
//     name: { type: String, required: true },
//     avatarUrl: { type: String },
//     bio: { type: String },
//     location: { type: String },

//     skillsOffered: [
//       { type: mongoose.Schema.Types.ObjectId, ref: 'Skill' }
//     ],
//     skillsWanted: [{ type: String }],

//     rating: { type: Number, default: 0 },
//     totalSwaps: { type: Number, default: 0 },

//     joinedDate: { type: Date, default: Date.now },

//     credits: { type: Number, default: 0 },

//     premiumTier: {
//       type: String,
//       enum: PremiumTiers,
//       default: 'free'
//     },
//     premiumExpiresAt: { type: Date }
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model('User', UserSchema);


const mongoose = require('mongoose');
const { PremiumTiers } = require('../constants/enums');

const UserSchema = new mongoose.Schema(
  {
    /* =======================
       AUTH FIELDS
    ======================= */
    email: {
      type: String,
      // required: true,
      // unique: true,
      lowercase: true,
      index: true,
    },

    password: {
      type: String, // hashed
    },

    phone: {
      type: String,
      index: true,
      sparse: true,
    },

    oauthProvider: {
      type: String, // 'google' | 'apple'
    },

    oauthProviderId: {
      type: String,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    isLinkedInVerified: {
      type: Boolean,
      default: false,
    },
    isIdentityVerified: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    linkedin: {
      type: String,
    },

    hasCompletedOnboarding: {
      type: Boolean,
      default: false,
    },

    /* =======================
       CORE PROFILE (PRIORITY)
    ======================= */
    name: {
      type: String,
      required: true,
    },

    username: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    avatarUrl: {
      type: String,
    },

    bio: {
      type: String,
    },

    location: {
      type: String,
    },

    joinedDate: {
      type: Date,
      default: Date.now,
    },

    /* =======================
       SKILLS
    ======================= */
    skillsOffered: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Skill',
      },
    ],

    skillsWanted: {
      type: [String],
      default: [],
    },

    /* =======================
       STATS & ECONOMY
    ======================= */
    banStatus: {
      type: String,
      default: 'active',
    },

    reportCount: {
      type: Number,
      default: 0,
    },

    banReason: String,
    bannedAt: Date,
    suspendedUntil: Date,
    daysSuspended: Number,

    rating: {
      type: Number,
      default: 0,
    },

    totalSwaps: {
      type: Number,
      default: 0,
    },

    credits: {
      type: Number,
      default: 0,
    },

    /* =======================
       PREMIUM
    ======================= */
    premiumTier: {
      type: String,
      enum: PremiumTiers, // ['free', 'basic', 'premium', 'elite']
      default: 'free',
    },

    premiumExpiresAt: {
      type: Date,
    },

    pushToken: {
      type: String,
    },

    /* =======================
       TEACHER PROFILE & CREDENTIALS
    ======================= */
    teacherProfile: {
      languages: {
        type: [String],
        default: [],
      },
      qualifications: {
        type: [String],
        default: [],
      },
      isCertified: {
        type: Boolean,
        default: false,
      },
      certifications: [
        {
          id: { type: String },
          title: { type: String, required: true },
          documentUri: { type: String },
          status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
          reviewNote: { type: String },
          reviewedAt: { type: Date },
        },
      ],
      yearsTeaching: {
        type: String,
        default: '',
      },
      careerHistory: [
        {
          id: { type: String },
          role: { type: String, required: true },
          organization: { type: String, default: '' },
          years: { type: String, default: '' },
        },
      ],
      privateTuition: {
        type: Boolean,
        default: false,
      },
    },

    /* =======================
       SAFETY & BLOCKING
    ======================= */
    blockedUsers: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        name: {
          type: String,
        },
        avatarUrl: {
          type: String,
        },
        blockedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', UserSchema);

