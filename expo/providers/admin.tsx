import { useCallback, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mockUsers } from '../mocks/data';
import type { User, Review, SkillSwapRequest, UserVerifications, VerificationStatus } from '../types';

const ADMIN_SESSION_KEY = '@skillswap/admin_session';

const ADMIN_CREDENTIALS = {
  email: 'admin@skillswap.app',
  password: 'admin123',
};

export type BanStatus = 'active' | 'banned' | 'suspended';

export interface AdminUser extends User {
  email: string;
  banStatus: BanStatus;
  banReason?: string;
  bannedAt?: string;
  reportCount: number;
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

interface AdminContextValue {
  users: AdminUser[];
  reviews: AdminReview[];
  verificationRequests: VerificationRequest[];
  isAdminAuthenticated: boolean;
  adminLogin: (email: string, password: string) => Promise<void>;
  adminLogout: () => Promise<void>;
  banUser: (userId: string, reason: string) => void;
  unbanUser: (userId: string) => void;
  suspendUser: (userId: string, reason: string) => void;
  updateUserCredits: (userId: string, credits: number) => void;
  approveReview: (reviewId: string, note?: string) => void;
  rejectReview: (reviewId: string, note: string) => void;
  approveVerification: (requestId: string) => void;
  rejectVerification: (requestId: string, reason: string) => void;
  stats: {
    totalUsers: number;
    activeUsers: number;
    bannedUsers: number;
    pendingReviews: number;
    pendingVerifications: number;
    totalSwaps: number;
  };
}

const seedAdminUsers = (): AdminUser[] => {
  return mockUsers.map((user, index) => ({
    ...user,
    email: `${user.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    banStatus: 'active' as BanStatus,
    reportCount: Math.floor(Math.random() * 5),
  }));
};

const seedReviews = (): AdminReview[] => {
  const now = new Date();
  return [
    {
      id: 'rev-1',
      reviewerId: '2',
      revieweeId: '1',
      rating: 5,
      comment: 'Amazing photography session! Learned so much about lighting and composition.',
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      reviewerName: 'Rahul Verma',
      revieweeName: 'Priya Sharma',
      moderationStatus: 'approved',
    },
    {
      id: 'rev-2',
      reviewerId: '4',
      revieweeId: '3',
      rating: 4,
      comment: 'Great Hindi conversation practice. Very patient teacher.',
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      reviewerName: 'Arjun Mehta',
      revieweeName: 'Ananya Reddy',
      moderationStatus: 'pending',
    },
    {
      id: 'rev-3',
      reviewerId: '5',
      revieweeId: '6',
      rating: 2,
      comment: 'Session was okay but felt rushed. Could improve time management.',
      createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
      reviewerName: 'Kavya Nair',
      revieweeName: 'Vikram Singh',
      moderationStatus: 'pending',
      flaggedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      flagReason: 'Potentially unfair rating',
      flagReporterId: '6',
    },
    {
      id: 'rev-4',
      reviewerId: '1',
      revieweeId: '5',
      rating: 5,
      comment: 'Kavya is an incredible digital artist. Her teaching style is clear and inspiring!',
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      reviewerName: 'Priya Sharma',
      revieweeName: 'Kavya Nair',
      moderationStatus: 'approved',
    },
    {
      id: 'rev-5',
      reviewerId: '3',
      revieweeId: '2',
      rating: 1,
      comment: 'Did not show up for the session. Very unprofessional.',
      createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      reviewerName: 'Ananya Reddy',
      revieweeName: 'Rahul Verma',
      moderationStatus: 'pending',
      flaggedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      flagReason: 'Dispute - user claims they attended',
      flagReporterId: '2',
    },
    {
      id: 'rev-6',
      reviewerId: '6',
      revieweeId: '4',
      rating: 4,
      comment: 'Good piano fundamentals session. Would recommend for beginners.',
      createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      reviewerName: 'Vikram Singh',
      revieweeName: 'Arjun Mehta',
      moderationStatus: 'approved',
    },
  ];
};

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

export const [AdminProvider, useAdmin] = createContextHook<AdminContextValue>(() => {
  const [users, setUsers] = useState<AdminUser[]>(seedAdminUsers);
  const [reviews, setReviews] = useState<AdminReview[]>(seedReviews);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>(seedVerificationRequests);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);

  const adminLogin = useCallback(async (email: string, password: string) => {
    console.log('[Admin] Login attempt', { email });
    const normalizedEmail = email.trim().toLowerCase();
    if (
      normalizedEmail === ADMIN_CREDENTIALS.email &&
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
  useMemo(() => {
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

  const banUser = useCallback((userId: string, reason: string) => {
    console.log('[Admin] Banning user', { userId, reason });
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, banStatus: 'banned' as BanStatus, banReason: reason, bannedAt: new Date().toISOString() } : u
    ));
  }, []);

  const unbanUser = useCallback((userId: string) => {
    console.log('[Admin] Unbanning user', { userId });
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, banStatus: 'active' as BanStatus, banReason: undefined, bannedAt: undefined } : u
    ));
  }, []);

  const suspendUser = useCallback((userId: string, reason: string) => {
    console.log('[Admin] Suspending user', { userId, reason });
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, banStatus: 'suspended' as BanStatus, banReason: reason, bannedAt: new Date().toISOString() } : u
    ));
  }, []);

  const updateUserCredits = useCallback((userId: string, credits: number) => {
    console.log('[Admin] Updating credits', { userId, credits });
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, credits } : u
    ));
  }, []);

  const approveReview = useCallback((reviewId: string, note?: string) => {
    console.log('[Admin] Approving review', { reviewId, note });
    setReviews(prev => prev.map(r =>
      r.id === reviewId ? { ...r, moderationStatus: 'approved' as const, moderatedAt: new Date().toISOString(), moderationNote: note } : r
    ));
  }, []);

  const rejectReview = useCallback((reviewId: string, note: string) => {
    console.log('[Admin] Rejecting review', { reviewId, note });
    setReviews(prev => prev.map(r =>
      r.id === reviewId ? { ...r, moderationStatus: 'rejected' as const, moderatedAt: new Date().toISOString(), moderationNote: note } : r
    ));
  }, []);

  const approveVerification = useCallback((requestId: string) => {
    console.log('[Admin] Approving verification', { requestId });
    setVerificationRequests(prev => prev.map(vr =>
      vr.id === requestId ? { ...vr, status: 'verified' as VerificationStatus } : vr
    ));
  }, []);

  const rejectVerification = useCallback((requestId: string, reason: string) => {
    console.log('[Admin] Rejecting verification', { requestId, reason });
    setVerificationRequests(prev => prev.map(vr =>
      vr.id === requestId ? { ...vr, status: 'rejected' as VerificationStatus } : vr
    ));
  }, []);

  const stats = useMemo(() => ({
    totalUsers: users.length,
    activeUsers: users.filter(u => u.banStatus === 'active').length,
    bannedUsers: users.filter(u => u.banStatus === 'banned').length,
    pendingReviews: reviews.filter(r => r.moderationStatus === 'pending').length,
    pendingVerifications: verificationRequests.filter(vr => vr.status === 'pending').length,
    totalSwaps: users.reduce((sum, u) => sum + u.totalSwaps, 0),
  }), [users, reviews, verificationRequests]);

  return useMemo<AdminContextValue>(() => ({
    users,
    reviews,
    verificationRequests,
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
    stats,
  }), [users, reviews, verificationRequests, isAdminAuthenticated, adminLogin, adminLogout, banUser, unbanUser, suspendUser, updateUserCredits, approveReview, rejectReview, approveVerification, rejectVerification, stats]);
});
