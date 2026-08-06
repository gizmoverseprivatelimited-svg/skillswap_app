import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { updateUser } from '../../../lib/user-store';

export const purchaseCreditsSchema = z.object({
  packageId: z.enum(['starter', 'popular', 'best_value', 'mega']),
});

const creditPackages = {
  starter: { credits: 25, price: 4.99 },
  popular: { credits: 60, price: 9.99 },
  best_value: { credits: 150, price: 19.99 },
  mega: { credits: 400, price: 49.99 },
};

export const purchaseCreditsProcedure = protectedProcedure
  .input(purchaseCreditsSchema)
  .mutation(async ({ ctx, input }) => {
    const pkg = creditPackages[input.packageId];
    
    console.log('[Credits] Purchasing credits:', {
      userId: ctx.user.id,
      package: input.packageId,
      credits: pkg.credits,
    });

    const newCredits = ctx.user.credits + pkg.credits;
    const updatedUser = updateUser(ctx.user.id, { credits: newCredits });

    if (!updatedUser) {
      throw new Error('Failed to update user credits');
    }

    return {
      success: true,
      newBalance: updatedUser.credits,
      creditsAdded: pkg.credits,
    };
  });
