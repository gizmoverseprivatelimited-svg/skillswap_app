import { useCallback, useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { getUsers, mockUsers } from '../mocks/data';
import type { User, Review, SkillSwapRequest, UserVerifications, VerificationStatus } from '../types';
import url from '@/constants/backurl';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSocket } from '@/providers/socket';

const ADMIN_SESSION_KEY = '@skillswap/admin_session';

const ADMIN_CREDENTIALS = {
  email: 'admin@skillswap.app',
  password: 'admin123',
};

export type BanStatus = 'active' | 'banned' | 'suspended';

export interface AdminUser extends User {
  // email: string;
  // banStatus: BanStatus;
  banReason?: string;
  bannedAt?: string;
  suspendedUntil?: string;
  daysSuspended?: number;
  // reportCount: number;
}

export interface AdminReview extends Review {
  reviewerName: string;
  revieweeName: string;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  moderatedAt?: string;
  moderationNote?: string;
}

export interface VerificationRequest {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  type: 'identity' | 'email' | 'phone' | 'linkedin' | 'portfolio';
  status: VerificationStatus;
  submittedAt: string;
  details: string;
  documentUrl?: string;
}

export type CertificationStatus = 'pending' | 'approved' | 'rejected';

export interface CertificationRequest {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  skillId: string;
  skillTitle: string;
  documentUri?: string;
  status: CertificationStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface SubmitCertificationInput {
  userId: string;
  userName: string;
  userAvatar: string;
  skillId: string;
  skillTitle: string;
  documentUri?: string;
}

export interface AdminTransaction {
  id: string;
  _id?: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userUsername?: string;
  userAvatar?: string;
  userCredits?: number;
  userTier?: string;
  amount: number;
  quantity: number;
  type: 'earned' | 'redeemed' | 'pending';
  source: string;
  description: string;
  swapId?: string | null;
  currency?: string;
  isMoneyPayment?: boolean;
  paymentOrderId?: string;
  paymentStatus?: string;
  timestamp: string;
  createdAt: string;
}

export interface AdminTransactionStats {
  totalTransactions: number;
  totalCreditsEarned: number;
  totalCreditsRedeemed: number;
  totalMoneyVolume: number;
  pointTransactionsCount: number;
  paymentOrdersCount: number;
}

interface AdminContextValue {
  users: AdminUser[];
  reviews: AdminReview[];
  verificationRequests: VerificationRequest[];
  certificationRequests: CertificationRequest[];
  transactions: AdminTransaction[];
  transactionStats: AdminTransactionStats;
  fetchTransactions: (params?: { type?: string; source?: string; search?: string }) => Promise<void>;
  isAdminAuthenticated: boolean;
  adminLogin: (email: string, password: string) => Promise<void>;
  adminLogout: () => Promise<void>;
  banUser: (userId: string, reason: string) => void;
  unbanUser: (userId: string) => void;
  suspendUser: (userId: string, reason: string, days?: number) => void;
  updateUserCredits: (userId: string, credits: number) => void;
  approveReview: (reviewId: string, note?: string) => void;
  rejectReview: (reviewId: string, note: string) => void;
  approveVerification: (requestId: string) => void;
  rejectVerification: (requestId: string, reason: string) => void;
  submitCertification: (input: SubmitCertificationInput) => void;
  approveCertification: (requestId: string) => void;
  rejectCertification: (requestId: string, reason: string) => void;
  getSkillCertificationStatus: (userId: string, skillId: string) => CertificationStatus | null;
  refreshCertifications: () => Promise<void>;
  stats: {
    totalUsers: number;
    activeUsers: number;
    bannedUsers: number;
    pendingReviews: number;
    pendingVerifications: number;
    pendingCertifications: number;
    totalSwaps: number;
  };
  isLoading: boolean;
}

const CERTIFICATIONS_STORAGE_KEY = '@skillswap/admin_certifications';

const seedAdminUsers = (): AdminUser[] => {
  return mockUsers.map((user, index) => ({
    ...user,
    email: `${user.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    banStatus: 'active' as BanStatus,
    reportCount: Math.floor(Math.random() * 5),
  }));
};

// const seedReviews = (): AdminReview[] => {
//   const now = new Date();
//   return [
//     {
//       id: 'rev-1',
//       reviewerId: '2',
//       revieweeId: '1',
//       rating: 5,
//       comment: 'Amazing photography session! Learned so much about lighting and composition.',
//       createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
//       reviewerName: 'Rahul Verma',
//       revieweeName: 'Priya Sharma',
//       moderationStatus: 'approved',
//     },
//     {
//       id: 'rev-2',
//       reviewerId: '4',
//       revieweeId: '3',
//       rating: 4,
//       comment: 'Great Hindi conversation practice. Very patient teacher.',
//       createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
//       reviewerName: 'Arjun Mehta',
//       revieweeName: 'Ananya Reddy',
//       moderationStatus: 'pending',
//     },
//     {
//       id: 'rev-3',
//       reviewerId: '5',
//       revieweeId: '6',
//       rating: 2,
//       comment: 'Session was okay but felt rushed. Could improve time management.',
//       createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
//       reviewerName: 'Kavya Nair',
//       revieweeName: 'Vikram Singh',
//       moderationStatus: 'pending',
//       flaggedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
//       flagReason: 'Potentially unfair rating',
//       flagReporterId: '6',
//     },
//     {
//       id: 'rev-4',
//       reviewerId: '1',
//       revieweeId: '5',
//       rating: 5,
//       comment: 'Kavya is an incredible digital artist. Her teaching style is clear and inspiring!',
//       createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
//       reviewerName: 'Priya Sharma',
//       revieweeName: 'Kavya Nair',
//       moderationStatus: 'approved',
//     },
//     {
//       id: 'rev-5',
//       reviewerId: '3',
//       revieweeId: '2',
//       rating: 1,
//       comment: 'Did not show up for the session. Very unprofessional.',
//       createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
//       reviewerName: 'Ananya Reddy',
//       revieweeName: 'Rahul Verma',
//       moderationStatus: 'pending',
//       flaggedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
//       flagReason: 'Dispute - user claims they attended',
//       flagReporterId: '2',
//     },
//     {
//       id: 'rev-6',
//       reviewerId: '6',
//       revieweeId: '4',
//       rating: 4,
//       comment: 'Good piano fundamentals session. Would recommend for beginners.',
//       createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
//       reviewerName: 'Vikram Singh',
//       revieweeName: 'Arjun Mehta',
//       moderationStatus: 'approved',
//     },
//   ];
// };

const seedVerificationRequests = (): VerificationRequest[] => {
  const now = new Date();
  return [
    {
      id: 'vr-1',
      userId: '2',
      userName: 'Rahul Verma',
      userAvatar: 'https://i.pravatar.cc/150?img=12',
      type: 'identity',
      status: 'pending',
      submittedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      details: 'National ID card submitted',
      documentUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400',
    },
    {
      id: 'vr-2',
      userId: '4',
      userName: 'Arjun Mehta',
      userAvatar: 'https://i.pravatar.cc/150?img=13',
      type: 'linkedin',
      status: 'pending',
      submittedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      details: 'LinkedIn profile: linkedin.com/in/arjunmehta',
    },
    {
      id: 'vr-3',
      userId: '5',
      userName: 'Kavya Nair',
      userAvatar: 'https://i.pravatar.cc/150?img=9',
      type: 'portfolio',
      status: 'pending',
      submittedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
      details: 'Portfolio: behance.net/kavyanair',
    },
    {
      id: 'vr-4',
      userId: '3',
      userName: 'Ananya Reddy',
      userAvatar: 'https://i.pravatar.cc/150?img=5',
      type: 'phone',
      status: 'pending',
      submittedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      details: 'Phone: +91 98765 43210',
    },
    {
      id: 'vr-5',
      userId: '6',
      userName: 'Vikram Singh',
      userAvatar: 'https://i.pravatar.cc/150?img=14',
      type: 'identity',
      status: 'pending',
      submittedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      details: "Driver's license submitted",
      documentUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400',
    },
  ];
};

const seedCertificationRequests = (): CertificationRequest[] => {
  const now = new Date();
  return [
    {
      id: 'cr-1',
      userId: '2',
      userName: 'Rahul Verma',
      userAvatar: 'https://i.pravatar.cc/150?img=12',
      skillId: '3',
      skillTitle: 'Web Development (React)',
      documentUri: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400',
      status: 'pending',
      submittedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'cr-2',
      userId: '3',
      userName: 'Ananya Reddy',
      userAvatar: 'https://i.pravatar.cc/150?img=5',
      skillId: '5',
      skillTitle: 'Hindi Conversation',
      documentUri: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400',
      status: 'pending',
      submittedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'cr-3',
      userId: '4',
      userName: 'Arjun Mehta',
      userAvatar: 'https://i.pravatar.cc/150?img=13',
      skillId: '7',
      skillTitle: 'Piano Fundamentals',
      documentUri: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400',
      status: 'approved',
      submittedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      reviewedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      reviewNote: 'ABRSM certificate verified',
    },
  ];
};

const seedAdminTransactions = (): AdminTransaction[] => {
  const now = Date.now();
  return [
    {
      id: 'tx-seed-1',
      userId: '2',
      userName: 'Rahul Verma',
      userEmail: 'rahul.verma@example.com',
      userUsername: '@rahulverma',
      userAvatar: 'https://i.pravatar.cc/150?img=12',
      userCredits: 25,
      userTier: 'free',
      amount: 10,
      quantity: 10,
      type: 'earned',
      source: 'class_taught',
      description: 'Earnings for hosting "React Masterclass" group session',
      currency: 'credits',
      isMoneyPayment: false,
      timestamp: new Date(now - 15 * 60 * 1000).toISOString(),
      createdAt: new Date(now - 15 * 60 * 1000).toISOString(),
    },
    {
      id: 'tx-seed-2',
      userId: '3',
      userName: 'Ananya Reddy',
      userEmail: 'ananya.reddy@example.com',
      userUsername: '@ananyareddy',
      userAvatar: 'https://i.pravatar.cc/150?img=5',
      userCredits: 60,
      userTier: 'premium',
      amount: -3,
      quantity: 3,
      type: 'redeemed',
      source: 'swap_completed',
      description: 'Platform fee for requesting Hindi Coaching session',
      currency: 'credits',
      isMoneyPayment: false,
      timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'tx-seed-3',
      userId: '4',
      userName: 'Arjun Mehta',
      userEmail: 'arjun.mehta@example.com',
      userUsername: '@arjunmehta',
      userAvatar: 'https://i.pravatar.cc/150?img=13',
      userCredits: 100,
      userTier: 'pro',
      amount: 50,
      quantity: 50,
      type: 'earned',
      source: 'top_up',
      description: 'Credit Pack Purchase (Starter 50 Credits Pack - ₹299)',
      currency: 'credits',
      isMoneyPayment: false,
      timestamp: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'tx-seed-4',
      userId: '1',
      userName: 'User',
      userEmail: 'user@example.com',
      userUsername: '@user',
      userAvatar: 'https://i.pravatar.cc/150?img=1',
      userCredits: 50,
      userTier: 'premium',
      amount: 499,
      quantity: 499,
      type: 'earned',
      source: 'monthly_subscription',
      description: 'Premium Pro Membership Purchase (₹499.00 / month)',
      paymentOrderId: 'order_cf_98231',
      paymentStatus: 'PAID',
      currency: 'INR',
      isMoneyPayment: true,
      timestamp: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'tx-seed-5',
      userId: '2',
      userName: 'Rahul Verma',
      userEmail: 'rahul.verma@example.com',
      userUsername: '@rahulverma',
      userAvatar: 'https://i.pravatar.cc/150?img=12',
      userCredits: 25,
      userTier: 'free',
      amount: -500,
      quantity: 500,
      type: 'redeemed',
      source: 'payout',
      description: 'Creator Payout Withdrawal to Bank Account via UPI',
      currency: 'INR',
      isMoneyPayment: true,
      timestamp: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
};

export const [AdminProvider, useAdmin] = createContextHook<AdminContextValue>(() => {
  const { socket } = useSocket();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [users, setUsers] = useState<AdminUser[]>(seedAdminUsers);
  // const [reviews, setReviews] = useState<AdminReview[]>(seedReviews);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [certificationRequests, setCertificationRequests] = useState<CertificationRequest[]>(seedCertificationRequests);
  const [transactions, setTransactions] = useState<AdminTransaction[]>(seedAdminTransactions);
  const [transactionStats, setTransactionStats] = useState<AdminTransactionStats>(() => {
    const seeds = seedAdminTransactions();
    const totalCreditsEarned = seeds.filter(t => t.type === 'earned' && !t.isMoneyPayment).reduce((sum, t) => sum + t.amount, 0);
    const totalCreditsRedeemed = seeds.filter(t => t.type === 'redeemed' && !t.isMoneyPayment).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalMoneyVolume = seeds.filter(t => t.isMoneyPayment && t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    return {
      totalTransactions: seeds.length,
      totalCreditsEarned,
      totalCreditsRedeemed,
      totalMoneyVolume,
      pointTransactionsCount: seeds.filter(t => !t.isMoneyPayment).length,
      paymentOrdersCount: seeds.filter(t => t.isMoneyPayment).length,
    };
  });

  const adminLogin = useCallback(async (email: string, password: string) => {
    console.log('[Admin] Login attempt', { email });
    const normalizedEmail = email.trim().toLowerCase();
    if (
      (normalizedEmail === 'admin@leteski.com' ||
        normalizedEmail === 'admin@skillswap.app' ||
        normalizedEmail === ADMIN_CREDENTIALS.email) &&
      password === ADMIN_CREDENTIALS.password
    ) {
      await AsyncStorage.setItem(ADMIN_SESSION_KEY, 'true');
      setIsAdminAuthenticated(true);
      console.log('[Admin] Login successful');
    } else {
      console.warn('[Admin] Login failed - invalid credentials');
      throw new Error('Invalid admin credentials');
    }
  }, []);

  const adminLogout = useCallback(async () => {
    console.log('[Admin] Logging out');
    await AsyncStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAdminAuthenticated(false);
  }, []);

  // Restore admin session on mount
  useEffect(() => {
    (async () => {
      try {
        const session = await AsyncStorage.getItem(ADMIN_SESSION_KEY);
        if (session === 'true') {
          setIsAdminAuthenticated(true);
        }
      } catch (error) {
        console.error('[Admin] Failed to restore session:', error);
      }
    })();
  }, []);
  async function allusers() {
    let alluser = await getUsers()
    const seedAdminUser = alluser.map((user, index) => ({
      ...user,
      email: user.email ? user.email : `${user.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      // banStatus: 'active' as BanStatus,
      // reportCount: Math.floor(Math.random() * 5),
    }));
    // console.log("seed", seedAdminUser);
    setUsers(seedAdminUser)
  }


  async function fetchReviews() {
    const fullUrl = `${url}/admin/users/reviews`;
    try {
      console.log(`[Admin] Fetching: ${fullUrl}`);
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch reviews (${response.status})`);
      }
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error(`[Admin] JSON Parse failed for ${fullUrl}. Response snippet:`, text.substring(0, 200));
        throw parseErr;
      }
      setReviews(data.reviews);
    } catch (error) {
      console.error('[Admin] Fetch reviews failed', error);
    }
  }

  async function fetchVerificationRequests() {
    const fullUrl = `${url}/admin/users/verifications`;
    try {
      console.log(`[Admin] Fetching: ${fullUrl}`);
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch verification requests (${response.status})`);
      }
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error(`[Admin] JSON Parse failed for ${fullUrl}. Response snippet:`, text.substring(0, 200));
        throw parseErr;
      }
      console.log(data);

      const formatted: VerificationRequest[] = data.verifications
        .filter((v: any) => v.userId)
        .map(
          (v: any) => ({
            id: v._id,
            userId: v.userId._id,
            userName: v.userId.name,
            userAvatar: v.userId.avatarUrl || '',
            type: v.type,
            status: v.status,
            submittedAt: v.createdAt,
            details: v.details,
            documentUrl: v.documentUrl,
          })
        );

      setVerificationRequests(formatted);
    } catch (error) {
      console.error('[Admin] Fetch verifications failed', error);
    }
  }

  async function fetchCertifications() {
    try {
      const stored = await AsyncStorage.getItem(CERTIFICATIONS_STORAGE_KEY);
      let requests: CertificationRequest[] = stored ? JSON.parse(stored) : seedCertificationRequests();

      // Scan backend skills to include all live uploaded certificates
      try {
        const res = await fetch(`${url}/skills/with-users`);
        if (res.ok) {
          const skills = await res.json();
          if (Array.isArray(skills)) {
            skills.forEach((sk: any) => {
              if (sk.certificateUri) {
                const userId = String(sk.userId?._id || sk.userId?.id || sk.userId || '');
                const skillId = String(sk._id || sk.id || '');
                const existingIdx = requests.findIndex(r => String(r.userId) === userId && (String(r.skillId) === skillId || String(r.id) === `cr-db-${skillId}`));
                const reviewNote = sk.certificateReviewNote || sk.reviewNote;
                const reviewedAt = sk.certificateReviewedAt || sk.reviewedAt;

                if (existingIdx === -1) {
                  requests.unshift({
                    id: `cr-db-${skillId}`,
                    userId,
                    userName: sk.user?.name || 'Teacher',
                    userAvatar: sk.user?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                    skillId,
                    skillTitle: sk.title || 'Skill',
                    documentUri: sk.certificateUri,
                    status: (sk.certificateStatus as CertificationStatus) || 'pending',
                    submittedAt: sk.createdAt || new Date().toISOString(),
                    reviewedAt,
                    reviewNote,
                  });
                } else {
                  requests[existingIdx].documentUri = sk.certificateUri;
                  if (sk.certificateStatus) {
                    requests[existingIdx].status = sk.certificateStatus;
                  }
                  if (reviewNote !== undefined) {
                    requests[existingIdx].reviewNote = reviewNote;
                  }
                  if (reviewedAt !== undefined) {
                    requests[existingIdx].reviewedAt = reviewedAt;
                  }
                }
              }
            });
          }
        }
      } catch (dbErr) {
        console.warn('[Admin] Scan backend skills for certificates error:', dbErr);
      }

      // Also scan users teacherProfile.certifications from onboarding
      try {
        const userRes = await fetch(`${url}/users`);
        if (userRes.ok) {
          const userList = await userRes.json();
          if (Array.isArray(userList)) {
            userList.forEach((u: any) => {
              const uId = String(u._id || u.id || '');
              const certs = u.teacherProfile?.certifications || [];
              certs.forEach((cert: any) => {
                if (cert.documentUri) {
                  const certId = String(cert.id || cert._id || 'c1');
                  const reqId = `cr-usr-${uId}-${certId}`;
                  const existingIdx = requests.findIndex(r => r.id === reqId || (String(r.userId) === uId && String(r.skillId) === certId));

                  if (existingIdx === -1) {
                    requests.unshift({
                      id: reqId,
                      userId: uId,
                      userName: u.name || 'Teacher',
                      userAvatar: u.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                      skillId: certId,
                      skillTitle: cert.title || 'Teaching Certification',
                      documentUri: cert.documentUri,
                      status: (cert.status as CertificationStatus) || 'pending',
                      submittedAt: cert.submittedAt || new Date().toISOString(),
                      reviewedAt: cert.reviewedAt,
                      reviewNote: cert.reviewNote,
                    });
                  } else {
                    requests[existingIdx].documentUri = cert.documentUri;
                    if (cert.status) {
                      requests[existingIdx].status = cert.status;
                    }
                    if (cert.reviewNote !== undefined) {
                      requests[existingIdx].reviewNote = cert.reviewNote;
                    }
                    if (cert.reviewedAt !== undefined) {
                      requests[existingIdx].reviewedAt = cert.reviewedAt;
                    }
                  }
                }
              });
            });
          }
        }
      } catch (userErr) {
        console.warn('[Admin] Scan users for certifications error:', userErr);
      }

      setCertificationRequests(requests);
      await AsyncStorage.setItem(CERTIFICATIONS_STORAGE_KEY, JSON.stringify(requests)).catch(() => {});
    } catch (error) {
      console.error('[Admin] Fetch certifications failed', error);
    }
  };

  const fetchTransactions = useCallback(async (params?: { type?: string; source?: string; search?: string }) => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.type && params.type !== 'all') queryParams.append('type', params.type);
      if (params?.source && params.source !== 'all') queryParams.append('source', params.source);
      if (params?.search && params.search.trim().length > 0) queryParams.append('search', params.search.trim());

      const endpoint = `${url}/admin/transactions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
          if (data.stats) {
            setTransactionStats(data.stats);
          }
          return;
        }
      }
    } catch (err) {
      console.warn('[Admin] Fetch transactions error:', err);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        await Promise.all([
          allusers(),
          fetchReviews(),
          fetchVerificationRequests(),
          fetchCertifications(),
          fetchTransactions(),
        ]);
      } catch (error) {
        console.error('[Admin] Fetch data failed', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [fetchTransactions]);

  // Real-time socket listener for certifications
  useEffect(() => {
    if (!socket) return;

    const handleCertificationEvent = (data: any) => {
      console.log('[Socket.IO Admin] Certification real-time event received:', data);
      fetchCertifications();
    };

    socket.on('certification_submitted', handleCertificationEvent);
    socket.on('certification_updated', handleCertificationEvent);
    socket.on('skill_updated', handleCertificationEvent);

    return () => {
      socket.off('certification_submitted', handleCertificationEvent);
      socket.off('certification_updated', handleCertificationEvent);
      socket.off('skill_updated', handleCertificationEvent);
    };
  }, [socket]);

  // const banUser = useCallback((userId: string, reason: string) => {
  //   console.log('[Admin] Banning user', { userId, reason });
  //   setUsers(prev => prev.map(u =>
  //     u.id === userId ? { ...u, banStatus: 'banned' as BanStatus, banReason: reason, bannedAt: new Date().toISOString() } : u
  //   ));
  // }, []);


  const banUser = useCallback(async (userId: string, reason: string) => {
    try {
      console.log('[Admin] Banning user', { userId, reason });

      // 🔹 Optimistic UI
      setUsers(prev =>
        prev.map(u =>
          u.id === userId
            ? {
              ...u,
              banStatus: 'banned',
              banReason: reason,
              bannedAt: new Date().toISOString(),
            }
            : u
        )
      );

      const response = await fetch(
        `${url}/admin/users/${userId}/ban`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason }),
        }
      );


      if (!response.ok) {
        throw new Error('Failed to ban user');
      }

      const data = await response.json();

      // 🔹 Sync with DB truth
      setUsers(prev =>
        prev.map(u =>
          u.id === data.user._id
            ? { ...u, ...data.user, id: data.user._id }
            : u
        )
      );

    } catch (error) {
      console.error('[Admin] Ban failed', error);
    }
  }, []);

  const unbanUser = useCallback(async (userId: string) => {
    try {
      console.log('[Admin] Unbanning user', { userId });

      // 🔹 Optimistic UI
      setUsers(prev =>
        prev.map(u =>
          u.id === userId
            ? {
              ...u,
              banStatus: 'active',
              banReason: undefined,
              bannedAt: undefined,
            }
            : u
        )
      );

      const response = await fetch(
        `${url}/admin/users/${userId}/unban`,
        {
          method: 'PATCH',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to unban user');
      }

      const data = await response.json();

      // 🔹 Sync with DB
      setUsers(prev =>
        prev.map(u =>
          u.id === data.user._id
            ? { ...u, ...data.user, id: data.user._id }
            : u
        )
      );

    } catch (error) {
      console.error('[Admin] Unban failed', error);
    }
  }, []);

  const suspendUser = useCallback(
    async (userId: string, reason: string, days = 7) => {
      try {
        const numDays = Math.max(1, days || 7);
        const suspendedUntil = new Date(Date.now() + numDays * 24 * 60 * 60 * 1000).toISOString();
        console.log('[Admin] Suspending user', { userId, reason, days: numDays });

        // 🔹 Optimistic UI
        setUsers(prev =>
          prev.map(u =>
            u.id === userId
              ? {
                ...u,
                banStatus: 'suspended',
                banReason: reason,
                bannedAt: new Date().toISOString(),
                suspendedUntil,
                daysSuspended: numDays,
              }
              : u
          )
        );

        const response = await fetch(
          `${url}/admin/users/${userId}/suspend`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason, days: numDays }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to suspend user');
        }

        const data = await response.json();

        // 🔹 Sync with DB
        setUsers(prev =>
          prev.map(u =>
            u.id === data.user._id
              ? { ...u, ...data.user, id: data.user._id }
              : u
          )
        );

      } catch (error) {
        console.error('[Admin] Suspend failed', error);
      }
    },
    []
  );

  const updateUserCredits = useCallback(
    async (userId: string, credits: number) => {
      try {
        console.log('[Admin] Updating credits', { userId, credits });

        // 🔹 Optimistic UI
        setUsers(prev =>
          prev.map(u =>
            u.id === userId
              ? { ...u, credits }
              : u
          )
        );

        const response = await fetch(
          `${url}/admin/users/${userId}/credits`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credits }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to update credits');
        }

        const data = await response.json();

        // 🔹 Sync with DB
        setUsers(prev =>
          prev.map(u =>
            u.id === data.user._id
              ? { ...u, ...data.user, id: data.user._id }
              : u
          )
        );

      } catch (error) {
        console.error('[Admin] Update credits failed', error);
      }
    },
    []
  );

  const approveReview = useCallback(
    async (reviewId: string, note?: string) => {
      try {
        console.log('[Admin] Approving review', { reviewId, note });

        // 🔹 Optimistic UI
        setReviews(prev =>
          prev.map(r =>
            r.id === reviewId
              ? {
                ...r,
                moderationStatus: 'approved',
                moderatedAt: new Date().toISOString(),
                moderationNote: note,
              }
              : r
          )
        );

        const response = await fetch(
          `${url}/admin/users/reviews/${reviewId}/approve`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to approve review');
        }

        const data = await response.json();

        // 🔹 Sync with DB truth
        setReviews(prev =>
          prev.map(r =>
            r.id === data.review._id
              ? {
                ...r,
                ...data.review,
                id: data.review._id,
              }
              : r
          )
        );

      } catch (error) {
        console.error('[Admin] Approve failed', error);
      }
    },
    []
  );

  const rejectReview = useCallback(
    async (reviewId: string, note: string) => {
      try {
        console.log('[Admin] Rejecting review', { reviewId, note });

        // 🔹 Optimistic UI
        setReviews(prev =>
          prev.map(r =>
            r.id === reviewId
              ? {
                ...r,
                moderationStatus: 'rejected',
                moderatedAt: new Date().toISOString(),
                moderationNote: note,
              }
              : r
          )
        );

        const response = await fetch(
          `${url}/admin/users/reviews/${reviewId}/reject`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to reject review');
        }

        const data = await response.json();

        // 🔹 Sync with DB
        setReviews(prev =>
          prev.map(r =>
            r.id === data.review._id
              ? {
                ...r,
                ...data.review,
                id: data.review._id,
              }
              : r
          )
        );

      } catch (error) {
        console.error('[Admin] Reject failed', error);
      }
    },
    []
  );

  const approveVerification = useCallback(
    async (requestId: string) => {
      try {
        const response = await fetch(
          `${url}/admin/users/verifications/${requestId}/approve`,
          { method: 'PATCH' }
        );

        if (!response.ok) {
          throw new Error('Failed to approve');
        }

        const data = await response.json();

        setVerificationRequests(prev =>
          prev.map(v =>
            v.id === requestId
              ? { ...v, status: 'verified' }
              : v
          )
        );

      } catch (error) {
        console.error('[Admin] Approve verification failed', error);
      }
    },
    []
  );

  const rejectVerification = useCallback(
    async (requestId: string, reason: string) => {
      try {
        const response = await fetch(
          `${url}/admin/users/verifications/${requestId}/reject`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
          }
        );

        console.log(response);


        if (!response.ok) {
          throw new Error('Failed to reject');
        }

        setVerificationRequests(prev =>
          prev.map(v =>
            v.id === requestId
              ? { ...v, status: 'rejected' }
              : v
          )
        );

      } catch (error) {
        console.error('[Admin] Reject verification failed', error);
      }
    },
    []
  );

  const submitCertification = useCallback((input: SubmitCertificationInput) => {
    console.log('[Admin] New certification request', { userId: input.userId, skillId: input.skillId });
    setCertificationRequests(prev => {
      const entry: CertificationRequest = {
        id: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ...input,
        status: 'pending',
        submittedAt: new Date().toISOString(),
      };
      const existingIdx = prev.findIndex(c => String(c.userId) === String(input.userId) && String(c.skillId) === String(input.skillId));
      let next: CertificationRequest[];
      if (existingIdx >= 0) {
        next = [...prev];
        next[existingIdx] = entry;
      } else {
        next = [entry, ...prev];
      }
      AsyncStorage.setItem(CERTIFICATIONS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });

    if (input.skillId && !input.skillId.startsWith('onboard-')) {
      fetch(`${url}/skills/${input.skillId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificateUri: input.documentUri,
          certificateStatus: 'pending',
        }),
      }).catch(e => console.warn('[Admin] Sync skill certificate error:', e));
    }
  }, []);

  const approveCertification = useCallback(async (requestId: string) => {
    console.log('[Admin] Approving certification', { requestId });
    let targetSkillId = '';
    let targetUserId = '';

    setCertificationRequests(prev => {
      const target = prev.find(c => String(c.id) === String(requestId) || String(c.skillId) === String(requestId));
      targetSkillId = target?.skillId || String(requestId).replace('cr-db-', '').replace('cr-usr-', '');
      targetUserId = target?.userId || '';
      const next = prev.map(c =>
        (String(c.id) === String(requestId) || String(c.skillId) === String(requestId))
          ? {
              ...c,
              status: 'approved' as CertificationStatus,
              reviewedAt: new Date().toISOString(),
              reviewNote: 'Certificate approved by Admin',
            }
          : c
      );
      AsyncStorage.setItem(CERTIFICATIONS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });

    // Sync to user profile certifications if applicable
    if (targetUserId) {
      try {
        await fetch(`${url}/users/${targetUserId}/certifications/${targetSkillId}/approve`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: 'Certificate approved by Admin' }),
        });
      } catch (e) {
        console.warn('[Admin] Sync user cert approve error:', e);
      }
    }

    if (targetSkillId && !targetSkillId.startsWith('onboard-')) {
      const cleanSkillId = targetSkillId.replace('cr-db-', '').replace('cr-usr-', '');
      const isMongoId = /^[0-9a-fA-F]{24}$/.test(cleanSkillId);
      if (isMongoId) {
        try {
          const res = await fetch(`${url}/skills/${cleanSkillId}/certificate/approve`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: 'Certificate approved by Admin' }),
          });
          if (!res.ok) {
            await fetch(`${url}/skills/${cleanSkillId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                certificateStatus: 'approved',
                certificateReviewNote: 'Certificate approved by Admin',
                certificateReviewedAt: new Date().toISOString(),
              }),
            });
          }
        } catch (e) {
          console.warn('[Admin] Sync approve error:', e);
        }
      }
    }
  }, []);

  const rejectCertification = useCallback(async (requestId: string, reason: string) => {
    console.log('[Admin] Rejecting certification', { requestId, reason });
    let targetSkillId = '';
    let targetUserId = '';

    setCertificationRequests(prev => {
      const target = prev.find(c => String(c.id) === String(requestId) || String(c.skillId) === String(requestId));
      targetSkillId = target?.skillId || String(requestId).replace('cr-db-', '').replace('cr-usr-', '');
      targetUserId = target?.userId || '';
      const next = prev.map(c =>
        (String(c.id) === String(requestId) || String(c.skillId) === String(requestId))
          ? {
              ...c,
              status: 'rejected' as CertificationStatus,
              reviewedAt: new Date().toISOString(),
              reviewNote: reason,
            }
          : c
      );
      AsyncStorage.setItem(CERTIFICATIONS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });

    // Sync to user profile certifications if applicable
    if (targetUserId) {
      try {
        await fetch(`${url}/users/${targetUserId}/certifications/${targetSkillId}/reject`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        });
      } catch (e) {
        console.warn('[Admin] Sync user cert reject error:', e);
      }
    }

    if (targetSkillId && !targetSkillId.startsWith('onboard-')) {
      const cleanSkillId = targetSkillId.replace('cr-db-', '').replace('cr-usr-', '');
      const isMongoId = /^[0-9a-fA-F]{24}$/.test(cleanSkillId);
      if (isMongoId) {
        try {
          const res = await fetch(`${url}/skills/${cleanSkillId}/certificate/reject`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
          });
          if (!res.ok) {
            await fetch(`${url}/skills/${cleanSkillId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                certificateStatus: 'rejected',
                certificateReviewNote: reason,
                certificateReviewedAt: new Date().toISOString(),
              }),
            });
          }
        } catch (e) {
          console.warn('[Admin] Sync reject error:', e);
        }
      }
    }
  }, []);

  const getSkillCertificationStatus = useCallback((userId: string, skillId: string): CertificationStatus | null => {
    const uStr = String(userId || '');
    const sStr = String(skillId || '');
    const forSkill = certificationRequests.filter(c => String(c.userId) === uStr && String(c.skillId) === sStr);
    if (forSkill.length === 0) return null;
    if (forSkill.some(c => c.status === 'approved')) return 'approved';
    const latest = [...forSkill].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
    return latest?.status ?? null;
  }, [certificationRequests]);

  const stats = useMemo(() => ({
    totalUsers: users.length,
    activeUsers: users.filter(u => u.banStatus === 'active').length,
    bannedUsers: users.filter(u => u.banStatus === 'banned').length,
    pendingReviews: reviews.filter(r => r.moderationStatus === 'pending').length,
    pendingVerifications: verificationRequests.filter(vr => vr.status === 'pending').length,
    pendingCertifications: certificationRequests.filter(c => c.status === 'pending').length,
    totalSwaps: users.reduce((sum, u) => sum + u.totalSwaps, 0),
  }), [users, reviews, verificationRequests, certificationRequests]);

  return useMemo<AdminContextValue>(() => ({
    users,
    reviews,
    verificationRequests,
    certificationRequests,
    transactions,
    transactionStats,
    fetchTransactions,
    isAdminAuthenticated,
    adminLogin,
    adminLogout,
    banUser,
    unbanUser,
    suspendUser,
    updateUserCredits,
    approveReview,
    rejectReview,
    approveVerification,
    rejectVerification,
    submitCertification,
    approveCertification,
    rejectCertification,
    getSkillCertificationStatus,
    refreshCertifications: fetchCertifications,
    stats,
    isLoading,
  }), [users, reviews, verificationRequests, certificationRequests, transactions, transactionStats, fetchTransactions, isAdminAuthenticated, adminLogin, adminLogout, banUser, unbanUser, suspendUser, updateUserCredits, approveReview, rejectReview, approveVerification, rejectVerification, submitCertification, approveCertification, rejectCertification, getSkillCertificationStatus, stats, isLoading]);
});
