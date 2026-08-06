import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { updateUser } from '../../../lib/user-store';

export const spendCreditsSchema = z.object({
  amount: z.number().min(1),
  reason: z.string(),
});

export const spendCreditsProcedure = protectedProcedure
  .input(spendCreditsSchema)
  .mutation(async ({ ctx, input }) => {
    console.log('[Credits] Spending credits:', {
      userId: ctx.user.id,
      amount: input.amount,
      reason: input.reason,
    });

    if (ctx.user.credits < input.amount) {
      throw new Error('Insufficient credits');
    }

    const newCredits = ctx.user.credits - input.amount;
    const updatedUser = updateUser(ctx.user.id, { credits: newCredits });

    if (!updatedUser) {
      throw new Error('Failed to update user credits');
    }

    return {
      success: true,
      newBalance: updatedUser.credits,
      spent: input.amount,
    };
  });
