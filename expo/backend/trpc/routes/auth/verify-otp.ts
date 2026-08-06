import { publicProcedure } from '../../create-context';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { verifyOTP } from '../../../lib/otp';
import { getUserByEmail, createUser } from '../../../lib/user-store';
import { signToken } from '../../../lib/jwt';

export const verifyOtpProcedure = publicProcedure
  .input(
    z.object({
      identifier: z.string().min(5),
      code: z.string().length(6),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[VerifyOTP] Verifying OTP for:', input.identifier);

    const isValid = verifyOTP(input.identifier, input.code);
    if (!isValid) {
      console.log('[VerifyOTP] Invalid or expired OTP');
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired OTP',
      });
    }

    const isEmail = /@/.test(input.identifier);
    let user = isEmail ? getUserByEmail(input.identifier) : null;

    if (!user) {
      console.log('[VerifyOTP] Creating new user for:', input.identifier);
      const name = isEmail ? input.identifier.split('@')[0] : 'User';
      user = createUser({
        email: isEmail ? input.identifier : `${input.identifier}@phone.temp`,
        name: name || 'User',
        authProvider: 'email',
      });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
    });

    console.log('[VerifyOTP] OTP verified successfully:', user.id);

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
