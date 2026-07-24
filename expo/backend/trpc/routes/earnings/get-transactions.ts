import { z } from 'zod';
import { protectedProcedure } from '../../create-context';

export const getTransactionsSchema = z.object({
  userId: z.string(),
});

export const getTransactionsProcedure = protectedProcedure
  .input(getTransactionsSchema)
  .query(async ({ ctx, input }) => {
    console.log('[Earnings] Fetching transactions for user:', input.userId);

    return [];
  });
