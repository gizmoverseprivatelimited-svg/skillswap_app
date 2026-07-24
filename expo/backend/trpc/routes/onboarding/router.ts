import { createTRPCRouter } from '../../create-context';
import { completeOnboardingProcedure } from './complete';

export const onboardingRouter = createTRPCRouter({
  complete: completeOnboardingProcedure,
});
