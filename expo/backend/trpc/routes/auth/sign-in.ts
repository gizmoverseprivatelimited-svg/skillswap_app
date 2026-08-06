import { publicProcedure } from '../../create-context';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { comparePassword } from '../../../lib/password';
import { getUserByEmail } from '../../../lib/user-store';
import { signToken } from '../../../lib/jwt';

export const signInProcedure = publicProcedure
  .input(
    z.object({
      email: z.string().email(),
      password: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[SignIn] Attempting signin for:', input.email);

    const user = getUserByEmail(input.email);
    if (!user) {
      console.log('[SignIn] User not found:', input.email);
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      });
    }

    if (!user.passwordHash) {
      console.log('[SignIn] User has no password (OAuth user):', input.email);
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Please sign in with your OAuth provider',
      });
    }

    const isValid = await comparePassword(input.password, user.passwordHash);
    if (!isValid) {
      console.log('[SignIn] Invalid password for:', input.email);
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
    });

    console.log('[SignIn] User signed in successfully:', user.id);

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
