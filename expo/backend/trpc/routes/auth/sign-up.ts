import { publicProcedure } from '../../create-context';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { hashPassword } from '../../../lib/password';
import { createUser, getUserByEmail } from '../../../lib/user-store';
import { signToken } from '../../../lib/jwt';

export const signUpProcedure = publicProcedure
  .input(
    z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().min(2),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[SignUp] Attempting signup for:', input.email);

    const existingUser = getUserByEmail(input.email);
    if (existingUser) {
      console.log('[SignUp] User already exists:', input.email);
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'User with this email already exists',
      });
    }

    const passwordHash = await hashPassword(input.password);

    const user = createUser({
      email: input.email,
      name: input.name,
      passwordHash,
      authProvider: 'email',
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
    });

    console.log('[SignUp] User created successfully:', user.id);

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
