import { z } from "zod";
import { protectedProcedure } from "../../create-context";
import { addSkillBadge } from "../../../lib/user-store";

export const addSkillBadgeProcedure = protectedProcedure
  .input(
    z.object({
      skillId: z.string(),
      skillTitle: z.string(),
      badgeType: z.enum(['verified', 'expert', 'endorsed']),
      issuerName: z.string().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    console.log('[Verification] Adding skill badge for user:', ctx.user.id);
    
    const verifications = addSkillBadge(ctx.user.id, {
      skillId: input.skillId,
      skillTitle: input.skillTitle,
      badgeType: input.badgeType,
      issuerName: input.issuerName,
      endorsementCount: 0,
    });
    
    return verifications;
  });
