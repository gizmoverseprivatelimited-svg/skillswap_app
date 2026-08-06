import { z } from "zod";
import { protectedProcedure } from "../../create-context";
import { submitIdentityVerification, verifyIdentity } from "../../../lib/user-store";

export const submitIdentityProcedure = protectedProcedure
  .input(
    z.object({
      documentType: z.enum(['passport', 'drivers_license', 'national_id', 'other']),
      frontImageUrl: z.string(),
      backImageUrl: z.string().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    console.log('[Verification] Submitting identity verification:', ctx.user.id);
    
    const verifications = submitIdentityVerification(ctx.user.id, {
      type: input.documentType,
      frontImageUrl: input.frontImageUrl,
      backImageUrl: input.backImageUrl,
    });
    
    setTimeout(() => {
      console.log('[Verification] Auto-approving identity verification for demo');
      verifyIdentity(ctx.user.id, true, 'system', undefined);
    }, 3000);
    
    return verifications;
  });
