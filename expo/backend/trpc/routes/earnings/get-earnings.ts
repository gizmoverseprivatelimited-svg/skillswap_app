import { z } from 'zod';
import { protectedProcedure } from '../../create-context';

export const getEarningsSchema = z.object({
  userId: z.string(),
});

export const getEarningsProcedure = protectedProcedure
  .input(getEarningsSchema)
  .query(async ({ ctx, input }) => {
    console.log('[Earnings] Fetching earnings for user:', input.userId);

    return {
      totalPointsEarned: 850,
      availablePoints: 420,
      pendingPoints: 100,
      lifetimePayouts: 8.6,
      currentMonthPoints: 150,
      currentMonthClasses: 3,
      userId: input.userId,
    };
  });
