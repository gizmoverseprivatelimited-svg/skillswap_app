import { createTRPCRouter } from '../../create-context';
import { getBalanceProcedure } from './get-balance';
import { purchaseCreditsProcedure } from './purchase-credits';
import { purchasePremiumProcedure } from './purchase-premium';
import { spendCreditsProcedure } from './spend-credits';

export const creditsRouter = createTRPCRouter({
  getBalance: getBalanceProcedure,
  purchaseCredits: purchaseCreditsProcedure,
  purchasePremium: purchasePremiumProcedure,
  spendCredits: spendCreditsProcedure,
});
