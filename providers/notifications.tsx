import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';
import { useRouter, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCurrentUser } from './current-user';
import { useSkillSwaps } from './skill-swaps';
import { usePushNotifications } from '../lib/push-notifications';
import { useOnboarding } from './onboarding';
import { useAlert } from './alert';
import { useAuth } from './auth';
import url from '@/constants/backurl';
import { useSocket } from '@/providers/socket';

type NotificationCategory = 'match' | 'swap' | 'reminder' | 'system' | 'class';

type NotificationMetadata = Record<string, unknown>;

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  category: NotificationCategory;
  read: boolean;
  metadata?: NotificationMetadata;
  /** Only true for notifications genuinely received at runtime (not loaded from storage or generated during startup). Used by InAppNotificationBanner. */
  _receivedAtRuntime?: boolean;
}

interface AddNotificationInput {
  title: string;
  body: string;
  category: NotificationCategory;
  metadata?: NotificationMetadata;
  skipPopup?: boolean;
  eventKey?: string;
}

interface NotificationsContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (input: AddNotificationInput) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  /** The latest notification that should be shown as an in-app banner popup. Only set for genuinely runtime notifications. */
  bannerNotification: NotificationItem | null;
  /** Clear the current banner notification (after displaying or dismissing it). */
  clearBannerNotification: () => void;
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

const getStorageKey = (userId: string, type: 'items' | 'dismissed' | 'seen') => {
  return `@skillswap/notifications_${type}_${userId}`;
};

// Safe synchronous web storage helper
const getWebItem = (key: string): string | null => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return null;
};

const setWebItem = (key: string, value: string): void => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
    } catch { }
  }
};

const getEventKey = (input: { category?: string; title?: string; body?: string; eventKey?: string; metadata?: Record<string, unknown> }): string => {
  if (input.eventKey) return input.eventKey;
  if (input.metadata?.eventKey && typeof input.metadata.eventKey === 'string') return input.metadata.eventKey;
  if (input.metadata?.type === 'chat-message') {
    return `msg:${input.metadata.swapId || ''}:${input.metadata.authorId || ''}:${input.body || ''}:${Date.now()}`;
  }
  if (input.category && input.title) return `${input.category}:${input.title}`;
  return `${input.title || 'alert'}`;
};

export const [NotificationsProvider, useNotifications] = createContextHook<NotificationsContextValue>(() => {
  const auth = useAuth();
  const isAuthUser = Boolean(auth?.isAuthenticated && auth?.user && !auth?.user?.isDemo);
  const { currentUser, topRecommendations, allUsers } = useCurrentUser();
  const { swaps, scheduledSwaps } = useSkillSwaps();
  const { hasCompletedOnboarding } = useOnboarding();
  const { socket } = useSocket();
  const { showAlert } = useAlert();
  const router = useRouter();
  const pathname = usePathname();
  const mountTimestampRef = useRef<number>(Date.now());
  const lastCallPopupTimeRef = useRef<Map<string, number>>(new Map());

  // Handle both string and numeric/mongo IDs safely
  const currentUserId = currentUser ? String(currentUser.id || (currentUser as any)._id) : undefined;
  const currentMongoId = (currentUser as any)?._id ? String((currentUser as any)._id) : undefined;

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    if (currentUserId) {
      const storedJson = getWebItem(getStorageKey(currentUserId, 'items'));
      const dismissedJson = getWebItem(getStorageKey(currentUserId, 'dismissed'));
      if (storedJson) {
        try {
          const items: NotificationItem[] = JSON.parse(storedJson);
          const dismissed: string[] = dismissedJson ? JSON.parse(dismissedJson) : [];
          const dismissedSet = new Set(dismissed);
          return sortNotifications(
            items
              .filter((i) => {
                const eventKey = getEventKey(i);
                return !dismissedSet.has(i.id) && !dismissedSet.has(eventKey) && !dismissedSet.has(i.title);
              })
              // Strip runtime flag — loaded-from-storage notifications must never trigger the banner
              .map((i) => ({ ...i, _receivedAtRuntime: false }))
          );
        } catch { }
      }
    }
    return [];
  });

  const [isStorageLoaded, setIsStorageLoaded] = useState<boolean>(false);
  const { expoPushToken, schedulePushNotification } = usePushNotifications();

  // Dedicated banner notification state — ONLY set when addNotification creates
  // a genuinely runtime notification. Never set from storage or initial data loading.
  // This is the single source of truth for InAppNotificationBanner.
  const [bannerNotification, setBannerNotification] = useState<NotificationItem | null>(null);
  const clearBannerNotification = useCallback(() => setBannerNotification(null), []);

  const seenKeysRef = useRef<Set<string>>(new Set<string>());
  const dismissedKeysRef = useRef<Set<string>>(new Set<string>());
  const loadedUserRef = useRef<string | undefined>(undefined);

  // Load persisted notifications and dismissed/seen keys for current user
  useEffect(() => {
    if (!currentUserId) {
      setIsStorageLoaded(false);
      return;
    }

    let isMounted = true;

    const loadPersistedData = async () => {
      try {
        const webItems = getWebItem(getStorageKey(currentUserId, 'items'));
        const webDismissed = getWebItem(getStorageKey(currentUserId, 'dismissed'));
        const webSeen = getWebItem(getStorageKey(currentUserId, 'seen'));

        const [storedItemsJson, storedDismissedJson, storedSeenJson] = await Promise.all([
          AsyncStorage.getItem(getStorageKey(currentUserId, 'items')),
          AsyncStorage.getItem(getStorageKey(currentUserId, 'dismissed')),
          AsyncStorage.getItem(getStorageKey(currentUserId, 'seen')),
        ]);

        if (!isMounted) return;

        const dismissedRaw = webDismissed || storedDismissedJson;
        const seenRaw = webSeen || storedSeenJson;
        const itemsRaw = webItems || storedItemsJson;

        const storedDismissed: string[] = dismissedRaw ? JSON.parse(dismissedRaw) : [];
        const storedSeen: string[] = seenRaw ? JSON.parse(seenRaw) : [];
        const storedItems: NotificationItem[] = itemsRaw ? JSON.parse(itemsRaw) : [];

        const dismissedSet = new Set<string>(storedDismissed);
        const seenSet = new Set<string>([...storedSeen, ...storedDismissed]);

        // Index all existing items and their event keys into seenSet so they are NEVER re-added as duplicates
        storedItems.forEach((item) => {
          seenSet.add(item.id);
          const eKey = getEventKey(item);
          seenSet.add(eKey);
          if (item.title) seenSet.add(item.title);
        });

        dismissedKeysRef.current = dismissedSet;
        seenKeysRef.current = seenSet;

        // Filter out any dismissed notifications from the active list
        // Also strip _receivedAtRuntime — loaded-from-storage notifications must never trigger the banner
        const activeItems = storedItems
          .filter((item) => {
            const eKey = getEventKey(item);
            return !dismissedSet.has(item.id) && !dismissedSet.has(eKey) && !dismissedSet.has(item.title);
          })
          .map((item) => ({ ...item, _receivedAtRuntime: false }));

        const sorted = sortNotifications(activeItems);
        setNotifications(sorted);
        setIsStorageLoaded(true);
        loadedUserRef.current = currentUserId;

        // Sync web storage immediately
        setWebItem(getStorageKey(currentUserId, 'items'), JSON.stringify(sorted));
        setWebItem(getStorageKey(currentUserId, 'dismissed'), JSON.stringify(Array.from(dismissedSet)));
        setWebItem(getStorageKey(currentUserId, 'seen'), JSON.stringify(Array.from(seenSet)));
      } catch (err) {
        console.error('[Notifications] Failed to load persisted notification data:', err);
        if (isMounted) {
          setIsStorageLoaded(true);
        }
      }
    };

    loadPersistedData();

    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  // Helper to persist current state (both AsyncStorage & web localStorage)
  const persistNotifications = useCallback((items: NotificationItem[]) => {
    if (!currentUserId) return;
    const json = JSON.stringify(items);
    setWebItem(getStorageKey(currentUserId, 'items'), json);
    AsyncStorage.setItem(getStorageKey(currentUserId, 'items'), json).catch((err) =>
      console.error('[Notifications] Failed to persist notifications:', err)
    );
  }, [currentUserId]);

  const persistDismissedKeys = useCallback(() => {
    if (!currentUserId) return;
    const array = Array.from(dismissedKeysRef.current);
    const json = JSON.stringify(array);
    setWebItem(getStorageKey(currentUserId, 'dismissed'), json);
    AsyncStorage.setItem(getStorageKey(currentUserId, 'dismissed'), json).catch((err) =>
      console.error('[Notifications] Failed to persist dismissed keys:', err)
    );
  }, [currentUserId]);

  const persistSeenKeys = useCallback(() => {
    if (!currentUserId) return;
    const array = Array.from(seenKeysRef.current);
    const json = JSON.stringify(array);
    setWebItem(getStorageKey(currentUserId, 'seen'), json);
    AsyncStorage.setItem(getStorageKey(currentUserId, 'seen'), json).catch((err) =>
      console.error('[Notifications] Failed to persist seen keys:', err)
    );
  }, [currentUserId]);

  // Register push token with backend
  useEffect(() => {
    if (!hasCompletedOnboarding) return;
    if (expoPushToken && expoPushToken.length > 0 && currentUserId) {
      fetch(`${url}/users/push-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, token: expoPushToken }),
      })
        .then(() => console.log('[Notifications] Registered push token with backend'))
        .catch((err) => console.error('[Notifications] Failed to register token:', err));
    }
  }, [expoPushToken, currentUserId, hasCompletedOnboarding]);

  const addNotification = useCallback((input: AddNotificationInput) => {
    if (!currentUserId || !isAuthUser) return;

    const eventKey = getEventKey(input);
    const meta = (input.metadata || {}) as any;
    const isLiveCall =
      meta.type === 'video-call' ||
      meta.type === 'class-video-call' ||
      meta.action === 'join_class' ||
      meta.isClass === true ||
      input.title.toLowerCase().includes('video call') ||
      input.title.toLowerCase().includes('live class') ||
      input.title.toLowerCase().includes('calling') ||
      input.body.toLowerCase().includes('video call') ||
      input.body.toLowerCase().includes('live class') ||
      input.body.toLowerCase().includes('calling');

    // If this specific event has been dismissed by user or already seen, ignore (except live calls)
    if (!isLiveCall) {
      if (dismissedKeysRef.current.has(eventKey)) {
        return;
      }
      if (seenKeysRef.current.has(eventKey)) {
        return;
      }
    } else {
      // Clear past dismissal/seen cache for live call so incoming calls are always delivered
      dismissedKeysRef.current.delete(eventKey);
      seenKeysRef.current.delete(eventKey);
    }

    const isExplicitRuntime = input.skipPopup === false;
    const isStartup = Date.now() - mountTimestampRef.current < 4000;
    const shouldSkip = isLiveCall || isExplicitRuntime ? false : (input.skipPopup === true || isStartup || !isAuthUser);

    const payload: NotificationItem = {
      id: generateNotificationId(),
      title: input.title,
      body: input.body,
      category: input.category,
      metadata: {
        ...input.metadata,
        eventKey,
        skipPopup: shouldSkip,
      },
      read: false,
      createdAt: shouldSkip
        ? new Date(Date.now() - 60 * 1000).toISOString()
        : new Date().toISOString(),
      // Mark as runtime notification only if it's not a startup/skip notification
      // This flag is the single source of truth for InAppNotificationBanner
      _receivedAtRuntime: !shouldSkip,
    };

    if (!isLiveCall) {
      seenKeysRef.current.add(eventKey);
    }
    seenKeysRef.current.add(payload.id);
    persistSeenKeys();

    setNotifications((prev) => {
      // Ensure no duplicate notification exists
      const filtered = prev.filter((item) => {
        if (item.id === payload.id) return false;
        const existingKey = getEventKey(item);
        if (existingKey === eventKey) return false;
        // Ensure at most ONE video call notification item per swap in the list
        if (
          input.metadata?.type === 'video-call' &&
          input.metadata?.swapId &&
          item.metadata?.type === 'video-call' &&
          String(item.metadata?.swapId) === String(input.metadata.swapId)
        ) {
          return false;
        }
        return true;
      });
      const next = sortNotifications([payload, ...filtered]);
      persistNotifications(next);
      return next;
    });

    console.log('[Notifications] Added notification', payload);

    if (!shouldSkip && (bannerReadyRef.current || isExplicitRuntime)) {
      // Push to the dedicated banner queue to display in-app banner immediately
      setBannerNotification(payload);

      schedulePushNotification(input.title, input.body, input.metadata ?? {});

      const isVideoCall = isLiveCall;
      const isLiveClass =
        meta.action === 'join_class' ||
        input.title.toLowerCase().includes('live class');

      if (isVideoCall && meta.swapId) {
        const swapKey = String(meta.swapId);
        // Suppress alert popup if current user is already on the call screen
        if (pathname && (pathname.includes(`/call/${swapKey}`) || pathname.includes(`call/${swapKey}`))) {
          console.log('[Notifications] Suppressed call alert popup because user is already on call screen for swap', swapKey);
          return;
        }

        const lastCallAlertTime = lastCallPopupTimeRef.current.get(swapKey) || 0;
        if (Date.now() - lastCallAlertTime < 1200) {
          console.log('[Notifications] Suppressed rapid duplicate call alert popup for swap', swapKey);
          return;
        }
        lastCallPopupTimeRef.current.set(swapKey, Date.now());

        showAlert(
          input.title,
          input.body,
          [
            { text: 'Decline', style: 'cancel' },
            {
              text: 'Join Call',
              style: 'default',
              onPress: () => {
                router.push(`/call/${meta.swapId}?mode=${meta.mode || 'video'}&isJoining=true` as any);
              },
            },
          ]
        );
      } else if (isLiveClass && meta.classId) {
        showAlert(
          input.title,
          input.body,
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Join Class',
              style: 'default',
              onPress: () => {
                router.push(`/call/${meta.classId}?mode=video` as any);
              },
            },
          ]
        );
      }
    }
  }, [currentUserId, isAuthUser, schedulePushNotification, persistNotifications, persistSeenKeys, showAlert, router]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map((notification) => {
        if (notification.id !== id) {
          return notification;
        }
        return { ...notification, read: true };
      });
      persistNotifications(next);
      return next;
    });
  }, [persistNotifications]);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((notification) => ({ ...notification, read: true }));
      persistNotifications(next);
      return next;
    });
  }, [persistNotifications]);

  const removeNotification = useCallback((id: string) => {
    dismissedKeysRef.current.add(id);

    setNotifications((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        const eKey = getEventKey(target);
        dismissedKeysRef.current.add(eKey);
        if (target.title) dismissedKeysRef.current.add(target.title);
      }
      persistDismissedKeys();

      const next = prev.filter((notification) => notification.id !== id);
      persistNotifications(next);
      return next;
    });
  }, [persistDismissedKeys, persistNotifications]);

  const clearAll = useCallback(() => {
    setNotifications((prev) => {
      prev.forEach((item) => {
        dismissedKeysRef.current.add(item.id);
        const eKey = getEventKey(item);
        dismissedKeysRef.current.add(eKey);
        if (item.title) dismissedKeysRef.current.add(item.title);
        seenKeysRef.current.add(item.id);
        seenKeysRef.current.add(eKey);
        if (item.title) seenKeysRef.current.add(item.title);
      });
      persistDismissedKeys();
      persistSeenKeys();
      persistNotifications([]);
      return [];
    });
  }, [persistDismissedKeys, persistSeenKeys, persistNotifications]);

  const isInitialSwapsLoadRef = useRef<boolean>(true);
  const isInitialRemindersLoadRef = useRef<boolean>(true);
  const isInitialChatLoadRef = useRef<boolean>(true);
  const isInitialReviewsLoadRef = useRef<boolean>(true);
  const swapSeenStateRef = useRef<Map<string, string>>(new Map());

  // Banner readiness gate: only allow setBannerNotification after ALL initial
  // data processing effects have completed their first pass. This prevents the
  // banner from showing for any notification generated during the initial
  // backend data load, no matter how long the API takes.
  const bannerReadyRef = useRef<boolean>(false);

  const checkAndSetBannerReady = useCallback(() => {
    if (
      !isInitialSwapsLoadRef.current &&
      !isInitialRemindersLoadRef.current &&
      !isInitialChatLoadRef.current &&
      !isInitialReviewsLoadRef.current
    ) {
      bannerReadyRef.current = true;
    }
  }, []);

  // Handle Swaps Status Changes
  useEffect(() => {
    if (!isAuthUser || !hasCompletedOnboarding || !isStorageLoaded || !currentUserId) return;

    const isFirstRun = isInitialSwapsLoadRef.current;

    swaps.forEach((swap) => {
      if (String(swap.requesterId) !== currentUserId && String(swap.recipientId) !== currentUserId) {
        return;
      }
      const counterpartId = String(swap.requesterId) === currentUserId ? swap.recipientId : swap.requesterId;
      const eventKey = `swap:${swap.id}:${swap.status}`;
      const previousStatus = swapSeenStateRef.current.get(swap.id);

      // On initial app load/startup, index all existing historical swaps as seen so they never alert
      if (isFirstRun) {
        seenKeysRef.current.add(eventKey);
        swapSeenStateRef.current.set(swap.id, swap.status);
        return;
      }

      if (previousStatus === swap.status || dismissedKeysRef.current.has(eventKey) || seenKeysRef.current.has(eventKey)) {
        return;
      }
      swapSeenStateRef.current.set(swap.id, swap.status);

      if (String(swap.recipientId) === currentUserId && swap.status === 'pending') {
        const counterpart = allUsers.find((user) => String(user.id) === String(counterpartId));
        addNotification({
          category: 'swap',
          title: 'New exchange request',
          body: `${counterpart?.username ? `@${counterpart.username}` : (counterpart?.name ?? 'A community member')} sent you a new skill exchange request. Review their proposal now.`,
          metadata: {
            swapId: swap.id,
          },
          skipPopup: false,
          eventKey,
        });
        return;
      }

      if (String(swap.requesterId) === currentUserId && swap.status === 'negotiating') {
        const counterpart = allUsers.find((user) => String(user.id) === String(counterpartId));
        addNotification({
          category: 'swap',
          title: 'Counter proposal received',
          body: `${counterpart?.username ? `@${counterpart.username}` : (counterpart?.name ?? 'Your partner')} shared new time options for your exchange.`,
          metadata: {
            swapId: swap.id,
          },
          skipPopup: false,
          eventKey,
        });
        return;
      }

      if (swap.status === 'scheduled' && swap.acceptedTimeId) {
        const counterpart = allUsers.find((user) => String(user.id) === String(counterpartId));
        addNotification({
          category: 'swap',
          title: 'Exchange confirmed',
          body: `Your session with ${counterpart?.username ? `@${counterpart.username}` : (counterpart?.name ?? 'your partner')} is confirmed. Add it to your calendar and get ready!`,
          metadata: {
            swapId: swap.id,
          },
          skipPopup: false,
          eventKey,
        });
        return;
      }

      if (swap.status === 'completed') {
        const counterpart = allUsers.find((user) => String(user.id) === String(counterpartId));
        addNotification({
          category: 'swap',
          title: 'Exchange completed',
          body: `Nice work! Your exchange with ${counterpart?.username ? `@${counterpart.username}` : (counterpart?.name ?? 'your partner')} is done. Leave a review to help the community.`,
          metadata: {
            swapId: swap.id,
          },
          skipPopup: false,
          eventKey,
        });
      }
    });

    if (isFirstRun && swaps.length > 0) {
      isInitialSwapsLoadRef.current = false;
      checkAndSetBannerReady();
      persistSeenKeys();
    }
  }, [addNotification, allUsers, currentUserId, isAuthUser, swaps, hasCompletedOnboarding, isStorageLoaded, persistSeenKeys]);

  // Handle Swap Reminders
  useEffect(() => {
    if (!isAuthUser || !hasCompletedOnboarding || !isStorageLoaded || !currentUserId) return;

    const isFirstRun = isInitialRemindersLoadRef.current;

    const createReminderNotifications = () => {
      const now = Date.now();
      scheduledSwaps.forEach((swap) => {
        if (String(swap.requesterId) !== currentUserId && String(swap.recipientId) !== currentUserId) {
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
        const counterpartId = String(swap.requesterId) === currentUserId ? swap.recipientId : swap.requesterId;
        const counterpart = allUsers.find((user) => String(user.id) === String(counterpartId));

        REMINDER_THRESHOLDS_HOURS.forEach((threshold) => {
          if (diffHours <= threshold && diffHours >= 0) {
            const eventKey = `reminder:${swap.id}:${threshold}`;

            // On first run/startup, index existing reminders as seen so they don't alert
            if (isFirstRun) {
              seenKeysRef.current.add(eventKey);
              return;
            }

            if (dismissedKeysRef.current.has(eventKey) || seenKeysRef.current.has(eventKey)) {
              return;
            }
            const humanReadable = threshold >= 1 ? `${threshold} hour${threshold === 1 ? '' : 's'}` : 'soon';
            addNotification({
              category: 'reminder',
              title: 'Upcoming exchange reminder',
              body: `Your exchange with ${counterpart?.username ? `@${counterpart.username}` : (counterpart?.name ?? 'your partner')} starts in ${humanReadable}. Pull up your prep notes!`,
              metadata: {
                swapId: swap.id,
                startsAt: acceptedSlot.startISO,
              },
              skipPopup: true,
              eventKey,
            });
          }
        });
      });

      if (isFirstRun && scheduledSwaps.length > 0) {
        isInitialRemindersLoadRef.current = false;
        checkAndSetBannerReady();
        persistSeenKeys();
      }
    };

    createReminderNotifications();
  }, [addNotification, allUsers, currentUserId, isAuthUser, scheduledSwaps, hasCompletedOnboarding, isStorageLoaded, persistSeenKeys]);

  // Monitor incoming chat messages and alert the user
  useEffect(() => {
    if (!isAuthUser || !hasCompletedOnboarding || !isStorageLoaded || !currentUserId || swaps.length === 0) {
      return;
    }

    const isFirstRun = isInitialChatLoadRef.current;

    swaps.forEach((swap) => {
      if (String(swap.requesterId) !== currentUserId && String(swap.recipientId) !== currentUserId) {
        return;
      }
      const counterpartId = String(swap.requesterId) === currentUserId ? swap.recipientId : swap.requesterId;
      const counterpart = allUsers.find((user) => String(user.id) === String(counterpartId));
      const senderName = counterpart?.username ? `@${counterpart.username}` : (counterpart?.name ?? 'Your partner');

      if (Array.isArray(swap.negotiationNotes)) {
        swap.negotiationNotes.forEach((msg) => {
          const msgId = String(msg.id || (msg as any)._id || '');
          if (!msgId) return;

          const eventKey = `msg:${msgId}`;
          if (dismissedKeysRef.current.has(eventKey) || seenKeysRef.current.has(eventKey)) {
            return;
          }

          seenKeysRef.current.add(eventKey);

          // On initial app load/startup, index all existing historical messages as seen so they never alert
          if (isFirstRun) {
            return;
          }

          const isVideoCallAlert = typeof msg.body === 'string' && msg.body.includes("started the video call");
          if (
            String(msg.authorId) !== currentUserId &&
            !msg.isSystem &&
            !isVideoCallAlert
          ) {
            addNotification({
              category: 'swap',
              title: `New message from ${senderName}`,
              body: msg.body,
              metadata: {
                swapId: swap.id,
              },
              skipPopup: false,
              eventKey,
            });
          }
        });
      }
    });

    if (isFirstRun && swaps.length > 0) {
      isInitialChatLoadRef.current = false;
      checkAndSetBannerReady();
      persistSeenKeys();
    }
  }, [swaps, currentUserId, isAuthUser, allUsers, addNotification, hasCompletedOnboarding, isStorageLoaded, persistSeenKeys]);

  // Monitor incoming reviews and alert the user
  useEffect(() => {
    if (!isAuthUser || !hasCompletedOnboarding || !isStorageLoaded || !currentUserId || currentUserId === '1') {
      return;
    }

    const checkNewReviews = async () => {
      try {
        const response = await fetch(`${url}/reviews?revieweeId=${currentUserId}`);
        if (!response.ok) return;
        const data = await response.json();

        if (data && Array.isArray(data.reviews)) {
          const isFirstRun = isInitialReviewsLoadRef.current;

          data.reviews.forEach((rev: any) => {
            const revId = rev.id || rev._id || '';
            if (!revId) return;

            const eventKey = `review:${revId}`;
            if (dismissedKeysRef.current.has(eventKey) || seenKeysRef.current.has(eventKey)) {
              return;
            }

            if (isFirstRun) {
              seenKeysRef.current.add(eventKey);
              return;
            }

            if (rev.reviewer?.id && String(rev.reviewer.id) !== currentUserId) {
              addNotification({
                category: 'system',
                title: 'New review received',
                body: `${rev.reviewer?.name || 'A user'} gave you a ${rev.rating}-star review: "${rev.comment || ''}"`,
                metadata: {
                  rating: rev.rating,
                },
                skipPopup: false,
                eventKey,
              });
            } else {
              seenKeysRef.current.add(eventKey);
            }
          });

          if (isFirstRun) {
            isInitialReviewsLoadRef.current = false;
            checkAndSetBannerReady();
            persistSeenKeys();
          }
        }
      } catch (err) {
        console.error('[Notifications] Failed to check reviews:', err);
      }
    };

    checkNewReviews();

    if (socket) {
      const handleNewReview = () => {
        console.log('[Socket.IO] review_created received, checking reviews');
        checkNewReviews();
      };
      socket.on('review_created', handleNewReview);
      return () => {
        socket.off('review_created', handleNewReview);
      };
    }
  }, [currentUserId, isAuthUser, addNotification, hasCompletedOnboarding, isStorageLoaded, socket, persistSeenKeys]);

  // Real-time socket notification for class enrollment alerts to class teacher
  useEffect(() => {
    if (!isAuthUser || !hasCompletedOnboarding || !isStorageLoaded || !currentUserId || !socket) return;

    const handleClassUpdated = (data: { classId: string; action: string; studentId: string; teacherId?: string; classTitle?: string }) => {
      if (data && data.action === 'enrolled') {
        const isTeacher = String(data.teacherId) === currentUserId || (currentMongoId && String(data.teacherId) === currentMongoId);
        const isSelf = String(data.studentId) === currentUserId || (currentMongoId && String(data.studentId) === currentMongoId);

        if (isTeacher && !isSelf) {
          const eventKey = `class-enroll:${data.classId}:${data.studentId}:${Date.now()}`;
          if (dismissedKeysRef.current.has(eventKey) || seenKeysRef.current.has(eventKey)) {
            return;
          }

          const studentUser = allUsers.find((u) => String(u.id) === String(data.studentId));
          const studentName = studentUser?.username ? `@${studentUser.username}` : (studentUser?.name || 'A student');
          const titleName = data.classTitle || 'your class';
          addNotification({
            category: 'class',
            title: 'New Student Enrolled! 🎓',
            body: `${studentName} enrolled in your class "${titleName}"`,
            skipPopup: false,
            eventKey,
          });
        }
      }
    };

    socket.on('class_updated', handleClassUpdated);
    return () => {
      socket.off('class_updated', handleClassUpdated);
    };
  }, [hasCompletedOnboarding, isAuthUser, currentUserId, currentMongoId, socket, allUsers, addNotification, isStorageLoaded]);

  // Real-time socket notification for when teacher starts a live class
  useEffect(() => {
    if (!isAuthUser || !hasCompletedOnboarding || !isStorageLoaded || !currentUserId || !socket) return;

    const handleClassStarted = (data: {
      classId: string;
      classTitle: string;
      teacherName: string;
      teacherId: string;
      enrolledStudentIds?: string[];
    }) => {
      if (data && data.classId) {
        const teacherIdStr = String(data.teacherId);
        const isTeacher = teacherIdStr === currentUserId || (currentMongoId && teacherIdStr === currentMongoId);
        if (isTeacher) return;

        const isEnrolled = data.enrolledStudentIds && Array.isArray(data.enrolledStudentIds)
          ? data.enrolledStudentIds.some((id) => {
              const idStr = String(id);
              return idStr === currentUserId || (currentMongoId && idStr === currentMongoId);
            })
          : true;

        if (isEnrolled) {
          const eventKey = `class-started:${data.classId}:${Date.now()}`;
          const teacher = data.teacherName || 'Teacher';
          const title = data.classTitle || 'Group Class';

          addNotification({
            category: 'class',
            title: '🔴 Live Class Started!',
            body: `${teacher} has started "${title}". Tap to join the live video session now!`,
            metadata: {
              swapId: data.classId,
              classId: data.classId,
              type: 'class-video-call',
              mode: 'video',
              action: 'join_class',
              callerName: teacher,
              isClass: true,
            },
            skipPopup: false,
            eventKey,
          });
        }
      }
    };

    socket.on('class_started', handleClassStarted);
    return () => {
      socket.off('class_started', handleClassStarted);
    };
  }, [hasCompletedOnboarding, isAuthUser, currentUserId, currentMongoId, socket, addNotification, router, isStorageLoaded]);

  // Real-time socket listener for incoming video / voice calls
  useEffect(() => {
    if (!isAuthUser || !hasCompletedOnboarding || !isStorageLoaded || !currentUserId || !socket) return;

    const handleIncomingCall = (data: {
      swapId?: string;
      classId?: string;
      callerId?: string;
      callerName?: string;
      callerAvatar?: string;
      title?: string;
      body?: string;
      mode?: string;
      metadata?: any;
    }) => {
      console.log('[Socket.IO] Received incoming call event:', data);
      const targetCallId = data.swapId || data.classId || data.metadata?.swapId || data.metadata?.classId;
      const callerIdStr = String(data.callerId || '');
      const isCaller = callerIdStr === currentUserId || (currentMongoId && callerIdStr === currentMongoId);
      if (data && targetCallId && !isCaller) {
        const callKey = String(targetCallId);
        // If current user is already on the call screen for this call, skip popup alert
        if (pathname && (pathname.includes(`/call/${callKey}`) || pathname.includes(`call/${callKey}`))) {
          console.log('[Notifications] Suppressed incoming call popup because user is already on call screen for', callKey);
          return;
        }

        const caller = data.callerName || 'Teacher';
        const mode = data.mode || 'video';
        const isClass = Boolean(data.metadata?.isClass || data.classId || data.metadata?.classId || data.title?.toLowerCase().includes('class'));
        const eventKey = `call:${targetCallId}:${Date.now()}`;

        addNotification({
          category: isClass ? 'class' : 'swap',
          title: data.title || (isClass ? `🔴 Live Class: ${data.callerName || 'Teacher'}` : `Incoming ${mode === 'voice' ? 'Voice' : 'Video'} Call`),
          body: data.body || `${caller} started the video session. Tap to join!`,
          metadata: {
            swapId: targetCallId,
            classId: isClass ? targetCallId : data.metadata?.classId,
            type: isClass ? 'class-video-call' : 'video-call',
            callerId: data.callerId,
            callerName: caller,
            mode,
            isClass,
          },
          eventKey,
          skipPopup: false,
        });
      }
    };

    const handleNewNotification = (data: {
      category?: string;
      title: string;
      body: string;
      metadata?: any;
    }) => {
      console.log('[Socket.IO] Received new_notification event:', data);
      if (data && data.title) {
        const uniqueKey = `socket:${data.category || 'swap'}:${data.metadata?.swapId || ''}:${Date.now()}`;
        addNotification({
          category: (data.category as any) || 'swap',
          title: data.title,
          body: data.body,
          metadata: data.metadata,
          eventKey: uniqueKey,
          skipPopup: false,
        });
      }
    };

    const handleSubscriptionDebitFailed = (data: {
      studentId: string;
      teacherId: string;
      amount: number;
      title: string;
      studentName?: string;
      studentUsername?: string;
      isClass?: boolean;
    }) => {
      console.log('[Socket.IO] Received subscription_debit_failed:', data);
      if (!data) return;
      const teacherIdStr = String(data.teacherId);
      const studentIdStr = String(data.studentId);
      const isTeacher = teacherIdStr === currentUserId || (currentMongoId && teacherIdStr === currentMongoId);
      const isStudent = studentIdStr === currentUserId || (currentMongoId && studentIdStr === currentMongoId);

      const typeLabel = data.isClass ? 'class' : 'subscription';
      const eventKey = `sub-fail:${data.title}:${Date.now()}`;

      if (isStudent) {
        showAlert(
          '⚠️ Monthly Subscription Failed',
          `You do not have enough credits for your monthly ${typeLabel} "${data.title}" (${data.amount} credits required). Please top up in the Store to continue without interruption.`,
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Top Up Store',
              onPress: () => {
                router.push('/store' as any);
              },
            },
          ]
        );

        addNotification({
          category: 'system',
          title: '⚠️ Monthly Subscription Failed',
          body: `Insufficient credits for your monthly ${typeLabel} "${data.title}" (${data.amount} credits required). Please top up in Store.`,
          metadata: {
            action: 'store_topup',
            link: '/store',
          },
          eventKey,
          skipPopup: false,
        });
      } else if (isTeacher) {
        const studentLabel = data.studentUsername ? `@${data.studentUsername}` : (data.studentName || 'A student');
        showAlert(
          '⚠️ Student Payment Failed',
          `${studentLabel} was unable to pay the monthly ${typeLabel} fee for "${data.title}" due to insufficient credits.`,
          [{ text: 'OK' }]
        );

        addNotification({
          category: 'system',
          title: '⚠️ Student Payment Failed',
          body: `${studentLabel} has insufficient credits for their monthly ${typeLabel} "${data.title}".`,
          eventKey,
          skipPopup: false,
        });
      }
    };

    const handleSubscriptionDebitSuccess = (data: {
      studentId: string;
      teacherId: string;
      amount: number;
      title: string;
      studentName?: string;
      studentUsername?: string;
      isClass?: boolean;
    }) => {
      console.log('[Socket.IO] Received subscription_debit_success:', data);
      if (!data) return;
      const teacherIdStr = String(data.teacherId);
      const studentIdStr = String(data.studentId);
      const isTeacher = teacherIdStr === currentUserId || (currentMongoId && teacherIdStr === currentMongoId);
      const isStudent = studentIdStr === currentUserId || (currentMongoId && studentIdStr === currentMongoId);

      const typeLabel = data.isClass ? 'class' : 'subscription';
      const eventKey = `sub-success:${data.title}:${Date.now()}`;

      if (isStudent) {
        addNotification({
          category: 'system',
          title: '💳 Monthly Subscription Renewed',
          body: `${data.amount} credits were debited for your monthly ${typeLabel} "${data.title}".`,
          eventKey,
          skipPopup: false,
        });
      } else if (isTeacher) {
        const earned = Math.floor(data.amount * 0.8);
        const studentLabel = data.studentUsername ? `@${data.studentUsername}` : (data.studentName || 'A student');
        addNotification({
          category: 'system',
          title: '💰 Monthly Subscription Received',
          body: `Received ${earned} credits from ${studentLabel} for monthly ${typeLabel} "${data.title}".`,
          eventKey,
          skipPopup: false,
        });
      }
    };

    socket.on('incoming_call', handleIncomingCall);
    socket.on('new_notification', handleNewNotification);
    socket.on('subscription_debit_failed', handleSubscriptionDebitFailed);
    socket.on('subscription_debit_success', handleSubscriptionDebitSuccess);

    return () => {
      socket.off('incoming_call', handleIncomingCall);
      socket.off('new_notification', handleNewNotification);
      socket.off('subscription_debit_failed', handleSubscriptionDebitFailed);
      socket.off('subscription_debit_success', handleSubscriptionDebitSuccess);
    };
  }, [hasCompletedOnboarding, isAuthUser, currentUserId, currentMongoId, socket, addNotification, isStorageLoaded, showAlert, router]);

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
      bannerNotification,
      clearBannerNotification,
    };
  }, [notifications, unreadCount, addNotification, markAsRead, markAllAsRead, removeNotification, clearAll, bannerNotification, clearBannerNotification]);

  return value;
});

