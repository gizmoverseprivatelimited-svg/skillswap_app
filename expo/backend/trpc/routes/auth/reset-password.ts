import { publicProcedure } from '../../create-context';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { verifyResetToken } from '../../../lib/otp';
import { updateUser, getUserById } from '../../../lib/user-store';
import { hashPassword } from '../../../lib/password';
import { signToken } from '../../../lib/jwt';

export const resetPasswordProcedure = publicProcedure
  .input(
    z.object({
      token: z.string(),
      newPassword: z.string().min(8),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[ResetPassword] Attempting password reset');

    const userId = verifyResetToken(input.token);
    if (!userId) {
      console.log('[ResetPassword] Invalid or expired token');
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired reset token',
      });
    }

    const user = getUserById(userId);
    if (!user) {
      console.log('[ResetPassword] User not found:', userId);
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    const passwordHash = await hashPassword(input.newPassword);
    updateUser(userId, { passwordHash });

    const token = signToken({
      userId: user.id,
      email: user.email,
    });

    console.log('[ResetPassword] Password reset successful:', userId);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        bio: user.bio,
        location: user.location,
        skillsToLearn: user.skillsToLearn,
        skillsToTeach: user.skillsToTeach,
      },
    };
  });
