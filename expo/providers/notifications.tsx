import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useCurrentUser } from './current-user';
import { useSkillSwaps } from './skill-swaps';
import { usePushNotifications } from '../lib/push-notifications';
import { trpc } from '../lib/trpc';

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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const { expoPushToken, schedulePushNotification } = usePushNotifications();
  
  const registerTokenMutation = trpc.notifications.registerPushToken.useMutation();

  const matchSeenRef = useRef<Set<string>>(new Set());
  const swapSeenRef = useRef<Map<string, string>>(new Map());
  const reminderSeenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (expoPushToken && expoPushToken.length > 0) {
      registerTokenMutation.mutate({ token: expoPushToken });
      console.log('[Notifications] Registered push token with backend');
    }
  }, [expoPushToken]);

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
    topRecommendations.forEach((recommendation) => {
      if (matchSeenRef.current.has(recommendation.user.id)) {
        return;
      }
      matchSeenRef.current.add(recommendation.user.id);
      addNotification({
        category: 'match',
        title: 'Fresh match discovered',
        body: `${recommendation.user.name} is a ${recommendation.compatibility}% compatibility partner. Explore their profile to connect.`,
        metadata: {
          userId: recommendation.user.id,
        },
      });
    });
  }, [addNotification, topRecommendations]);

  useEffect(() => {
    swaps.forEach((swap) => {
      const counterpartId = swap.requesterId === currentUser.id ? swap.recipientId : swap.requesterId;
      const key = `${swap.id}-${swap.status}`;
      const previousKey = swapSeenRef.current.get(swap.id);
      if (previousKey === key) {
        return;
      }
      swapSeenRef.current.set(swap.id, key);

      if (swap.recipientId === currentUser.id && swap.status === 'pending') {
        const counterpart = allUsers.find((user) => user.id === counterpartId);
        addNotification({
          category: 'swap',
          title: 'New swap request',
          body: `${counterpart?.name ?? 'A community member'} sent you a new skill swap request. Review their proposal now.`,
          metadata: {
            swapId: swap.id,
          },
        });
        return;
      }

      if (swap.requesterId === currentUser.id && swap.status === 'negotiating') {
        const counterpart = allUsers.find((user) => user.id === counterpartId);
        addNotification({
          category: 'swap',
          title: 'Counter proposal received',
          body: `${counterpart?.name ?? 'Your partner'} shared new time options for your swap.`,
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
          body: `Your session with ${counterpart?.name ?? 'your partner'} is confirmed. Add it to your calendar and get ready!`,
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
          body: `Nice work! Your swap with ${counterpart?.name ?? 'your partner'} is done. Leave a review to help the community.`,
          metadata: {
            swapId: swap.id,
          },
        });
      }
    });
  }, [addNotification, allUsers, currentUser.id, swaps]);

  useEffect(() => {
    const createReminderNotifications = () => {
      const now = Date.now();
      scheduledSwaps.forEach((swap) => {
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
        const counterpartId = swap.requesterId === currentUser.id ? swap.recipientId : swap.requesterId;
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
              body: `Your swap with ${counterpart?.name ?? 'your partner'} starts in ${humanReadable}. Pull up your prep notes!`,
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
  }, [addNotification, allUsers, currentUser.id, scheduledSwaps]);

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
