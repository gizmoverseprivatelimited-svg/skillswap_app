import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import url from '@/constants/backurl';
import type {
  EarningRule,
  EarningSourceType,
  EarningsSummary,
  PayoutMethod,
  PayoutRequest,
  PointTransaction,
} from '../types';
import {
  EARNING_RULES as PAYMENT_EARNING_RULES,
  TEACHER_EARNINGS,
  LEARNER_SWAP_COMPLETION_BONUS,
  creditsToRupees as creditsToRupeesHelper,
  getPayoutRate as getPayoutRateHelper,
  getTeacherSessionEarnings,
  MIN_PAYOUT_CREDITS,
} from '../lib/payments';

import { useSocket } from '@/providers/socket';

export const EARNING_RULES: EarningRule[] = PAYMENT_EARNING_RULES;

const POINTS_TO_CURRENCY_RATE = 0.02;

interface AwardPointsInput {
  userId: string;
  amount: number;
  source: EarningSourceType;
  description: string;
  swapId?: string;
}

interface RequestPayoutInput {
  userId: string;
  userName: string;
  userAvatar: string;
  points: number;
  credits?: number;
  method: PayoutMethod;
  payoutDetails: PayoutRequest['payoutDetails'];
}

interface AdminPayoutActionInput {
  payoutId: string;
  reviewedBy: string;
  rejectionReason?: string;
  transactionRef?: string;
}

interface ProcessClassPaymentInput {
  teacherId: string;
  learnerId: string;
  sessionCredits: number;
  swapId: string;
  skillTitle: string;
}

interface EarningsContextValue {
  transactions: PointTransaction[];
  payouts: PayoutRequest[];
  earningRules: EarningRule[];
  pointsToCurrencyRate: number;
  getSummary: (userId: string) => EarningsSummary;
  getUserTransactions: (userId: string) => PointTransaction[];
  getUserPayouts: (userId: string) => PayoutRequest[];
  awardPoints: (input: AwardPointsInput) => Promise<PointTransaction | null>;
  processClassPayment: (input: ProcessClassPaymentInput) => { teacherEarned: number; learnerEarned: number };
  requestPayout: (input: RequestPayoutInput) => Promise<PayoutRequest | null>;
  approvePayout: (input: AdminPayoutActionInput) => Promise<void>;
  rejectPayout: (input: AdminPayoutActionInput) => Promise<void>;
  markPayoutCompleted: (input: AdminPayoutActionInput) => Promise<void>;
  pointsToCurrency: (points: number) => number;
  creditsToRupees: (credits: number, method?: PayoutMethod) => number;
  getPayoutRate: (method: PayoutMethod) => number;
  pendingPayoutsCount: number;
  totalPayoutsAmount: number;
  minPayoutCredits: number;
  refreshEarnings: () => Promise<void>;
  refreshUserEarnings: (userId: string) => Promise<void>;
}

export const [EarningsProvider, useEarnings] = createContextHook<EarningsContextValue>(() => {
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [summaries, setSummaries] = useState<Record<string, EarningsSummary>>({});
  const fetched = useRef<Record<string, boolean>>({});

  const pointsToCurrency = useCallback((points: number) => {
    return Math.round(points * POINTS_TO_CURRENCY_RATE * 100) / 100;
  }, []);

  const fetchAdminPayouts = useCallback(async () => {
    try {
      const res = await fetch(`${url}/earnings/admin/payouts`);
      if (res.ok) {
        const data = await res.json();
        setPayouts((prev) => {
          const map = new Map();
          data.forEach((p: any) => map.set(p.id || p._id, p));
          return Array.from(map.values());
        });
      }
    } catch (err) {
      console.error('[EarningsProvider] Failed to fetch admin payouts:', err);
    }
  }, []);

  const refreshEarnings = useCallback(async () => {
    await fetchAdminPayouts();
  }, [fetchAdminPayouts]);

  useEffect(() => {
    fetchAdminPayouts();
  }, [fetchAdminPayouts]);

  const fetchUserSummary = useCallback(async (userId: string) => {
    if (!userId || userId === '1') return;
    try {
      const res = await fetch(`${url}/earnings/summary/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setSummaries((prev) => ({ ...prev, [userId]: data }));
      }
    } catch (err) {
      console.error('[EarningsProvider] Fetch summary error:', err);
    }
  }, []);

  const fetchUserTransactions = useCallback(async (userId: string) => {
    if (!userId || userId === '1') return;
    try {
      const res = await fetch(`${url}/earnings/transactions/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions((prev) => {
          const others = prev.filter((t) => {
            const tUid = typeof t.userId === 'object' ? (t.userId as any)?._id : t.userId;
            return String(tUid) !== String(userId);
          });
          return [...data, ...others];
        });
      }
    } catch (err) {
      console.error('[EarningsProvider] Fetch transactions error:', err);
    }
  }, []);

  const fetchUserPayouts = useCallback(async (userId: string) => {
    if (!userId || userId === '1') return;
    try {
      const res = await fetch(`${url}/earnings/payouts/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setPayouts((prev) => {
          const map = new Map();
          prev.forEach((p: any) => map.set(p.id || p._id, p));
          data.forEach((p: any) => map.set(p.id || p._id, p));
          return Array.from(map.values());
        });
      }
    } catch (err) {
      console.error('[EarningsProvider] Fetch payouts error:', err);
    }
  }, []);

  const { socket } = useSocket();

  useEffect(() => {
    if (socket) {
      const handlePayoutEvent = (payload: any) => {
        fetchAdminPayouts();
        if (payload?.userId) {
          fetchUserSummary(payload.userId);
          fetchUserTransactions(payload.userId);
          fetchUserPayouts(payload.userId);
        }
      };

      const handleSwapEvent = (payload: any) => {
        console.log('[EarningsProvider] Socket swap_updated event:', payload?._id || payload?.id);
        const reqId = typeof payload?.requesterId === 'object' ? payload.requesterId._id : payload?.requesterId;
        const recId = typeof payload?.recipientId === 'object' ? payload.recipientId._id : payload?.recipientId;

        if (reqId) {
          fetchUserSummary(String(reqId));
          fetchUserTransactions(String(reqId));
          fetchUserPayouts(String(reqId));
        }
        if (recId) {
          fetchUserSummary(String(recId));
          fetchUserTransactions(String(recId));
          fetchUserPayouts(String(recId));
        }
      };

      socket.on('admin_payout_updated', handlePayoutEvent);
      socket.on('payout_updated', handlePayoutEvent);
      socket.on('swap_updated', handleSwapEvent);

      return () => {
        socket.off('admin_payout_updated', handlePayoutEvent);
        socket.off('payout_updated', handlePayoutEvent);
        socket.off('swap_updated', handleSwapEvent);
      };
    }
  }, [socket, fetchAdminPayouts, fetchUserSummary, fetchUserTransactions, fetchUserPayouts]);

  const refreshUserEarnings = useCallback(async (userId: string) => {
    if (!userId || userId === '1') return;
    await Promise.all([
      fetchUserSummary(userId),
      fetchUserTransactions(userId),
      fetchUserPayouts(userId),
    ]);
  }, [fetchUserSummary, fetchUserTransactions, fetchUserPayouts]);

  const getSummary = useCallback(
    (userId: string): EarningsSummary => {
      if (userId && userId !== '1') {
        if (!fetched.current[`${userId}_summary`]) {
          fetched.current[`${userId}_summary`] = true;
          fetchUserSummary(userId);
        }
        if (!fetched.current[`${userId}_tx`]) {
          fetched.current[`${userId}_tx`] = true;
          fetchUserTransactions(userId);
        }
        if (!fetched.current[`${userId}_po`]) {
          fetched.current[`${userId}_po`] = true;
          fetchUserPayouts(userId);
        }
      }
      if (summaries[userId]) {
        return summaries[userId];
      }

      // Local fallback calculation if server summary isn't fetched yet
      const userTx = transactions.filter((t) => t.userId === userId);
      const userPo = payouts.filter((p) => p.userId === userId);

      const totalEarnedPoints = userTx
        .filter((t) => t.type === 'earned' && (t.source === 'class_taught' || t.source === 'learner_bonus'))
        .reduce((sum, t) => sum + t.amount, 0);

      const redeemedPoints = userPo
        .filter((p) => p.status !== 'rejected')
        .reduce((sum, p) => sum + (p.credits || p.points || 0), 0);

      const availablePoints = Math.max(0, totalEarnedPoints - redeemedPoints);

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const currentMonthTx = userTx.filter((t) => {
        const d = new Date(t.timestamp || t.createdAt || Date.now());
        return (
          d.getMonth() === currentMonth &&
          d.getFullYear() === currentYear &&
          t.type === 'earned' &&
          (t.source === 'class_taught' || t.source === 'learner_bonus')
        );
      });

      const currentMonthPoints = currentMonthTx.reduce((sum, t) => sum + t.amount, 0);
      const currentMonthClasses = currentMonthTx.filter((t) => t.source === 'class_taught').length;

      return {
        userId,
        totalEarnedPoints,
        availablePoints,
        availableCurrency: pointsToCurrency(availablePoints),
        currentMonthPoints,
        currentMonthClasses,
        totalPayouts: userPo.length,
        completedPayouts: userPo.filter((p) => p.status === 'completed').length,
        pendingPayouts: userPo.filter((p) => p.status === 'pending').length,
      };
    },
    [summaries, transactions, payouts, pointsToCurrency]
  );

  const getUserTransactions = useCallback(
    (userId: string) => {
      if (!fetched.current[`${userId}_tx`]) {
        fetched.current[`${userId}_tx`] = true;
        fetchUserTransactions(userId);
      }
      if (!fetched.current[`${userId}_summary`]) {
        fetched.current[`${userId}_summary`] = true;
        fetchUserSummary(userId);
      }
      return transactions
        .filter((t) => {
          const tUid = typeof t.userId === 'object' ? (t.userId as any)?._id : t.userId;
          return String(tUid) === String(userId);
        })
        .sort((a, b) => new Date(b.timestamp || b.createdAt || 0).getTime() - new Date(a.timestamp || a.createdAt || 0).getTime());
    },
    [transactions, fetchUserTransactions, fetchUserSummary]
  );

  const getUserPayouts = useCallback(
    (userId: string) => {
      if (!fetched.current[`${userId}_po`]) {
        fetched.current[`${userId}_po`] = true;
        fetchUserPayouts(userId);
      }
      if (!fetched.current[`${userId}_summary`]) {
        fetched.current[`${userId}_summary`] = true;
        fetchUserSummary(userId);
      }
      return payouts
        .filter((p) => p.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    [payouts, fetchUserPayouts, fetchUserSummary]
  );

  const awardPoints = useCallback(async (input: AwardPointsInput): Promise<PointTransaction | null> => {
    try {
      const res = await fetch(`${url}/earnings/award`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const newTx = await res.json();
        setTransactions((prev) => [newTx, ...prev]);
        fetchUserSummary(input.userId);
        return newTx;
      }
    } catch (err) {
      console.error('[EarningsProvider] Award points API error:', err);
    }
    return null;
  }, [fetchUserSummary]);

  const requestPayout = useCallback(
    async (input: RequestPayoutInput): Promise<PayoutRequest | null> => {
      try {
        const payload = { ...input, credits: input.credits ?? input.points };
        const res = await fetch(`${url}/earnings/payout-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const newPayout = await res.json();
          setPayouts((prev) => [newPayout, ...prev]);
          fetchUserSummary(input.userId);
          fetchUserTransactions(input.userId);
          return newPayout;
        }
      } catch (err) {
        console.error('[EarningsProvider] Request payout API error:', err);
      }
      return null;
    },
    [fetchUserSummary, fetchUserTransactions]
  );

  const isSamePayoutId = (a: any, b: any) => {
    const idA = a?.id || a?._id;
    const idB = b?.id || b?._id;
    return Boolean(idA && idB && String(idA) === String(idB));
  };

  const approvePayout = useCallback(async (input: AdminPayoutActionInput) => {
    try {
      const res = await fetch(`${url}/earnings/admin/payouts/${input.payoutId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const updated = await res.json();
        setPayouts((prev) => prev.map((p) => (isSamePayoutId(p, updated) ? { ...p, ...updated } : p)));
      }
    } catch (err) {
      console.error('[EarningsProvider] Approve payout API error:', err);
    }
  }, []);

  const rejectPayout = useCallback(async (input: AdminPayoutActionInput) => {
    try {
      const res = await fetch(`${url}/earnings/admin/payouts/${input.payoutId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const updated = await res.json();
        setPayouts((prev) => prev.map((p) => (isSamePayoutId(p, updated) ? { ...p, ...updated } : p)));
      }
    } catch (err) {
      console.error('[EarningsProvider] Reject payout API error:', err);
    }
  }, []);

  const markPayoutCompleted = useCallback(async (input: AdminPayoutActionInput) => {
    try {
      const res = await fetch(`${url}/earnings/admin/payouts/${input.payoutId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const updated = await res.json();
        setPayouts((prev) => prev.map((p) => (isSamePayoutId(p, updated) ? { ...p, ...updated } : p)));
      }
    } catch (err) {
      console.error('[EarningsProvider] Complete payout API error:', err);
    }
  }, []);

  const pendingPayoutsCount = useMemo(() => {
    return payouts.filter((p) => p.status === 'pending').length;
  }, [payouts]);

  const totalPayoutsAmount = useMemo(() => {
    return payouts
      .filter((p) => p.status === 'completed' || p.status === 'approved')
      .reduce((sum, p) => sum + (p.amount || p.amountCurrency || 0), 0);
  }, [payouts]);

  /** Full payment processing for a completed class/swap session */
  const processClassPayment = useCallback((input: ProcessClassPaymentInput) => {
    const teacherEarned = getTeacherSessionEarnings(input.sessionCredits);
    const learnerEarned = LEARNER_SWAP_COMPLETION_BONUS;

    // 1. Deduct session cost from learner if paid session
    if (input.sessionCredits > 0) {
      awardPoints({
        userId: input.learnerId,
        amount: -input.sessionCredits,
        source: 'swap_completed',
        description: `Session fee for "${input.skillTitle}"`,
        swapId: input.swapId,
      });
    }

    // 2. Award 80% (or 50 free) to teacher
    awardPoints({
      userId: input.teacherId,
      amount: teacherEarned,
      source: 'class_taught',
      description: input.sessionCredits > 0
        ? `Taught "${input.skillTitle}" — 80% of ${input.sessionCredits} credits`
        : `Taught "${input.skillTitle}" (free session bonus)`,
      swapId: input.swapId,
    });

    // 3. Award +10 completion bonus to learner
    awardPoints({
      userId: input.learnerId,
      amount: learnerEarned,
      source: 'learner_bonus' as EarningSourceType,
      description: `Completed "${input.skillTitle}" swap session`,
      swapId: input.swapId,
    });

    console.log('[Earnings] Class payment processed', { teacherEarned, learnerEarned, sessionCredits: input.sessionCredits, swapId: input.swapId });
    return { teacherEarned, learnerEarned };
  }, [awardPoints]);

  const convertCredits = useCallback(
    (credits: number, method: PayoutMethod = 'store_credit'): number =>
      creditsToRupeesHelper(credits, method),
    [],
  );

  const getPayoutRateCb = useCallback(
    (method: PayoutMethod): number => getPayoutRateHelper(method),
    [],
  );

  return {
    transactions,
    payouts,
    earningRules: EARNING_RULES,
    pointsToCurrencyRate: POINTS_TO_CURRENCY_RATE,
    getSummary,
    getUserTransactions,
    getUserPayouts,
    awardPoints,
    processClassPayment,
    requestPayout,
    approvePayout,
    rejectPayout,
    markPayoutCompleted,
    pointsToCurrency,
    creditsToRupees: convertCredits,
    getPayoutRate: getPayoutRateCb,
    pendingPayoutsCount,
    totalPayoutsAmount,
    minPayoutCredits: MIN_PAYOUT_CREDITS,
    refreshEarnings,
    refreshUserEarnings,
  };
});
