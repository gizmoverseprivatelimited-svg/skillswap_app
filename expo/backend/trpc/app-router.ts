import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import { reviewsRouter } from "./routes/reviews/router";
import { profileRouter } from "./routes/profile/router";
import { authRouter } from "./routes/auth/router";
import { chatRouter } from "./routes/chat/router";
import { notificationsRouter } from "./routes/notifications/router";
import { creditsRouter } from "./routes/credits/router";
import { verificationRouter } from "./routes/verification/router";
import { onboardingRouter } from "./routes/onboarding/router";
import { earningsRouter } from "./routes/earnings/router";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  auth: authRouter,
  reviews: reviewsRouter,
  profile: profileRouter,
  chat: chatRouter,
  notifications: notificationsRouter,
  credits: creditsRouter,
  verification: verificationRouter,
  onboarding: onboardingRouter,
  earnings: earningsRouter,
});

export type AppRouter = typeof appRouter;
