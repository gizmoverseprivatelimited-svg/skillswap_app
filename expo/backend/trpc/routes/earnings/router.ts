import { createTRPCRouter } from '../../create-context';
import { getEarningsProcedure } from './get-earnings';
import { getTransactionsProcedure } from './get-transactions';
import { requestPayoutProcedure } from './request-payout';
import { awardPointsProcedure } from './award-points';

export const earningsRouter = createTRPCRouter({
  getEarnings: getEarningsProcedure,
  getTransactions: getTransactionsProcedure,
  requestPayout: requestPayoutProcedure,
  awardPoints: awardPointsProcedure,
});
