import type { PayoutMethod, Skill, SkillWithUser, User, EarningRule } from '@/types';

// ============================================================
//  LearnSwap Credit System — Single Source of Truth
//  1 Credit = ₹1 face value (for spending and store credit)
// ============================================================

/** Face value: 1 credit = ₹1 when spending or using as store credit */
export const CREDIT_FACE_VALUE = 1;

/** Platform commission on paid sessions — 20% goes to the platform */
export const PLATFORM_COMMISSION_RATE = 0.20;

/** Free-tier users pay a small platform fee per swap request */
export const FREE_TIER_PLATFORM_FEE = 3;
export const PREMIUM_TIER_PLATFORM_FEE = 0;

/** Minimum payout in credits */
export const MIN_PAYOUT_CREDITS = 100;

// --- Payout conversion rates (credits → real INR) ---
export const PAYOUT_RATES: Record<PayoutMethod, number> = {
  store_credit: 1.0,    // 1 credit = ₹1 store credit (no fee)
  upi: 0.80,            // 1 credit = ₹0.80 real money
  bank_transfer: 0.80,  // 1 credit = ₹0.80 real money
  paypal: 0.75,         // 1 credit = ₹0.75 (higher intl. processing fee)
};

// --- Teacher earning rates (in credits) ---
export const TEACHER_EARNINGS = {
  /** Credits awarded for teaching a free swap session (platform-sponsored) */
  freeClassBonus: 50,
  /** Monthly bonus for premium subscribers */
  monthlySubBonus: 200,
  /** Bonus per 5-star review received */
  fiveStarBonus: 25,
  /** Referral reward when invitee completes first swap */
  referral: 100,
} as const;

/** Learner earns a small bonus for completing a swap */
export const LEARNER_SWAP_COMPLETION_BONUS = 10;

// --- Earning rules for display in the earnings dashboard ---
export const EARNING_RULES: EarningRule[] = [
  {
    source: 'class_taught',
    label: 'Per Class Taught',
    points: TEACHER_EARNINGS.freeClassBonus,
    description: 'Teach a free swap session → 50 credits. Paid sessions → 80% of session price (20% platform fee).',
  },
  {
    source: 'monthly_subscription',
    label: 'Monthly Subscription Bonus',
    points: TEACHER_EARNINGS.monthlySubBonus,
    description: 'Premium subscribers receive 200 bonus credits on the 1st of each month.',
  },
  {
    source: 'bonus',
    label: '5-Star Review Bonus',
    points: TEACHER_EARNINGS.fiveStarBonus,
    description: 'Earn 25 bonus credits for every 5-star review you receive.',
  },
  {
    source: 'referral',
    label: 'Referral Reward',
    points: TEACHER_EARNINGS.referral,
    description: 'Invite a friend who completes their first swap → 100 credits.',
  },
];

// --- Credit packages for purchase (real money → credits) ---
export interface CreditPackage {
  id: string;
  credits: number;
  bonusCredits: number;
  priceRupees: number;
  popular: boolean;
  label: string;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'starter',     credits: 25,  bonusCredits: 0,  priceRupees: 29,  popular: false, label: 'Starter' },
  { id: 'popular',     credits: 60,  bonusCredits: 5,  priceRupees: 59,  popular: true,  label: 'Popular' },
  { id: 'best_value',  credits: 150, bonusCredits: 20, priceRupees: 129, popular: false, label: 'Best Value' },
  { id: 'mega',        credits: 400, bonusCredits: 80, priceRupees: 299, popular: false, label: 'Mega Pack' },
];

// ============================================================
//  Helper Functions
// ============================================================

/** Get the credit cost of a single session for a skill */
export function getSessionCreditCost(skill: Pick<Skill, 'pricingModel' | 'pricePerSession' | 'monthlyPrice'>): number {
  if (!skill.pricingModel || skill.pricingModel === 'free') return 0;
  if (skill.pricingModel === 'per_session') return skill.pricePerSession ?? 0;
  if (skill.pricingModel === 'monthly') return skill.monthlyPrice ?? 0;
  return 0;
}

/** Get the pricing model label for display */
export function getPricingLabel(skill: Pick<Skill, 'pricingModel'>): string {
  if (!skill.pricingModel || skill.pricingModel === 'free') return 'Free — Skill Exchange';
  if (skill.pricingModel === 'per_session') return 'Per Session';
  return 'Monthly Subscription';
}

/** Get platform fee based on user's premium tier */
export function getPlatformFee(user: Pick<User, 'premiumTier'>): number {
  return user.premiumTier === 'free' ? FREE_TIER_PLATFORM_FEE : PREMIUM_TIER_PLATFORM_FEE;
}

/** Total upfront cost to request a swap (session cost + platform fee) */
export function getSwapRequestCost(skill: SkillWithUser, user: Pick<User, 'premiumTier'>): number {
  return getPlatformFee(user);
}

/** Cost charged at swap completion (session price only, platform fee already paid at request) */
export function getSwapCompletionCost(skill: SkillWithUser): number {
  return getSessionCreditCost(skill);
}

/** Calculate teacher earnings for a paid session (after 20% platform commission) */
export function getTeacherSessionEarnings(sessionCredits: number): number {
  if (sessionCredits <= 0) return TEACHER_EARNINGS.freeClassBonus;
  return Math.round(sessionCredits * (1 - PLATFORM_COMMISSION_RATE));
}

/** Convert credits to INR for a given payout method */
export function creditsToRupees(credits: number, method: PayoutMethod = 'store_credit'): number {
  const rate = PAYOUT_RATES[method] ?? 1.0;
  return Math.round(credits * rate * 100) / 100;
}

/** Get the per-credit INR rate for a payout method (for display) */
export function getPayoutRate(method: PayoutMethod): number {
  return PAYOUT_RATES[method] ?? 1.0;
}

/** Format credits as a display string */
export function formatCredits(amount: number): string {
  return `${amount.toLocaleString('en-IN')} credit${amount === 1 ? '' : 's'}`;
}
