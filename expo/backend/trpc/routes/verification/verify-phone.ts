import { z } from "zod";
import { protectedProcedure } from "../../create-context";
import { verifyPhone } from "../../../lib/user-store";

export const verifyPhoneProcedure = protectedProcedure
  .input(
    z.object({
      phoneNumber: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    console.log('[Verification] Verifying phone for user:', ctx.user.id);
    
    const verifications = verifyPhone(ctx.user.id, input.phoneNumber);
    
    return verifications;
  });
