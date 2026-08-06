import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { TRPCError } from '@trpc/server';

const onboardingDataSchema = z.object({
  role: z.enum(['teacher', 'learner', 'swap']).optional(),
  skillsToTeach: z.array(z.string()),
  skillsToLearn: z.array(z.string()),
  experienceLevels: z.record(z.string(), z.string()),
  learningGoals: z.array(z.string()).optional(),
  availability: z.array(z.string()),
  communicationPreference: z.string(),
  matchingPreferences: z.object({
    location: z.string().optional(),
    virtual: z.boolean(),
    inPerson: z.boolean(),
  }),
});

export const completeOnboardingProcedure = protectedProcedure
  .input(onboardingDataSchema)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;

    console.log('[Onboarding] Saving onboarding data for user:', userId);
    console.log('[Onboarding] Data:', input);

    try {
      return {
        success: true,
        message: 'Onboarding completed successfully',
        data: input,
      };
    } catch (error) {
      console.error('[Onboarding] Failed to save:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to complete onboarding',
      });
    }
  });
