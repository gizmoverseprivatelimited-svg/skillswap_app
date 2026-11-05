const mongoose = require('mongoose');
const { VerificationStatuses } = require('../constants/enums');

const UserVerificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    identity: {
      status: { type: String, enum: VerificationStatuses, default: 'none' },
      submittedAt: Date,
      verifiedAt: Date,
      reviewedBy: String,
      rejectionReason: String,
      document: {
        type: {
          type: String,
          enum: ['passport', 'drivers_license', 'national_id', 'other']
        },
        frontImageUrl: String,
        backImageUrl: String,
        submittedAt: Date
      }
    },

    email: {
      status: { type: String, enum: VerificationStatuses, default: 'none' },
      verifiedAt: Date
    },

    phone: {
      status: { type: String, enum: VerificationStatuses, default: 'none' },
      phoneNumber: String,
      verifiedAt: Date
    },

    linkedIn: {
      status: { type: String, enum: VerificationStatuses, default: 'none' },
      linkedInUrl: String,
      verifiedAt: Date,
      profileData: {
        name: String,
        headline: String,
        profilePictureUrl: String
      }
    },

    portfolio: {
      status: { type: String, enum: VerificationStatuses, default: 'none' },
      portfolioUrl: String,
      verifiedAt: Date
    },

    skillBadges: [
      {
        skillId: { type: mongoose.Schema.Types.ObjectId, ref: 'Skill' },
        skillTitle: String,
        badgeType: {
          type: String,
          enum: ['verified', 'expert', 'endorsed']
        },
        issuedAt: Date,
        issuerName: String,
        endorsementCount: Number
      }
    ],

    trustScore: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserVerification', UserVerificationSchema);
