import { z } from "zod";
import { protectedProcedure } from "../../create-context";
import { verifyLinkedIn } from "../../../lib/user-store";

export const verifyLinkedInProcedure = protectedProcedure
  .input(
    z.object({
      linkedInUrl: z.string().url(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    console.log('[Verification] Verifying LinkedIn for user:', ctx.user.id);
    
    const verifications = verifyLinkedIn(ctx.user.id, input.linkedInUrl, {
      name: ctx.user.name,
      headline: 'Software Developer',
    });
    
    return verifications;
  });
