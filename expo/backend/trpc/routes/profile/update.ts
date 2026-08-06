import { z } from 'zod';
import { protectedProcedure } from '../../create-context';

const updateProfileInputSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  bio: z.string(),
  location: z.string(),
  avatarUrl: z.string().url().optional(),
  skillsWanted: z.array(z.string()),
});

export const updateProfileProcedure = protectedProcedure
  .input(updateProfileInputSchema)
  .mutation(async ({ input, ctx }) => {
    console.log('[Profile] Update profile request:', {
      userId: ctx.user.id,
      input,
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    console.log('[Profile] Profile updated successfully');

    return {
      success: true,
      profile: {
        id: ctx.user.id,
        name: input.name,
        bio: input.bio,
        location: input.location,
        avatarUrl: input.avatarUrl,
        skillsWanted: input.skillsWanted,
        updatedAt: new Date().toISOString(),
      },
    };
  });
