import { useCallback, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { mockUsers } from '../mocks/data';
import type {
  EarningRule,
  EarningSourceType,
  EarningsSummary,
  PayoutMethod,
  PayoutRequest,
  PayoutStatus,
  PointTransaction,
} from '../types';

export const EARNING_RULES: EarningRule[] = [
  { source: 'class_taught', label: 'Per Class Taught', points: 50, description: 'Earn 50 points for every completed class or swap session.' },
  { source: 'monthly_subscription', label: 'Monthly Subscription Bonus', points: 200, description: 'Premium subscribers earn 200 bonus points monthly.' },
  { source: 'bonus', label: '5-Star Bonus', points: 25, description: 'Receive a 5-star review? Earn 25 bonus points.' },
  { source: 'referral', label: 'Referral Reward', points: 100, description: 'Invite a friend who completes a swap — earn 100 points.' },
];

const POINTS_TO_CURRENCY_RATE = 0.02;

const STORAGE_KEY = '@skillswap/earnings_v1';

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
  earningRules: EarningRule[];
  getSummary: (userId: string) => EarningsSummary;
  getUserTransactions: (userId: string) => PointTransaction[];
  getUserPayouts: (userId: string) => PayoutRequest[];
  getPendingPayouts: PayoutRequest[];
  pointsToCurrency: (points: number) => number;
  awardPoints: (input: AwardPointsInput) => void;
  requestPayout: (input: RequestPayoutInput) => PayoutRequest;
  cancelPayout: (payoutId: string, userId: string) => void;
  approvePayout: (input: AdminPayoutActionInput) => void;
  rejectPayout: (input: AdminPayoutActionInput) => void;
  markPayoutCompleted: (payoutId: string, transactionRef: string) => void;
  pendingPayoutsCount: number;
  totalPayoutsAmount: number;
}

const generateId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const startOfMonth = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const seedTransactions = (): PointTransaction[] => {
  const now = Date.now();
  const base: PointTransaction[] = [];
  mockUsers.forEach((user, userIndex) => {
    for (let i = 0; i < 3 + userIndex; i++) {
      const isThisMonth = i < 2;
      const created = new Date(
        isThisMonth
          ? now - i * 3 * 24 * 60 * 60 * 1000
          : now - (15 + i * 5) * 24 * 60 * 60 * 1000,
      );
      base.push({
        id: generateId('txn'),
        userId: user.id,
        amount: 50 + Math.floor(Math.random() * 3) * 25,
        source: i % 4 === 0 ? 'monthly_subscription' : 'class_taught',
        description:
          i % 4 === 0
            ? 'Monthly subscription bonus'
            : `Completed class #${i + 1}`,
        createdAt: created.toISOString(),
      });
    }
  });
  return base.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
};

const seedPayouts = (): PayoutRequest[] => {
  const now = Date.now();
  return [
    {
      id: generateId('payout'),
      userId: '3',
      userName: 'Ananya Reddy',
      userAvatar: 'https://i.pravatar.cc/150?img=5',
      points: 500,
      amountCurrency: 500 * POINTS_TO_CURRENCY_RATE,
      method: 'upi',
      status: 'pending',
      createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      payoutDetails: { upiId: 'ananya@upi' },
    },
    {
      id: generateId('payout'),
      userId: '1',
      userName: 'Priya Sharma',
      userAvatar: 'https://i.pravatar.cc/150?img=1',
      points: 300,
      amountCurrency: 300 * POINTS_TO_CURRENCY_RATE,
      method: 'bank_transfer',
      status: 'pending',
      createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
      payoutDetails: {
        accountName: 'Priya Sharma',
        accountNumber: '****1234',
        ifscCode: 'HDFC0001234',
      },
    },
    {
      id: generateId('payout'),
      userId: '5',
      userName: 'Kavya Nair',
      userAvatar: 'https://i.pravatar.cc/150?img=9',
      points: 200,
      amountCurrency: 200 * POINTS_TO_CURRENCY_RATE,
      method: 'store_credit',
      status: 'completed',
      createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
      processedAt: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
      transactionRef: 'SCR-20240115-AB12',
    },
  ];
};

export const [EarningsProvider, useEarnings] =
  createContextHook<EarningsContextValue>(() => {
    const [transactions, setTransactions] =
      useState<PointTransaction[]>(seedTransactions);
    const [payouts, setPayouts] = useState<PayoutRequest[]>(seedPayouts);

    const pointsToCurrency = useCallback(
      (points: number): number => Math.round(points * POINTS_TO_CURRENCY_RATE * 100) / 100,
      [],
    );

    const awardPoints = useCallback((input: AwardPointsInput) => {
      const txn: PointTransaction = {
        id: generateId('txn'),
        userId: input.userId,
        amount: input.amount,
        source: input.source,
        description: input.description,
        swapId: input.swapId,
        createdAt: new Date().toISOString(),
      };
      setTransactions((prev) => [txn, ...prev]);
      console.log('[Earnings] Awarded points', txn);
    }, []);

    const requestPayout = useCallback(
      (input: RequestPayoutInput): PayoutRequest => {
        const payout: PayoutRequest = {
          id: generateId('payout'),
          userId: input.userId,
          userName: input.userName,
          userAvatar: input.userAvatar,
          points: input.points,
          amountCurrency: pointsToCurrency(input.points),
          method: input.method,
          status: 'pending',
          createdAt: new Date().toISOString(),
          payoutDetails: input.payoutDetails,
        };
        setPayouts((prev) => [payout, ...prev]);
        console.log('[Earnings] Payout requested', payout);
        return payout;
      },
      [pointsToCurrency],
    );

    const cancelPayout = useCallback((payoutId: string, userId: string) => {
      setPayouts((prev) =>
        prev.map((p) =>
          p.id === payoutId && p.userId === userId && p.status === 'pending'
            ? { ...p, status: 'cancelled' as PayoutStatus }
            : p,
        ),
      );
    }, []);

    const approvePayout = useCallback((input: AdminPayoutActionInput) => {
      setPayouts((prev) =>
        prev.map((p) =>
          p.id === input.payoutId
            ? {
                ...p,
                status: 'approved' as PayoutStatus,
                reviewedAt: new Date().toISOString(),
                reviewedBy: input.reviewedBy,
              }
            : p,
        ),
      );
    }, []);

    const rejectPayout = useCallback((input: AdminPayoutActionInput) => {
      setPayouts((prev) =>
        prev.map((p) =>
          p.id === input.payoutId
            ? {
                ...p,
                status: 'rejected' as PayoutStatus,
                reviewedAt: new Date().toISOString(),
                reviewedBy: input.reviewedBy,
                rejectionReason: input.rejectionReason,
              }
            : p,
        ),
      );
    }, []);

    const markPayoutCompleted = useCallback(
      (payoutId: string, transactionRef: string) => {
        setPayouts((prev) =>
          prev.map((p) =>
            p.id === payoutId
              ? {
                  ...p,
                  status: 'completed' as PayoutStatus,
                  processedAt: new Date().toISOString(),
                  transactionRef,
                }
              : p,
          ),
        );
      },
      [],
    );

    const getUserTransactions = useCallback(
      (userId: string): PointTransaction[] =>
        transactions.filter((t) => t.userId === userId),
      [transactions],
    );

    const getUserPayouts = useCallback(
      (userId: string): PayoutRequest[] =>
        payouts.filter((p) => p.userId === userId),
      [payouts],
    );

    const getPendingPayouts = useMemo(
      (): PayoutRequest[] =>
        payouts.filter((p) => p.status === 'pending'),
      [payouts],
    );

    const getSummary = useCallback(
      (userId: string): EarningsSummary => {
        const userTxns = transactions.filter((t) => t.userId === userId);
        const userPayouts = payouts.filter((p) => p.userId === userId);
        const totalEarned = userTxns.reduce((s, t) => s + t.amount, 0);
        const redeemedPoints = userPayouts
          .filter((p) => p.status !== 'rejected' && p.status !== 'cancelled')
          .reduce((s, p) => s + p.points, 0);
        const pendingPoints = userPayouts
          .filter((p) => p.status === 'pending' || p.status === 'approved' || p.status === 'processing')
          .reduce((s, p) => s + p.points, 0);
        const lifetimePayouts = userPayouts
          .filter((p) => p.status === 'completed')
          .reduce((s, p) => s + p.amountCurrency, 0);
        const monthStart = startOfMonth().getTime();
        const monthTxns = userTxns.filter(
          (t) => new Date(t.createdAt).getTime() >= monthStart,
        );
        return {
          userId,
          totalPointsEarned: totalEarned,
          availablePoints: Math.max(0, totalEarned - redeemedPoints - pendingPoints),
          pendingPoints,
          lifetimePayouts,
          currentMonthPoints: monthTxns.reduce((s, t) => s + t.amount, 0),
          currentMonthClasses: monthTxns.filter((t) => t.source === 'class_taught').length,
        };
      },
      [transactions, payouts],
    );

    const pendingPayoutsCount = useMemo(
      () => payouts.filter((p) => p.status === 'pending').length,
      [payouts],
    );

    const totalPayoutsAmount = useMemo(
      () =>
        payouts
          .filter((p) => p.status === 'completed')
          .reduce((s, p) => s + p.amountCurrency, 0),
      [payouts],
    );

    const value: EarningsContextValue = useMemo(
      () => ({
        transactions,
        payouts,
        earningRules: EARNING_RULES,
        getSummary,
        getUserTransactions,
        getUserPayouts,
        getPendingPayouts,
        pointsToCurrency,
        awardPoints,
        requestPayout,
        cancelPayout,
        approvePayout,
        rejectPayout,
        markPayoutCompleted,
        pendingPayoutsCount,
        totalPayoutsAmount,
      }),
      [
        transactions,
        payouts,
        getSummary,
        getUserTransactions,
        getUserPayouts,
        getPendingPayouts,
        pointsToCurrency,
        awardPoints,
        requestPayout,
        cancelPayout,
        approvePayout,
        rejectPayout,
        markPayoutCompleted,
        pendingPayoutsCount,
        totalPayoutsAmount,
      ],
    );

    return value;
  });
