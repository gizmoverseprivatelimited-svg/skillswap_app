import { nanoid } from 'nanoid';
import type { UserVerifications, IdentityVerification, EmailVerification, PhoneVerification, LinkedInVerification, PortfolioVerification, SkillBadge } from '../../types';

export type PremiumTier = 'free' | 'basic' | 'premium' | 'elite';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  passwordHash?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  skillsToLearn: string[];
  skillsToTeach: string[];
  createdAt: number;
  authProvider?: 'email' | 'google' | 'apple';
  providerId?: string;
  credits: number;
  premiumTier: PremiumTier;
  premiumExpiresAt?: number;
  verifications?: UserVerifications;
}

interface UserStore {
  [id: string]: AuthUser;
}

const users: UserStore = {};
const emailIndex: { [email: string]: string } = {};
const providerIndex: { [key: string]: string } = {};
const verifications: { [userId: string]: UserVerifications } = {};

export function createUser(data: {
  email: string;
  name: string;
  passwordHash?: string;
  authProvider?: 'email' | 'google' | 'apple';
  providerId?: string;
  avatar?: string;
}): AuthUser {
  const id = nanoid();
  const user: AuthUser = {
    id,
    email: data.email.toLowerCase(),
    name: data.name,
    passwordHash: data.passwordHash,
    authProvider: data.authProvider || 'email',
    providerId: data.providerId,
    avatar: data.avatar,
    skillsToLearn: [],
    skillsToTeach: [],
    createdAt: Date.now(),
    credits: 10,
    premiumTier: 'free',
  };
  
  users[id] = user;
  emailIndex[user.email] = id;
  
  if (data.authProvider && data.providerId) {
    const providerKey = `${data.authProvider}:${data.providerId}`;
    providerIndex[providerKey] = id;
  }
  
  console.log('[UserStore] Created user:', id, user.email);
  return user;
}

export function getUserById(id: string): AuthUser | null {
  return users[id] || null;
}

export function getUserByEmail(email: string): AuthUser | null {
  const id = emailIndex[email.toLowerCase()];
  return id ? users[id] : null;
}

export function getUserByProvider(provider: 'google' | 'apple', providerId: string): AuthUser | null {
  const providerKey = `${provider}:${providerId}`;
  const id = providerIndex[providerKey];
  return id ? users[id] : null;
}

export function updateUser(id: string, data: Partial<AuthUser>): AuthUser | null {
  const user = users[id];
  if (!user) {
    console.error('[UserStore] User not found:', id);
    return null;
  }
  
  Object.assign(user, data);
  console.log('[UserStore] Updated user:', id);
  return user;
}

export function getAllUsers(): AuthUser[] {
  return Object.values(users);
}

export function getUserVerifications(userId: string): UserVerifications {
  if (!verifications[userId]) {
    verifications[userId] = {
      userId,
      identity: { status: 'none' },
      email: { status: 'none' },
      phone: { status: 'none' },
      linkedIn: { status: 'none' },
      portfolio: { status: 'none' },
      skillBadges: [],
      trustScore: 0,
    };
  }
  return verifications[userId];
}

export function updateUserVerifications(
  userId: string,
  updates: Partial<UserVerifications>
): UserVerifications {
  const current = getUserVerifications(userId);
  Object.assign(current, updates);
  
  current.trustScore = calculateTrustScore(current);
  console.log('[UserStore] Updated verifications for user:', userId, 'trustScore:', current.trustScore);
  return current;
}

function calculateTrustScore(verifications: UserVerifications): number {
  let score = 0;
  
  if (verifications.identity.status === 'verified') score += 30;
  if (verifications.email.status === 'verified') score += 10;
  if (verifications.phone.status === 'verified') score += 10;
  if (verifications.linkedIn.status === 'verified') score += 20;
  if (verifications.portfolio.status === 'verified') score += 15;
  
  const badgeScore = Math.min(15, verifications.skillBadges.length * 3);
  score += badgeScore;
  
  return Math.min(100, score);
}

export function submitIdentityVerification(
  userId: string,
  document: {
    type: 'passport' | 'drivers_license' | 'national_id' | 'other';
    frontImageUrl: string;
    backImageUrl?: string;
  }
): UserVerifications {
  getUserVerifications(userId);
  const docId = nanoid();
  
  const identityVerification: IdentityVerification = {
    status: 'pending',
    submittedAt: new Date().toISOString(),
    document: {
      id: docId,
      ...document,
      submittedAt: new Date().toISOString(),
    },
  };
  
  return updateUserVerifications(userId, {
    identity: identityVerification,
  });
}

export function verifyIdentity(
  userId: string,
  approved: boolean,
  reviewerId: string,
  rejectionReason?: string
): UserVerifications {
  const current = getUserVerifications(userId);
  
  const identityVerification: IdentityVerification = {
    ...current.identity,
    status: approved ? 'verified' : 'rejected',
    verifiedAt: approved ? new Date().toISOString() : undefined,
    reviewedBy: reviewerId,
    rejectionReason: approved ? undefined : rejectionReason,
  };
  
  return updateUserVerifications(userId, {
    identity: identityVerification,
  });
}

export function verifyEmail(userId: string): UserVerifications {
  const emailVerification: EmailVerification = {
    status: 'verified',
    verifiedAt: new Date().toISOString(),
  };
  
  return updateUserVerifications(userId, {
    email: emailVerification,
  });
}

export function verifyPhone(
  userId: string,
  phoneNumber: string
): UserVerifications {
  const phoneVerification: PhoneVerification = {
    status: 'verified',
    phoneNumber,
    verifiedAt: new Date().toISOString(),
  };
  
  return updateUserVerifications(userId, {
    phone: phoneVerification,
  });
}

export function verifyLinkedIn(
  userId: string,
  linkedInUrl: string,
  profileData?: {
    name: string;
    headline?: string;
    profilePictureUrl?: string;
  }
): UserVerifications {
  const linkedInVerification: LinkedInVerification = {
    status: 'verified',
    linkedInUrl,
    profileData,
    verifiedAt: new Date().toISOString(),
  };
  
  return updateUserVerifications(userId, {
    linkedIn: linkedInVerification,
  });
}

export function verifyPortfolio(
  userId: string,
  portfolioUrl: string
): UserVerifications {
  const portfolioVerification: PortfolioVerification = {
    status: 'verified',
    portfolioUrl,
    verifiedAt: new Date().toISOString(),
  };
  
  return updateUserVerifications(userId, {
    portfolio: portfolioVerification,
  });
}

export function addSkillBadge(
  userId: string,
  badge: Omit<SkillBadge, 'id' | 'issuedAt'>
): UserVerifications {
  const current = getUserVerifications(userId);
  const newBadge: SkillBadge = {
    id: nanoid(),
    ...badge,
    issuedAt: new Date().toISOString(),
  };
  
  return updateUserVerifications(userId, {
    skillBadges: [...current.skillBadges, newBadge],
  });
}

export function removeSkillBadge(
  userId: string,
  badgeId: string
): UserVerifications {
  const current = getUserVerifications(userId);
  
  return updateUserVerifications(userId, {
    skillBadges: current.skillBadges.filter((b) => b.id !== badgeId),
  });
}
