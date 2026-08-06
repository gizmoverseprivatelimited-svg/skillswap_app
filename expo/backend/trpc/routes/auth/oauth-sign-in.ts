import { publicProcedure } from '../../create-context';
import { z } from 'zod';
import { createUser, getUserByProvider } from '../../../lib/user-store';
import { signToken } from '../../../lib/jwt';

export const oauthSignInProcedure = publicProcedure
  .input(
    z.object({
      provider: z.enum(['google', 'apple']),
      providerId: z.string(),
      email: z.string().email(),
      name: z.string().optional(),
      avatar: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[OAuth] Attempting OAuth signin:', input.provider, input.email);

    let user = getUserByProvider(input.provider, input.providerId);

    if (!user) {
      console.log('[OAuth] Creating new user for provider:', input.provider);
      user = createUser({
        email: input.email,
        name: input.name || input.email.split('@')[0] || 'User',
        authProvider: input.provider,
        providerId: input.providerId,
        avatar: input.avatar,
      });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
    });

    console.log('[OAuth] OAuth signin successful:', user.id);

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
