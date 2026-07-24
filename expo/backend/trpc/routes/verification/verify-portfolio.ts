import { z } from "zod";
import { protectedProcedure } from "../../create-context";
import { verifyPortfolio } from "../../../lib/user-store";

export const verifyPortfolioProcedure = protectedProcedure
  .input(
    z.object({
      portfolioUrl: z.string().url(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    console.log('[Verification] Verifying portfolio for user:', ctx.user.id);
    
    const verifications = verifyPortfolio(ctx.user.id, input.portfolioUrl);
    
    return verifications;
  });
