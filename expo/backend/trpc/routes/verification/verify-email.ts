import { protectedProcedure } from "../../create-context";
import { verifyEmail } from "../../../lib/user-store";

export const verifyEmailProcedure = protectedProcedure.mutation(
  async ({ ctx }) => {
    console.log('[Verification] Verifying email for user:', ctx.user.id);
    
    const verifications = verifyEmail(ctx.user.id);
    
    return verifications;
  }
);
