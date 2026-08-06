import { z } from "zod";
import { protectedProcedure } from "../../create-context";

interface PushToken {
  userId: string;
  token: string;
  createdAt: string;
}

const pushTokensStore = new Map<string, PushToken>();

export const registerPushTokenProcedure = protectedProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const pushToken: PushToken = {
      userId: ctx.user.id,
      token: input.token,
      createdAt: new Date().toISOString(),
    };

    pushTokensStore.set(ctx.user.id, pushToken);

    console.log("[PushNotifications] Token registered", { userId: ctx.user.id });

    return { success: true };
  });

export const unregisterPushTokenProcedure = protectedProcedure.mutation(async ({ ctx }) => {
  pushTokensStore.delete(ctx.user.id);
  console.log("[PushNotifications] Token unregistered", { userId: ctx.user.id });
  return { success: true };
});

export function getPushTokenForUser(userId: string): string | undefined {
  return pushTokensStore.get(userId)?.token;
}
