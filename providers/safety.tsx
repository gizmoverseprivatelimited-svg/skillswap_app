import { useCallback, useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import url from '@/constants/backurl';
import { useAuth } from './auth';
import { useSocket } from './socket';
import type { UserReport, BlockedUser, ReportReason, ReportStatus, ReportAction } from '../types';

const REPORT_REASONS: { key: ReportReason; label: string; icon: string }[] = [
  { key: 'harassment', label: 'Harassment or Bullying', icon: '😠' },
  { key: 'inappropriate_content', label: 'Inappropriate Content', icon: '🚫' },
  { key: 'spam_or_scam', label: 'Spam or Scam', icon: '🎣' },
  { key: 'fake_profile', label: 'Fake or Impersonation', icon: '🎭' },
  { key: 'hate_speech', label: 'Hate Speech', icon: '💬' },
  { key: 'threats', label: 'Threats or Violence', icon: '⚠️' },
  { key: 'other', label: 'Other (describe below)', icon: '📋' },
];

interface BlockStatusResult {
  isBlockedByMe: boolean;
  hasBlockedMe: boolean;
  isBlocked: boolean;
}

interface SafetyContextValue {
  reports: UserReport[];
  blockedUsers: BlockedUser[];
  reportReasons: typeof REPORT_REASONS;
  submitReport: (
    reporterId: string,
    reportedUserId: string,
    reason: ReportReason,
    description: string,
    extraInfo?: { reporterName?: string; reporterAvatar?: string; reportedUserName?: string; reportedUserAvatar?: string }
  ) => Promise<void>;
  isBlocked: (blockedUserId: string, byUserId?: string) => boolean;
  checkBlockStatus: (targetUserId: string) => Promise<BlockStatusResult>;
  blockUser: (userId: string, blockedUserId: string, userInfo?: { name?: string; avatarUrl?: string }) => Promise<void>;
  unblockUser: (blockedUserId: string, userId?: string) => Promise<void>;
  resolveReport: (reportId: string, action: ReportAction, note?: string) => Promise<void>;
  pendingReportsCount: number;
  fetchReports: () => Promise<void>;
  fetchBlockedUsers: (userId?: string) => Promise<void>;
}

export const [SafetyProvider, useSafety] = createContextHook<SafetyContextValue>(() => {
  const { socket } = useSocket();
  const auth = useAuth();
  const currentUserId = auth?.user?.id || (auth?.user as any)?._id || '';

  const [reports, setReports] = useState<UserReport[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);

  const getStorageKey = useCallback((userId: string) => {
    return `@leteski/blocked_users_${userId}`;
  }, []);

  const persistBlocks = useCallback(async (userId: string, next: BlockedUser[]) => {
    if (!userId) return;
    try {
      await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(next));
    } catch (e) {
      console.error('[Safety] Failed to persist blocks:', e);
    }
  }, [getStorageKey]);

  const fetchBlockedUsers = useCallback(async (targetUserId?: string) => {
    const uid = targetUserId || currentUserId;
    if (!uid) {
      setBlockedUsers([]);
      return;
    }

    // 1. Try local storage first for instant load
    try {
      const stored = await AsyncStorage.getItem(getStorageKey(uid));
      if (stored) {
        setBlockedUsers(JSON.parse(stored) as BlockedUser[]);
      }
    } catch (e) {
      console.error('[Safety] Failed to restore local blocks:', e);
    }

    // 2. Fetch from backend
    try {
      const res = await fetch(`${url}/users/${uid}/blocked`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.blockedUsers)) {
          setBlockedUsers(data.blockedUsers);
          await AsyncStorage.setItem(getStorageKey(uid), JSON.stringify(data.blockedUsers));
        }
      }
    } catch (err) {
      console.warn('[Safety] Failed to fetch blocked users from backend:', err);
    }
  }, [currentUserId, getStorageKey]);

  // Sync blocked users when current user changes
  useEffect(() => {
    if (currentUserId) {
      fetchBlockedUsers(currentUserId);
    } else {
      setBlockedUsers([]);
    }
  }, [currentUserId, fetchBlockedUsers]);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch(`${url}/reports`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.reports)) {
          setReports(data.reports);
        }
      }
    } catch (err) {
      console.warn('[Safety] Failed to fetch reports from backend:', err);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Real-time socket listener for reports and safety events
  useEffect(() => {
    if (!socket) return;

    const handleReportEvent = (data: any) => {
      console.log('[Socket.IO Safety] Report event received:', data);
      fetchReports();
    };

    socket.on('report_created', handleReportEvent);
    socket.on('report_updated', handleReportEvent);
    socket.on('report_resolved', handleReportEvent);

    return () => {
      socket.off('report_created', handleReportEvent);
      socket.off('report_updated', handleReportEvent);
      socket.off('report_resolved', handleReportEvent);
    };
  }, [socket, fetchReports]);

  const submitReport = useCallback(
    async (
      reporterId: string,
      reportedUserId: string,
      reason: ReportReason,
      description: string,
      extraInfo?: { reporterName?: string; reporterAvatar?: string; reportedUserName?: string; reportedUserAvatar?: string }
    ) => {
      const tempReport: UserReport = {
        id: `temp-${Date.now()}`,
        reporterId,
        reporterName: extraInfo?.reporterName || 'User',
        reporterAvatar: extraInfo?.reporterAvatar || '',
        reportedUserId,
        reportedUserName: extraInfo?.reportedUserName || 'User',
        reportedUserAvatar: extraInfo?.reportedUserAvatar || '',
        reason,
        description: description.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      // Optimistic update
      setReports((prev) => [tempReport, ...prev]);

      try {
        const res = await fetch(`${url}/reports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reporterId,
            reportedUserId,
            reason,
            description: description.trim(),
            reporterName: extraInfo?.reporterName,
            reporterAvatar: extraInfo?.reporterAvatar,
            reportedUserName: extraInfo?.reportedUserName,
            reportedUserAvatar: extraInfo?.reportedUserAvatar,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.report) {
            setReports((prev) =>
              prev.map((r) => (r.id === tempReport.id ? data.report : r))
            );
          }
        }
      } catch (err) {
        console.error('[Safety] Failed to submit report to backend:', err);
      }
    },
    [],
  );

  const isBlocked = useCallback(
    (blockedUserId: string, byUserId?: string) => {
      if (!blockedUserId) return false;
      const targetIdStr = String(blockedUserId);
      return blockedUsers.some((b) => String(b.blockedUserId) === targetIdStr);
    },
    [blockedUsers],
  );

  const checkBlockStatus = useCallback(
    async (targetUserId: string): Promise<BlockStatusResult> => {
      const uid = currentUserId;
      if (!uid || !targetUserId || String(uid) === String(targetUserId)) {
        return { isBlockedByMe: false, hasBlockedMe: false, isBlocked: false };
      }

      // Check local cache first
      const localBlocked = isBlocked(targetUserId);

      try {
        const res = await fetch(`${url}/users/${uid}/block-status/${targetUserId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            return {
              isBlockedByMe: Boolean(data.isBlockedByMe),
              hasBlockedMe: Boolean(data.hasBlockedMe),
              isBlocked: Boolean(data.isBlocked),
            };
          }
        }
      } catch (err) {
        console.warn('[Safety] Failed to check block status from backend:', err);
      }

      return {
        isBlockedByMe: localBlocked,
        hasBlockedMe: false,
        isBlocked: localBlocked,
      };
    },
    [currentUserId, isBlocked],
  );

  const blockUser = useCallback(
    async (userId: string, blockedUserId: string, userInfo?: { name?: string; avatarUrl?: string }) => {
      const uid = userId || currentUserId;
      if (!uid || !blockedUserId || String(uid) === String(blockedUserId)) return;

      const alreadyInList = blockedUsers.some((b) => String(b.blockedUserId) === String(blockedUserId));

      const entry: BlockedUser = {
        id: `blk-${Date.now()}`,
        blockedUserId: String(blockedUserId),
        blockedUserName: userInfo?.name || 'User',
        blockedUserAvatar: userInfo?.avatarUrl || '',
        blockedAt: new Date().toISOString(),
      };

      if (!alreadyInList) {
        const next = [...blockedUsers, entry];
        setBlockedUsers(next);
        void persistBlocks(uid, next);
      }

      try {
        const res = await fetch(`${url}/users/${uid}/block`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUserId: blockedUserId,
            name: userInfo?.name,
            avatarUrl: userInfo?.avatarUrl,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.blockedUsers)) {
            setBlockedUsers(data.blockedUsers);
            void persistBlocks(uid, data.blockedUsers);
          }
        }
      } catch (err) {
        console.error('[Safety] Failed to block user on backend:', err);
      }
    },
    [blockedUsers, currentUserId, persistBlocks],
  );

  const unblockUser = useCallback(
    async (blockedUserId: string, userId?: string) => {
      const uid = userId || currentUserId;
      if (!blockedUserId) return;

      const next = blockedUsers.filter((b) => String(b.blockedUserId) !== String(blockedUserId));
      setBlockedUsers(next);
      if (uid) {
        void persistBlocks(uid, next);
      }

      if (uid) {
        try {
          const res = await fetch(`${url}/users/${uid}/unblock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUserId: blockedUserId }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.blockedUsers)) {
              setBlockedUsers(data.blockedUsers);
              void persistBlocks(uid, data.blockedUsers);
            }
          }
        } catch (err) {
          console.error('[Safety] Failed to unblock user on backend:', err);
        }
      }
    },
    [blockedUsers, currentUserId, persistBlocks],
  );

  const resolveReport = useCallback(
    async (reportId: string, action: ReportAction, note?: string) => {
      console.log('[Safety] Resolving report', { reportId, action, note });
      const statusMap: Record<ReportAction, ReportStatus> = {
        warning: 'actioned',
        suspend: 'actioned',
        ban: 'actioned',
        dismiss: 'dismissed',
      };

      // Optimistic update
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? {
                ...r,
                status: statusMap[action],
                action,
                reviewedAt: new Date().toISOString(),
                adminNote: note,
              }
            : r,
        ),
      );

      try {
        const res = await fetch(`${url}/reports/${reportId}/resolve`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            note: note || '',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.report) {
            setReports((prev) =>
              prev.map((r) => (r.id === reportId ? data.report : r))
            );
          }
        }
      } catch (err) {
        console.error('[Safety] Failed to resolve report on backend:', err);
      }
    },
    [],
  );

  const pendingReportsCount = useMemo(
    () => reports.filter((r) => r.status === 'pending' || r.status === 'reviewing').length,
    [reports],
  );

  return useMemo<SafetyContextValue>(
    () => ({
      reports,
      blockedUsers,
      reportReasons: REPORT_REASONS,
      submitReport,
      isBlocked,
      checkBlockStatus,
      blockUser,
      unblockUser,
      resolveReport,
      pendingReportsCount,
      fetchReports,
      fetchBlockedUsers,
    }),
    [
      reports,
      blockedUsers,
      submitReport,
      isBlocked,
      checkBlockStatus,
      blockUser,
      unblockUser,
      resolveReport,
      pendingReportsCount,
      fetchReports,
      fetchBlockedUsers,
    ],
  );
});

