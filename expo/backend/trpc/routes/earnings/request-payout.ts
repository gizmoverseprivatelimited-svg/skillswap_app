import { z } from 'zod';
import { protectedProcedure } from '../../create-context';

export const requestPayoutSchema = z.object({
  points: z.number().int().positive(),
  method: z.enum(['store_credit', 'bank_transfer', 'upi', 'paypal']),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  upiId: z.string().optional(),
  paypalEmail: z.string().email().optional(),
});

export const requestPayoutProcedure = protectedProcedure
  .input(requestPayoutSchema)
  .mutation(async ({ ctx, input }) => {
    console.log('[Earnings] Payout request from user:', ctx.user.id, input);

    return {
      success: true,
      payoutId: `payout-${Date.now()}`,
      status: 'pending' as const,
      message: 'Your payout request has been submitted for review.',
    };
  });
