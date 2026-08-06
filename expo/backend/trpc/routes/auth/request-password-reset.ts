import { publicProcedure } from '../../create-context';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { getUserByEmail } from '../../../lib/user-store';
import { storeResetToken } from '../../../lib/otp';

export const requestPasswordResetProcedure = publicProcedure
  .input(
    z.object({
      email: z.string().email(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[PasswordReset] Requesting reset for:', input.email);

    const user = getUserByEmail(input.email);
    if (!user) {
      console.log('[PasswordReset] User not found, returning success anyway');
      return {
        success: true,
        message: 'If an account exists, a reset link has been sent',
      };
    }

    if (user.authProvider !== 'email') {
      console.log('[PasswordReset] User uses OAuth provider');
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Please sign in with your OAuth provider',
      });
    }

    const resetToken = storeResetToken(user.id);
    console.log('[PasswordReset] Reset token generated:', resetToken);

    return {
      success: true,
      message: 'If an account exists, a reset link has been sent',
      devToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
    };
  });
