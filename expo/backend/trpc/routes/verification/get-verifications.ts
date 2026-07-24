import { protectedProcedure } from "../../create-context";
import { getUserVerifications } from "../../../lib/user-store";

export const getVerificationsProcedure = protectedProcedure.query(
  async ({ ctx }) => {
    console.log('[Verification] Getting verifications for user:', ctx.user.id);
    
    const verifications = getUserVerifications(ctx.user.id);
    
    return verifications;
  }
);
