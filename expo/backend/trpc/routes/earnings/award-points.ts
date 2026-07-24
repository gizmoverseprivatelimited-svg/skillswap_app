import { z } from 'zod';
import { protectedProcedure } from '../../create-context';

export const awardPointsSchema = z.object({
  userId: z.string(),
  amount: z.number().int().positive(),
  source: z.enum([
    'swap_completed',
    'class_taught',
    'monthly_subscription',
    'bonus',
    'referral',
    'admin_adjustment',
  ]),
  description: z.string(),
  swapId: z.string().optional(),
});

export const awardPointsProcedure = protectedProcedure
  .input(awardPointsSchema)
  .mutation(async ({ ctx, input }) => {
    console.log('[Earnings] Awarding points:', input);

    return {
      success: true,
      transactionId: `txn-${Date.now()}`,
      message: `${input.amount} points awarded.`,
    };
  });
