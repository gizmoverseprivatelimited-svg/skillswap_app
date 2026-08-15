import { useCallback, useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import url from '@/constants/backurl';
import type { UserReport, BlockedUser, ReportReason, ReportStatus, ReportAction } from '../types';

const BLOCKS_KEY = '@leteski/blocked_users';

const REPORT_REASONS: { key: ReportReason; label: string; icon: string }[] = [
  { key: 'harassment', label: 'Harassment or Bullying', icon: '😠' },
  { key: 'inappropriate_content', label: 'Inappropriate Content', icon: '🚫' },
  { key: 'spam_or_scam', label: 'Spam or Scam', icon: '🎣' },
  { key: 'fake_profile', label: 'Fake or Impersonation', icon: '🎭' },
  { key: 'hate_speech', label: 'Hate Speech', icon: '💬' },
  { key: 'threats', label: 'Threats or Violence', icon: '⚠️' },
  { key: 'other', label: 'Other (describe below)', icon: '📋' },
];

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
  blockUser: (userId: string, blockedUserId: string, userInfo?: { name?: string; avatarUrl?: string }) => void;
  unblockUser: (blockedUserId: string) => void;
  resolveReport: (reportId: string, action: ReportAction, note?: string) => Promise<void>;
  pendingReportsCount: number;
  fetchReports: () => Promise<void>;
}

export const [SafetyProvider, useSafety] = createContextHook<SafetyContextValue>(() => {
  const [reports, setReports] = useState<UserReport[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);

  // Restore blocked users from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(BLOCKS_KEY);
        if (stored) {
          setBlockedUsers(JSON.parse(stored) as BlockedUser[]);
        }
      } catch (e) {
        console.error('[Safety] Failed to restore blocks:', e);
      }
    })();
  }, []);

  const persistBlocks = useCallback(async (next: BlockedUser[]) => {
    try {
      await AsyncStorage.setItem(BLOCKS_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('[Safety] Failed to persist blocks:', e);
    }
  }, []);

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
      return blockedUsers.some((b) => String(b.blockedUserId) === String(blockedUserId));
    },
    [blockedUsers],
  );

  const blockUser = useCallback(
    (userId: string, blockedUserId: string, userInfo?: { name?: string; avatarUrl?: string }) => {
      if (blockedUsers.some((b) => String(b.blockedUserId) === String(blockedUserId))) return;

      const entry: BlockedUser = {
        id: `blk-${Date.now()}`,
        blockedUserId,
        blockedUserName: userInfo?.name || 'User',
        blockedUserAvatar: userInfo?.avatarUrl || '',
        blockedAt: new Date().toISOString(),
      };
      console.log('[Safety] User blocked', { blockedUserId, byUserId: userId });
      const next = [...blockedUsers, entry];
      setBlockedUsers(next);
      void persistBlocks(next);
    },
    [blockedUsers, persistBlocks],
  );

  const unblockUser = useCallback(
    (blockedUserId: string) => {
      console.log('[Safety] User unblocked', { blockedUserId });
      const next = blockedUsers.filter((b) => String(b.blockedUserId) !== String(blockedUserId));
      setBlockedUsers(next);
      void persistBlocks(next);
    },
    [blockedUsers, persistBlocks],
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
      blockUser,
      unblockUser,
      resolveReport,
      pendingReportsCount,
      fetchReports,
    }),
    [reports, blockedUsers, submitReport, isBlocked, blockUser, unblockUser, resolveReport, pendingReportsCount, fetchReports],
  );
});
