import { protectedProcedure } from '../../create-context';

export const getBalanceProcedure = protectedProcedure.query(async ({ ctx }) => {
  console.log('[Credits] Getting balance for user:', ctx.user.id);
  
  return {
    credits: ctx.user.credits,
    premiumTier: ctx.user.premiumTier,
    premiumExpiresAt: ctx.user.premiumExpiresAt,
  };
});
