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
  | 'Competitive Exams';

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
}

export type PremiumTier = 'free' | 'basic' | 'premium' | 'elite';

export interface User {
  id: string;
  name: string;
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
  status: SkillSwapStatus;
  locationPreference: string | null;
  createdAt: string;
  updatedAt: string;
  proposedTimes: SwapTimeProposal[];
  acceptedTimeId?: string;
  negotiationNotes: SwapMessage[];
  calendarEventId?: string;
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
