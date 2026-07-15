import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useCurrentUser } from './current-user';
import { useSkillSwaps } from './skill-swaps';
import { usePushNotifications } from '../lib/push-notifications';
import { useOnboarding } from './onboarding';
import url from '@/constants/backurl';

type NotificationCategory = 'match' | 'swap' | 'reminder' | 'system';

type NotificationMetadata = Record<string, unknown>;

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  category: NotificationCategory;
  read: boolean;
  metadata?: NotificationMetadata;
}

interface AddNotificationInput {
  title: string;
  body: string;
  category: NotificationCategory;
  metadata?: NotificationMetadata;
}

interface NotificationsContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (input: AddNotificationInput) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const REMINDER_THRESHOLDS_HOURS: number[] = [24, 1];

const generateNotificationId = (): string => {
  return `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const sortNotifications = (items: NotificationItem[]): NotificationItem[] => {
  return [...items].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
};

export const [NotificationsProvider, useNotifications] = createContextHook<NotificationsContextValue>(() => {
  const { currentUser, topRecommendations, allUsers } = useCurrentUser();
  const { swaps, scheduledSwaps } = useSkillSwaps();
  const { hasCompletedOnboarding } = useOnboarding();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const { expoPushToken, schedulePushNotification } = usePushNotifications();

  const matchSeenRef = useRef<Set<string>>(new Set());
  const swapSeenRef = useRef<Map<string, string>>(new Map());
  const reminderSeenRef = useRef<Set<string>>(new Set());
  const messageSeenRef = useRef<Set<string>>(new Set());
  const reviewSeenRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef<boolean>(true);
  const isInitialReviewsLoadRef = useRef<boolean>(true);
  const prevUserIdRef = useRef<string | undefined>(currentUser?.id);

  useEffect(() => {
    if (!hasCompletedOnboarding) return;
    if (expoPushToken && expoPushToken.length > 0 && currentUser?.id) {
      fetch(`${url}/users/push-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, token: expoPushToken }),
      })
        .then(() => console.log('[Notifications] Registered push token with backend'))
        .catch((err) => console.error('[Notifications] Failed to register token:', err));
    }
  }, [expoPushToken, currentUser?.id, hasCompletedOnboarding]);

  const addNotification = useCallback((input: AddNotificationInput) => {
    const payload: NotificationItem = {
      id: generateNotificationId(),
      title: input.title,
      body: input.body,
      category: input.category,
      metadata: input.metadata,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => sortNotifications([payload, ...prev]));
    console.log('[Notifications] Added notification', payload);
    
    schedulePushNotification(input.title, input.body, input.metadata ?? {});
  }, [schedulePushNotification]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => {
      return prev.map((notification) => {
        if (notification.id !== id) {
          return notification;
        }
        return { ...notification, read: true };
      });
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    if (!hasCompletedOnboarding) return;
    topRecommendations.forEach((recommendation) => {
      if (matchSeenRef.current.has(recommendation.user.id)) {
        return;
      }
      matchSeenRef.current.add(recommendation.user.id);
      addNotification({
        category: 'match',
        title: 'Fresh match discovered',
        body: `${recommendation.user.username ? `@${recommendation.user.username}` : recommendation.user.name} is a ${recommendation.compatibility}% compatibility partner. Explore their profile to connect.`,
        metadata: {
          userId: recommendation.user.id,
        },
      });
    });
  }, [addNotification, topRecommendations, hasCompletedOnboarding]);

  useEffect(() => {
    if (!hasCompletedOnboarding) return;
    swaps.forEach((swap) => {
      // Ensure the swap actually belongs to the current user
      if (swap.requesterId !== currentUser?.id && swap.recipientId !== currentUser?.id) {
        return;
      }
      const counterpartId = swap.requesterId === currentUser?.id ? swap.recipientId : swap.requesterId;
      const key = `${swap.id}-${swap.status}`;
      const previousKey = swapSeenRef.current.get(swap.id);
      if (previousKey === key) {
        return;
      }
      swapSeenRef.current.set(swap.id, key);

      if (swap.recipientId === currentUser?.id && swap.status === 'pending') {
        const counterpart = allUsers.find((user) => user.id === counterpartId);
        addNotification({
          category: 'swap',
          title: 'New swap request',
          body: `${counterpart?.username ? `@${counterpart.username}` : (counterpart?.name ?? 'A community member')} sent you a new skill swap request. Review their proposal now.`,
          metadata: {
            swapId: swap.id,
          },
        });
        return;
      }

      if (swap.requesterId === currentUser?.id && swap.status === 'negotiating') {
        const counterpart = allUsers.find((user) => user.id === counterpartId);
        addNotification({
          category: 'swap',
          title: 'Counter proposal received',
          body: `${counterpart?.username ? `@${counterpart.username}` : (counterpart?.name ?? 'Your partner')} shared new time options for your swap.`,
          metadata: {
            swapId: swap.id,
          },
        });
        return;
      }

      if (swap.status === 'scheduled' && swap.acceptedTimeId) {
        const counterpart = allUsers.find((user) => user.id === counterpartId);
        addNotification({
          category: 'swap',
          title: 'Swap confirmed',
          body: `Your session with ${counterpart?.username ? `@${counterpart.username}` : (counterpart?.name ?? 'your partner')} is confirmed. Add it to your calendar and get ready!`,
          metadata: {
            swapId: swap.id,
          },
        });
      }

      if (swap.status === 'completed') {
        const counterpart = allUsers.find((user) => user.id === counterpartId);
        addNotification({
          category: 'swap',
          title: 'Swap completed',
          body: `Nice work! Your swap with ${counterpart?.username ? `@${counterpart.username}` : (counterpart?.name ?? 'your partner')} is done. Leave a review to help the community.`,
          metadata: {
            swapId: swap.id,
          },
        });
      }
    });
  }, [addNotification, allUsers, currentUser?.id, swaps, hasCompletedOnboarding]);

  useEffect(() => {
    if (!hasCompletedOnboarding) return;
    const createReminderNotifications = () => {
      const now = Date.now();
      scheduledSwaps.forEach((swap) => {
        // Ensure the swap actually belongs to the current user
        if (swap.requesterId !== currentUser?.id && swap.recipientId !== currentUser?.id) {
          return;
        }
        if (!swap.acceptedTimeId) {
          return;
        }
        const acceptedSlot = swap.proposedTimes.find((slot) => slot.id === swap.acceptedTimeId);
        if (!acceptedSlot) {
          return;
        }
        const start = new Date(acceptedSlot.startISO).getTime();
        if (Number.isNaN(start) || start <= now) {
          return;
        }
        const diffHours = (start - now) / (1000 * 60 * 60);
        const counterpartId = swap.requesterId === currentUser?.id ? swap.recipientId : swap.requesterId;
        const counterpart = allUsers.find((user) => user.id === counterpartId);
        REMINDER_THRESHOLDS_HOURS.forEach((threshold) => {
          if (diffHours <= threshold && diffHours >= 0) {
            const key = `${swap.id}-${threshold}`;
            if (reminderSeenRef.current.has(key)) {
              return;
            }
            reminderSeenRef.current.add(key);
            const humanReadable = threshold >= 1 ? `${threshold} hour${threshold === 1 ? '' : 's'}` : 'soon';
            addNotification({
              category: 'reminder',
              title: 'Upcoming swap reminder',
              body: `Your swap with ${counterpart?.username ? `@${counterpart.username}` : (counterpart?.name ?? 'your partner')} starts in ${humanReadable}. Pull up your prep notes!`,
              metadata: {
                swapId: swap.id,
                startsAt: acceptedSlot.startISO,
              },
            });
          }
        });
      });
    };

    createReminderNotifications();

    const interval = globalThis.setInterval(createReminderNotifications, 60 * 1000);
    return () => {
      if (typeof interval === 'number') {
        globalThis.clearInterval(interval);
      } else {
        clearInterval(interval);
      }
    };
  }, [addNotification, allUsers, currentUser?.id, scheduledSwaps, hasCompletedOnboarding]);

  // Reset initial load and message/review refs when currentUser changes
  useEffect(() => {
    if (prevUserIdRef.current !== currentUser?.id || !hasCompletedOnboarding) {
      isInitialLoadRef.current = true;
      isInitialReviewsLoadRef.current = true;
      messageSeenRef.current.clear();
      reviewSeenRef.current.clear();
      matchSeenRef.current.clear();
      swapSeenRef.current.clear();
      reminderSeenRef.current.clear();
      setNotifications([]);
      prevUserIdRef.current = currentUser?.id;
    }
  }, [currentUser?.id, hasCompletedOnboarding]);

  // Monitor incoming chat messages and alert the user
  useEffect(() => {
    if (!hasCompletedOnboarding || !currentUser?.id || swaps.length === 0) {
      return;
    }

    if (isInitialLoadRef.current) {
      swaps.forEach((swap) => {
        if (Array.isArray(swap.negotiationNotes)) {
          swap.negotiationNotes.forEach((msg) => {
            const msgId = msg.id || (msg as any)._id || '';
            const isVideoCallAlert = msg.body.includes("started the video call");
            const isRecent = new Date(msg.createdAt).getTime() > Date.now() - 5 * 60 * 1000;
            
            // If it's a recent video call alert from the partner, don't mark as seen yet!
            if (isVideoCallAlert && isRecent && String(msg.authorId) !== String(currentUser.id)) {
              // Leave it out of messageSeenRef so the next pass will catch it
            } else {
              messageSeenRef.current.add(msgId);
            }
          });
        }
      });
      isInitialLoadRef.current = false;
      return;
    }

    swaps.forEach((swap) => {
      // Ensure the swap actually belongs to the current user
      if (String(swap.requesterId) !== String(currentUser?.id) && String(swap.recipientId) !== String(currentUser?.id)) {
        return;
      }
      const counterpartId = String(swap.requesterId) === String(currentUser?.id) ? swap.recipientId : swap.requesterId;
      const counterpart = allUsers.find((user) => String(user.id) === String(counterpartId));
      const senderName = counterpart?.username ? `@${counterpart.username}` : (counterpart?.name ?? 'Your partner');

      if (Array.isArray(swap.negotiationNotes)) {
        swap.negotiationNotes.forEach((msg) => {
          const msgId = msg.id || (msg as any)._id || '';
          if (!msgId) return;

          if (
            !messageSeenRef.current.has(msgId) &&
            String(msg.authorId) !== String(currentUser.id) &&
            !msg.isSystem
          ) {
            messageSeenRef.current.add(msgId);
            
            const isVideoCallAlert = msg.body.includes("started the video call");
            
            addNotification({
              category: isVideoCallAlert ? 'swap' : 'swap',
              title: isVideoCallAlert ? `Incoming Video Call from ${senderName}` : `New message from ${senderName}`,
              body: msg.body,
              metadata: {
                swapId: swap.id,
                type: isVideoCallAlert ? 'video-call' : undefined,
              },
            });
          } else {
            messageSeenRef.current.add(msgId);
          }
        });
      }
    });
  }, [swaps, currentUser?.id, allUsers, addNotification, hasCompletedOnboarding]);

  // Monitor incoming reviews and alert the user
  useEffect(() => {
    if (!hasCompletedOnboarding || !currentUser?.id || currentUser.id === '1') {
      return;
    }

    const checkNewReviews = async () => {
      try {
        const response = await fetch(`${url}/reviews?revieweeId=${currentUser.id}`);
        if (!response.ok) return;
        const data = await response.json();
        
        if (data && Array.isArray(data.reviews)) {
          if (isInitialReviewsLoadRef.current) {
            data.reviews.forEach((rev: any) => {
              reviewSeenRef.current.add(rev.id || rev._id || '');
            });
            isInitialReviewsLoadRef.current = false;
            return;
          }

          data.reviews.forEach((rev: any) => {
            const revId = rev.id || rev._id || '';
            if (!revId) return;

            if (!reviewSeenRef.current.has(revId)) {
              reviewSeenRef.current.add(revId);
              
              // Only alert if the reviewer is not the current user
              if (rev.reviewer?.id !== currentUser.id) {
                addNotification({
                  category: 'system',
                  title: 'New review received',
                  body: `${rev.reviewer?.name || 'A user'} gave you a ${rev.rating}-star review: "${rev.comment || ''}"`,
                  metadata: {
                    rating: rev.rating,
                  },
                });
              }
            }
          });
        }
      } catch (err) {
        console.error('[Notifications] Failed to check reviews:', err);
      }
    };

    checkNewReviews();
    const interval = setInterval(checkNewReviews, 15000);

    return () => {
      clearInterval(interval);
    };
  }, [currentUser?.id, addNotification, hasCompletedOnboarding]);

  const unreadCount = useMemo(() => {
    return notifications.filter((notification) => !notification.read).length;
  }, [notifications]);

  const value: NotificationsContextValue = useMemo(() => {
    return {
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearAll,
    };
  }, [notifications, unreadCount, addNotification, markAsRead, markAllAsRead, removeNotification, clearAll]);

  return value;
});
