import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { updateUser, type PremiumTier } from '../../../lib/user-store';

export const purchasePremiumSchema = z.object({
  tier: z.enum(['basic', 'premium', 'elite']),
  duration: z.enum(['monthly', 'yearly']),
});

const premiumPrices = {
  basic: { monthly: 9.99, yearly: 99.99 },
  premium: { monthly: 19.99, yearly: 199.99 },
  elite: { monthly: 49.99, yearly: 499.99 },
};

const premiumBenefits = {
  basic: {
    monthlyCredits: 30,
    features: ['Priority matching', 'Ad-free experience', 'Basic analytics'],
  },
  premium: {
    monthlyCredits: 80,
    features: ['All Basic features', 'Unlimited swaps', 'Advanced matching', 'Video calls'],
  },
  elite: {
    monthlyCredits: 200,
    features: ['All Premium features', 'Concierge support', 'Exclusive events', 'Expert badge'],
  },
};

export const purchasePremiumProcedure = protectedProcedure
  .input(purchasePremiumSchema)
  .mutation(async ({ ctx, input }) => {
    const price = premiumPrices[input.tier][input.duration];
    const benefits = premiumBenefits[input.tier];
    
    console.log('[Credits] Purchasing premium:', {
      userId: ctx.user.id,
      tier: input.tier,
      duration: input.duration,
      price,
    });

    const now = Date.now();
    const durationMs = input.duration === 'monthly' ? 30 * 24 * 60 * 60 * 1000 : 365 * 24 * 60 * 60 * 1000;
    const expiresAt = now + durationMs;
    const newCredits = ctx.user.credits + benefits.monthlyCredits;

    const updatedUser = updateUser(ctx.user.id, {
      premiumTier: input.tier as PremiumTier,
      premiumExpiresAt: expiresAt,
      credits: newCredits,
    });

    if (!updatedUser) {
      throw new Error('Failed to update user premium status');
    }

    return {
      success: true,
      tier: updatedUser.premiumTier,
      expiresAt: updatedUser.premiumExpiresAt,
      creditsAdded: benefits.monthlyCredits,
      newBalance: updatedUser.credits,
    };
  });
