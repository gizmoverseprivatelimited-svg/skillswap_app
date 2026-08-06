export type SkillCategory =
  | 'Arts & Crafts'
  | 'Technology'
  | 'Fitness & Wellness'
  | 'Languages'
  | 'Music'
  | 'Cooking'
  | 'Business'
  | 'Photography'
  | 'Classical Arts'
  | 'Competitive Exams'
  | 'Other'
  | (string & {});

export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

export type ResourceType = 'Article' | 'Video' | 'Document' | 'Collection';

export interface Skill {
  id: string;
  _id?: string;
  title: string;
  category: SkillCategory;
  description: string;
  level: SkillLevel;
  userId: string;
  imageUrl: string;
  pricingModel?: PricingModel;
  pricePerSession?: number;
  monthlyPrice?: number;
  promoted?: boolean;
  promoTagline?: string;
}
export type OnboardingRole = 'teacher' | 'learner' | 'swap';
export type SwapType = 'teach' | 'learn' | 'swap';

export type PricingModel = 'free' | 'per_session' | 'monthly';

export type PremiumTier = 'free' | 'basic' | 'premium' | 'elite';

export interface User {
  id: string;
  name: string;
  username?: string;
  avatarUrl: string;
  bio: string;
  location: string;
  skillsOffered: Skill[];
  skillsWanted: string[];
  rating: number;
  totalSwaps: number;
  joinedDate: string;
  credits: number;
  premiumTier: PremiumTier;
  premiumExpiresAt?: string;
  banStatus?: string;
  reportCount?: number;
  email?:string;
  role?: OnboardingRole;
  hasCompletedOnboarding?: boolean;
}

export interface SkillWithUser extends Skill {
  user: User;
}

export interface MatchRecommendation {
  user: User;
  compatibility: number;
  youCanLearn: string[];
  theyCanLearn: string[];
  sharedInterests: string[];
  categoryMatches: SkillCategory[];
  primarySkill: string | null;
}

export interface ResourceMeta {
  id: string;
  _id?: string;
  title: string;
  description: string;
  type: ResourceType;
  url: string;
  coverImageUrl: string;
  categories: SkillCategory[];
  contributorId: string;
  contributorName: string;
  contributorAvatarUrl: string;
  difficulty: SkillLevel | 'All Levels';
  durationMinutes?: number;
  formatBadge?: string;
  publishedAt: string;
  endorsements: number;
  saves: number;
  tags: string[];
}

export type RatingBucket = 1 | 2 | 3 | 4 | 5;

export interface Review {
  id: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string;
  createdAt: string;
  skillId?: string;
  flaggedAt?: string | null;
  flagReason?: string | null;
  flagReporterId?: string | null;
}

export interface ReviewWithAuthor extends Review {
  reviewer: User;
}

export interface ReviewStats {
  revieweeId: string;
  averageRating: number;
  totalReviews: number;
  distribution: Record<RatingBucket, number>;
}

export interface ReviewsPayload {
  stats: ReviewStats;
  reviews: ReviewWithAuthor[];
}

export type SkillSwapStatus =
  | 'pending'
  | 'negotiating'
  | 'scheduled'
  | 'declined'
  | 'completed';

export type SwapResponseStatus = 'pending' | 'accepted' | 'declined';

export interface SwapTimeProposal {
  id: string;
  _id?: string;
  proposedById: string;
  startISO: string;
  endISO: string;
  status: SwapResponseStatus;
}

export interface SwapMessage {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  isSystem?: boolean;
}

export interface SkillSwapRequest {
  id: string;
  _id?: string;
  requesterId: string | undefined;
  requesterSkillId: string;
  recipientId: string;
  recipientSkillId: string;
  swapType: SwapType;
  status: SkillSwapStatus;
  locationPreference: string | null;
  createdAt: string;
  updatedAt: string;
  proposedTimes: SwapTimeProposal[];
  acceptedTimeId?: string;
  negotiationNotes: SwapMessage[];
  calendarEventId?: string;
  recipientPaid?: boolean;
  requesterPaid?: boolean;
  lastAutoDebitedAt?: string;
}

export type VerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';

export type VerificationType =
  | 'identity'
  | 'email'
  | 'phone'
  | 'linkedin'
  | 'portfolio';

export interface VerificationDocument {
  id: string;
  type: 'passport' | 'drivers_license' | 'national_id' | 'other';
  frontImageUrl: string;
  backImageUrl?: string;
  submittedAt: string;
}

export interface IdentityVerification {
  status: VerificationStatus;
  submittedAt?: string;
  verifiedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  document?: VerificationDocument;
}

export interface EmailVerification {
  status: VerificationStatus;
  verifiedAt?: string;
}

export interface PhoneVerification {
  status: VerificationStatus;
  phoneNumber?: string;
  verifiedAt?: string;
}

export interface LinkedInVerification {
  status: VerificationStatus;
  linkedInUrl?: string;
  verifiedAt?: string;
  profileData?: {
    name: string;
    headline?: string;
    profilePictureUrl?: string;
  };
}

export interface PortfolioVerification {
  status: VerificationStatus;
  portfolioUrl?: string;
  verifiedAt?: string;
}

export interface SkillBadge {
  id: string;
  skillId: string;
  skillTitle: string;
  badgeType: 'verified' | 'expert' | 'endorsed';
  issuedAt: string;
  issuerName?: string;
  endorsementCount?: number;
}

export interface UserVerifications {
  userId: string;
  identity: IdentityVerification;
  email: EmailVerification;
  phone: PhoneVerification;
  linkedIn: LinkedInVerification;
  portfolio: PortfolioVerification;
  skillBadges: SkillBadge[];
  trustScore: number;
}

export type EarningSourceType =
  | 'swap_completed'
  | 'class_taught'
  | 'monthly_subscription'
  | 'bonus'
  | 'referral'
  | 'admin_adjustment'
  | 'learner_bonus';

export type PayoutMethod = 'store_credit' | 'bank_transfer' | 'upi' | 'paypal';

export type PayoutStatus =
  | 'pending'
  | 'approved'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export interface PointTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'earned' | 'redeemed';
  source: EarningSourceType;
  description: string;
  swapId?: string;
  timestamp: string;
  createdAt?: string;
}

export interface PayoutRequest {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  points: number;
  credits?: number;
  amount: number;
  amountCurrency?: number;
  currency: string;
  method: PayoutMethod;
  status: PayoutStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  payoutDetails?: {
    storeCreditAccount?: string;
    accountName?: string;
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
    paypalEmail?: string;
  };
  processedAt?: string;
  transactionRef?: string;
}

export interface EarningsSummary {
  userId: string;
  totalEarnedPoints: number;
  totalPointsEarned?: number;
  availablePoints: number;
  availableCurrency?: number;
  pendingPoints?: number;
  totalPayouts: number;
  completedPayouts: number;
  pendingPayouts: number;
  lifetimePayouts?: number;
  currentMonthPoints: number;
  currentMonthClasses: number;
}

export interface EarningRule {
  source: EarningSourceType;
  label: string;
  points: number;
  description: string;
}
