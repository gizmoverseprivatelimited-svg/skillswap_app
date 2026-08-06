import { createTRPCRouter } from "../../create-context";
import { getVerificationsProcedure } from "./get-verifications";
import { submitIdentityProcedure } from "./submit-identity";
import { verifyEmailProcedure } from "./verify-email";
import { verifyPhoneProcedure } from "./verify-phone";
import { verifyLinkedInProcedure } from "./verify-linkedin";
import { verifyPortfolioProcedure } from "./verify-portfolio";
import { addSkillBadgeProcedure } from "./add-skill-badge";

export const verificationRouter = createTRPCRouter({
  getVerifications: getVerificationsProcedure,
  submitIdentity: submitIdentityProcedure,
  verifyEmail: verifyEmailProcedure,
  verifyPhone: verifyPhoneProcedure,
  verifyLinkedIn: verifyLinkedInProcedure,
  verifyPortfolio: verifyPortfolioProcedure,
  addSkillBadge: addSkillBadgeProcedure,
});
