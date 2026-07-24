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

export const EARNING_RULES: EarningRule[] = [
  { source: 'class_taught', label: 'Per Class Taught', points: 50, description: 'Earn 50 points for every completed class or swap session.' },
  { source: 'monthly_subscription', label: 'Monthly Subscription Bonus', points: 200, description: 'Premium subscribers earn 200 bonus points monthly.' },
  { source: 'bonus', label: '5-Star Bonus', points: 25, description: 'Receive a 5-star review? Earn 25 bonus points.' },
  { source: 'referral', label: 'Referral Reward', points: 100, description: 'Invite a friend who completes a swap — earn 100 points.' },
];

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
  method: PayoutMethod;
  payoutDetails: PayoutRequest['payoutDetails'];
}

interface AdminPayoutActionInput {
  payoutId: string;
  reviewedBy: string;
  rejectionReason?: string;
  transactionRef?: string;
}

interface EarningsContextValue {
  transactions: PointTransaction[];
  payouts: PayoutRequest[];
  pointsToCurrencyRate: number;
  getSummary: (userId: string) => EarningsSummary;
  getUserTransactions: (userId: string) => PointTransaction[];
  getUserPayouts: (userId: string) => PayoutRequest[];
  awardPoints: (input: AwardPointsInput) => Promise<PointTransaction | null>;
  requestPayout: (input: RequestPayoutInput) => Promise<PayoutRequest | null>;
  approvePayout: (input: AdminPayoutActionInput) => Promise<void>;
  rejectPayout: (input: AdminPayoutActionInput) => Promise<void>;
  markPayoutCompleted: (input: AdminPayoutActionInput) => Promise<void>;
  pointsToCurrency: (points: number) => number;
  pendingPayoutsCount: number;
  totalPayoutsAmount: number;
  refreshEarnings: () => Promise<void>;
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
        setPayouts(data);
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
          const others = prev.filter((t) => t.userId !== userId);
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
          const others = prev.filter((p) => p.userId !== userId);
          return [...data, ...others];
        });
      }
    } catch (err) {
      console.error('[EarningsProvider] Fetch payouts error:', err);
    }
  }, []);

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
        .filter((t) => t.type === 'earned')
        .reduce((sum, t) => sum + t.amount, 0);

      const redeemedPoints = userPo
        .filter((p) => p.status !== 'rejected')
        .reduce((sum, p) => sum + p.points, 0);

      const availablePoints = Math.max(0, totalEarnedPoints - redeemedPoints);

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const currentMonthTx = userTx.filter((t) => {
        const d = new Date(t.timestamp || t.createdAt || Date.now());
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear && t.type === 'earned';
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
        .filter((t) => t.userId === userId)
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
        const res = await fetch(`${url}/earnings/payout-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
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

  const approvePayout = useCallback(async (input: AdminPayoutActionInput) => {
    try {
      const res = await fetch(`${url}/earnings/admin/payouts/${input.payoutId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const updated = await res.json();
        setPayouts((prev) => prev.map((p) => (p.id === updated.id || p.id === updated._id ? updated : p)));
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
        setPayouts((prev) => prev.map((p) => (p.id === updated.id || p.id === updated._id ? updated : p)));
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
        setPayouts((prev) => prev.map((p) => (p.id === updated.id || p.id === updated._id ? updated : p)));
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

  return {
    transactions,
    payouts,
    pointsToCurrencyRate: POINTS_TO_CURRENCY_RATE,
    getSummary,
    getUserTransactions,
    getUserPayouts,
    awardPoints,
    requestPayout,
    approvePayout,
    rejectPayout,
    markPayoutCompleted,
    pointsToCurrency,
    pendingPayoutsCount,
    totalPayoutsAmount,
    refreshEarnings,
  };
});
