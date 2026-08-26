import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform, ActivityIndicator, Alert, Modal } from 'react-native';
import { useAlert } from '@/providers/alert';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MapPin, Clock, Check, X, Send, Sparkles, CalendarClock, PlusCircle, ArrowLeft, ShieldCheck, Video, Phone, CalendarPlus, Download, GraduationCap, BookOpen, ArrowLeftRight, Coins, Zap, AlertTriangle, AlertCircle } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { useSkillSwaps } from '../../providers/skill-swaps';
import { useCurrentUser } from '../../providers/current-user';
import { useSocket } from '../../providers/socket';
import { getSkillsWithUsers } from '../../mocks/data';
import type { SkillWithUser, SkillSwapStatus, SwapTimeProposal } from '../../types';
import { addSwapToCalendar, exportSwapToICalendar } from '../../lib/calendar';

type TimeSuggestion = {
  id: string;
  label: string;
  startISO: string;
  endISO: string;
};

const statusCopy: Record<SkillSwapStatus, { title: string; accent: string; description: string }> = {
  pending: { title: 'Waiting for confirmation', accent: '#F97316', description: 'Your invite is in their inbox. Add a nudge if needed.' },
  negotiating: { title: 'Crafting the exchange', accent: '#60A5FA', description: 'Both sides are fine-tuning the schedule and venue.' },
  scheduled: { title: 'Session confirmed', accent: '#34D399', description: 'Everything is locked. Get ready to exchange skills.' },
  declined: { title: 'Exchange declined', accent: '#F87171', description: 'This exchange was declined. You can explore other partners.' },
  completed: { title: 'Exchange completed', accent: '#A855F7', description: 'Mark reflections and share a review with your partner.' },
};

const buildTimeSuggestions = (): TimeSuggestion[] => {
  const now = Date.now();
  const configs = [
    { offsetHours: 6, durationMinutes: 60 },
    { offsetHours: 20, durationMinutes: 75 },
    { offsetHours: 32, durationMinutes: 90 },
    { offsetHours: 54, durationMinutes: 60 },
    { offsetHours: 80, durationMinutes: 120 },
  ];
  return configs.map((config) => {
    const start = new Date(now + config.offsetHours * 60 * 60 * 1000);
    const end = new Date(start.getTime() + config.durationMinutes * 60 * 1000);
    return {
      id: `sug-${config.offsetHours}`,
      label: formatTimestamp(start.toISOString()),
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    };
  });
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getTimeRemainingText = (targetDate: Date | string): string => {
  const diffMs = new Date(targetDate).getTime() - Date.now();
  if (diffMs <= 0) return 'Session time reached • Ready to start';

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    const remHours = diffHours % 24;
    return `Starts in ${diffDays} day${diffDays > 1 ? 's' : ''}${remHours > 0 ? ` ${remHours} hr${remHours > 1 ? 's' : ''}` : ''}`;
  }
  if (diffHours > 0) {
    const remMins = diffMinutes % 60;
    return `Starts in ${diffHours} hr${diffHours > 1 ? 's' : ''}${remMins > 0 ? ` ${remMins} min${remMins > 1 ? 's' : ''}` : ''}`;
  }
  return `Starts in ${Math.max(1, diffMinutes)} minute${diffMinutes > 1 ? 's' : ''}`;
};

const classifySlotStatus = (slot: SwapTimeProposal) => {
  if (slot.status === 'accepted') {
    return { label: 'Locked in', color: '#34D399' };
  }
  if (slot.status === 'declined') {
    return { label: 'Declined', color: '#F87171' };
  }
  return { label: 'Awaiting reply', color: '#60A5FA' };
};

export default function SwapDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getSwapById, addMessage, addCounterProposal, acceptProposal, declineSlot, declineSwap, updateLocation, completeSwap, setCalendarEventId, loading } = useSkillSwaps();
  const { currentUser, allUsers, loadUser } = useCurrentUser();
  const { socket } = useSocket();
  const { showAlert } = useAlert();
  const [messageDraft, setMessageDraft] = useState<string>('');
  const [counterNotes, setCounterNotes] = useState<string>('');
  const [locationDraft, setLocationDraft] = useState<string>('');
  const [selectedSuggestions, setSelectedSuggestions] = useState<TimeSuggestion[]>([]);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState<boolean>(false);
  const [creditConfirmModalVisible, setCreditConfirmModalVisible] = useState<boolean>(false);
  const [pendingSlotToAccept, setPendingSlotToAccept] = useState<string | null>(null);
  const [isAcceptingWithCredit, setIsAcceptingWithCredit] = useState<boolean>(false);
  const [callTimeModalVisible, setCallTimeModalVisible] = useState<boolean>(false);
  const [callModeToStart, setCallModeToStart] = useState<'video' | 'voice'>('video');

  const [calendarModalVisible, setCalendarModalVisible] = useState<boolean>(false);
  const [customDateTimeStr, setCustomDateTimeStr] = useState<string>(() => {
    const tom = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tom.setHours(14, 0, 0, 0);
    return tom.toISOString().slice(0, 16);
  });
  const [pickerSelectedDate, setPickerSelectedDate] = useState<string>(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [pickerSelectedTime, setPickerSelectedTime] = useState<string>('14:00');

  const next14Days = useMemo(() => {
    const days: { dateStr: string; label: string; sublabel: string }[] = [];
    const now = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString(undefined, { weekday: 'short' });
      const sublabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      days.push({ dateStr, label, sublabel });
    }
    return days;
  }, []);

  const timeSlotOptions = ['09:00', '10:30', '12:00', '14:00', '16:00', '18:00', '19:30', '21:00'];

  const swap = getSwapById(id);

  const allSkills = useMemo(() => {
    const map = new Map<string, SkillWithUser>();
    allUsers.forEach((u) => {
      u.skillsOffered?.forEach((s: any) => {
        const item = { ...s, user: u };
        if (s.id) map.set(String(s.id), item);
        if (s._id) map.set(String(s._id), item);
      });
    });
    return map;
  }, [allUsers]);

  const skillsMap = allSkills;

  const timeSuggestions = useMemo(() => buildTimeSuggestions(), []);

  const partner = useMemo(() => {
    if (!swap) {
      return undefined;
    }
    const partnerId = swap.requesterId === currentUser?.id ? swap.recipientId : swap.requesterId;
    return allUsers.find((user) => user.id === partnerId);
  }, [allUsers, currentUser?.id, swap]);

  const counterpartSkill = useMemo(() => {
    if (!swap) {
      return undefined;
    }
    const targetSkillId = swap.requesterId === currentUser?.id ? swap.recipientSkillId : swap.requesterSkillId;
    return skillsMap.get(targetSkillId);
  }, [currentUser?.id, skillsMap, swap]);

  const yourSkill = useMemo(() => {
    if (!swap) {
      return undefined;
    }
    const offeredId = swap.requesterId === currentUser?.id ? swap.requesterSkillId : swap.recipientSkillId;
    return skillsMap.get(offeredId);
  }, [currentUser?.id, skillsMap, swap]);

  const headerCopy = useMemo(() => {
    if (!swap) {
      return undefined;
    }
    const copy = statusCopy[swap.status];
    return copy;
  }, [swap]);

  // Role information based on swapType
  const roleInfo = useMemo(() => {
    if (!swap || !currentUser) return null;
    const isRequester = swap.requesterId === currentUser.id;
    const swapType = swap.swapType || 'swap';
    const partnerLabel = partner?.username ? (partner.username.startsWith('@') ? partner.username : `@${partner.username}`) : (partner?.name ? `@${partner.name.toLowerCase().replace(/\s+/g, '')}` : 'Partner');
    if (swapType === 'learn') {
      if (isRequester) {
        return { myRole: 'Learner', partnerRole: 'Teacher', color: '#6366F1', bg: '#EEF2FF', Icon: BookOpen, myLabel: 'You learn', partnerLabel: `${partnerLabel} teaches` };
      }
      return { myRole: 'Teacher', partnerRole: 'Learner', color: '#10B981', bg: '#ECFDF5', Icon: GraduationCap, myLabel: 'You teach', partnerLabel: `${partnerLabel} learns` };
    }
    if (swapType === 'teach') {
      if (isRequester) {
        return { myRole: 'Teacher', partnerRole: 'Learner', color: '#10B981', bg: '#ECFDF5', Icon: GraduationCap, myLabel: 'You teach', partnerLabel: `${partnerLabel} learns` };
      }
      return { myRole: 'Learner', partnerRole: 'Teacher', color: '#6366F1', bg: '#EEF2FF', Icon: BookOpen, myLabel: 'You learn', partnerLabel: `${partnerLabel} teaches` };
    }
    return { myRole: 'Exchanger', partnerRole: 'Exchanger', color: '#F59E0B', bg: '#FFFBEB', Icon: ArrowLeftRight, myLabel: 'You offer', partnerLabel: `${partnerLabel} offers` };
  }, [swap, currentUser, partner]);

  // Computed exchange details: clearly separated Teaching & Learning skills
  const exchangeSkills = useMemo(() => {
    if (!swap || !currentUser) {
      return {
        teachingSkillTitle: 'Skill TBD',
        teachingCategory: '',
        learningSkillTitle: 'Skill TBD',
        learningCategory: '',
        teacherName: 'Teacher',
        learnerName: 'Learner',
        teacherIsYou: false,
        learnerIsYou: false,
        swapType: 'swap' as const,
      };
    }
    const isRequester = swap.requesterId === currentUser.id;
    const swapType = swap.swapType || 'swap';
    const partnerName = partner?.name || partner?.username || 'Partner';
    const currentUserName = currentUser?.name || currentUser?.username || 'You';

    const reqSkill = skillsMap.get(String(swap.requesterSkillId)) || (currentUser?.skillsOffered?.find((s: any) => String(s.id) === String(swap.requesterSkillId) || String(s._id) === String(swap.requesterSkillId))) || null;
    const recSkill = skillsMap.get(String(swap.recipientSkillId)) || (partner?.skillsOffered?.find((s: any) => String(s.id) === String(swap.recipientSkillId) || String(s._id) === String(swap.recipientSkillId))) || null;

    if (swapType === 'learn') {
      // Requester is learning, recipient is teaching
      const skillTaught = recSkill || skillsMap.get(String(swap.recipientSkillId));
      return {
        teachingSkillTitle: skillTaught?.title || 'Skill TBD',
        teachingCategory: skillTaught?.category || '',
        learningSkillTitle: isRequester ? 'N/A (Learner)' : 'Direct Session',
        learningCategory: '',
        teacherName: isRequester ? partnerName : 'You',
        learnerName: isRequester ? 'You' : partnerName,
        teacherIsYou: !isRequester,
        learnerIsYou: isRequester,
        swapType,
      };
    }

    if (swapType === 'teach') {
      // Requester is teaching, recipient is learning
      const skillTaught = reqSkill || skillsMap.get(String(swap.requesterSkillId));
      return {
        teachingSkillTitle: skillTaught?.title || 'Skill TBD',
        teachingCategory: skillTaught?.category || '',
        learningSkillTitle: isRequester ? 'Direct Session' : 'N/A (Learner)',
        learningCategory: '',
        teacherName: isRequester ? 'You' : partnerName,
        learnerName: isRequester ? partnerName : 'You',
        teacherIsYou: isRequester,
        learnerIsYou: !isRequester,
        swapType,
      };
    }

    // Mutual Swap:
    // Requester offers requesterSkillId to recipient, recipient offers recipientSkillId to requester
    const requesterOfferedSkill = reqSkill || skillsMap.get(String(swap.requesterSkillId));
    const recipientOfferedSkill = recSkill || skillsMap.get(String(swap.recipientSkillId));

    if (isRequester) {
      return {
        teachingSkillTitle: requesterOfferedSkill?.title || 'Skill TBD',
        teachingCategory: requesterOfferedSkill?.category || '',
        learningSkillTitle: recipientOfferedSkill?.title || 'Skill TBD',
        learningCategory: recipientOfferedSkill?.category || '',
        teacherName: 'You',
        learnerName: partnerName,
        teacherIsYou: true,
        learnerIsYou: false,
        swapType,
      };
    } else {
      return {
        teachingSkillTitle: recipientOfferedSkill?.title || 'Skill TBD',
        teachingCategory: recipientOfferedSkill?.category || '',
        learningSkillTitle: requesterOfferedSkill?.title || 'Skill TBD',
        learningCategory: requesterOfferedSkill?.category || '',
        teacherName: 'You',
        learnerName: partnerName,
        teacherIsYou: true,
        learnerIsYou: false,
        swapType,
      };
    }
  }, [swap, currentUser, partner, skillsMap]);

  const sortedNotes = useMemo(() => {
    if (!swap) {
      return [];
    }
    return [...swap.negotiationNotes].sort((a, b) => (
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ));
  }, [swap]);

  useEffect(() => {
    if (swap?.locationPreference && locationDraft.length === 0) {
      setLocationDraft(swap.locationPreference);
    }
  }, [locationDraft.length, swap?.locationPreference]);

  const handleToggleSuggestion = useCallback((suggestion: TimeSuggestion) => {
    setSelectedSuggestions((previous) => {
      const exists = previous.some((item) => item.id === suggestion.id);
      if (exists) {
        return previous.filter((item) => item.id !== suggestion.id);
      }
      if (previous.length >= 3) {
        return [...previous.slice(1), suggestion];
      }
      return [...previous, suggestion];
    });
  }, []);

  const handleSendMessage = useCallback(() => {
    if (!swap || messageDraft.trim().length === 0) {
      setErrorBanner('Add a message before sending.');
      return;
    }
    setErrorBanner(null);
    console.log('[SwapDetail] Sending message', { swapId: swap.id });
    addMessage({ requestId: swap.id, authorId: currentUser?.id || "", body: messageDraft.trim() });
    setMessageDraft('');
  }, [addMessage, currentUser?.id, messageDraft, swap]);

  const parseDateTimeString = (str: string): Date | null => {
    if (!str) return null;
    const direct = new Date(str);
    if (!isNaN(direct.getTime())) return direct;
    const parts = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{1,2})/);
    if (parts) {
      const [, y, m, day, h, min] = parts.map(Number);
      return new Date(y, m - 1, day, h, min);
    }
    return null;
  };

  const handleConfirmCalendarSlot = useCallback(() => {
    setErrorBanner(null);
    let start: Date | null = null;
    if (customDateTimeStr) {
      start = parseDateTimeString(customDateTimeStr);
    }
    if (!start || isNaN(start.getTime())) {
      if (pickerSelectedDate && pickerSelectedTime) {
        const [year, month, day] = pickerSelectedDate.split('-').map(Number);
        const [hours, minutes] = pickerSelectedTime.split(':').map(Number);
        start = new Date(year, month - 1, day, hours, minutes, 0, 0);
      }
    }

    if (!start || isNaN(start.getTime())) {
      setErrorBanner('Please select a valid date and time from the calendar.');
      return;
    }

    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const label = formatTimestamp(start.toISOString());
    const newSlot: TimeSuggestion = {
      id: `custom-${start.getTime()}`,
      label: `📅 ${label}`,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    };

    setSelectedSuggestions((prev) => {
      const exists = prev.some((item) => item.startISO === newSlot.startISO);
      if (exists) return prev;
      return [...prev, newSlot];
    });

    setCalendarModalVisible(false);
  }, [customDateTimeStr, pickerSelectedDate, pickerSelectedTime]);

  const handleSendCounterProposal = useCallback(() => {
    if (!swap) {
      return;
    }
    if (selectedSuggestions.length === 0) {
      setErrorBanner('Select at least one time to propose.');
      return;
    }
    setErrorBanner(null);
    console.log('[SwapDetail] Counter proposal', { swapId: swap.id, slots: selectedSuggestions.length });
    addCounterProposal({
      requestId: swap.id,
      proposerId: currentUser?.id || "",
      slots: selectedSuggestions.map((slot) => ({ startISO: slot.startISO, endISO: slot.endISO })),
      message: counterNotes.trim().length > 0 ? counterNotes.trim() : undefined,
    });
    setSelectedSuggestions([]);
    setCounterNotes('');
  }, [addCounterProposal, counterNotes, currentUser?.id, selectedSuggestions, swap]);

  const handleAcceptSlot = useCallback((slotId: string) => {
    if (!swap) {
      return;
    }
    setErrorBanner(null);

    const currentUserId = String(currentUser?.id || (currentUser as any)?._id || '');
    const targetSlot = swap.proposedTimes.find((s) => (s._id || s.id) === slotId);
    if (targetSlot) {
      const proposerId = String(targetSlot.proposedById || (targetSlot as any)?.proposedById?._id || swap.requesterId || '');
      if (proposerId && currentUserId && proposerId === currentUserId) {
        showAlert(
          'Waiting for Partner',
          'You proposed this time slot. Only your exchange partner can accept or decline it.'
        );
        return;
      }
    }

    const isRequester = swap.requesterId === currentUser?.id;
    const swapType = swap.swapType || 'swap';

    // Learner (recipient in 'teach') or Skill Swapper (recipient in 'swap') pays 5 credits
    const isPayingUser =
      (swapType === 'teach' && !isRequester) ||
      (swapType === 'swap' && !isRequester);

    if (isPayingUser && !swap.recipientPaid) {
      const userCredits = currentUser?.credits ?? 0;
      const isFreeTier = (currentUser?.premiumTier || 'free') === 'free';
      const cost = isFreeTier ? 5 : 0;

      if (cost > 0 && userCredits < cost) {
        showAlert(
          'Insufficient Credits ⚠️',
          `Accepting this swap requires ${cost} credits. You currently have ${userCredits} credits. Please earn or top up your credits.`
        );
        return;
      }

      setPendingSlotToAccept(slotId);
      setCreditConfirmModalVisible(true);
    } else {
      acceptProposal({ requestId: swap.id, timeId: slotId });
    }
  }, [acceptProposal, swap, currentUser, showAlert]);

  const handleDeclineSlot = useCallback((slotId: string) => {
    if (!swap) return;
    setErrorBanner(null);
    declineSlot({ requestId: swap.id, slotId });
  }, [declineSlot, swap]);

  const handleConfirmCreditDeduction = useCallback(async () => {
    if (!swap || !pendingSlotToAccept) return;
    try {
      setIsAcceptingWithCredit(true);
      await acceptProposal({ requestId: swap.id, timeId: pendingSlotToAccept });
      await loadUser(true);
      setCreditConfirmModalVisible(false);
      setPendingSlotToAccept(null);
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to accept proposal');
    } finally {
      setIsAcceptingWithCredit(false);
    }
  }, [acceptProposal, loadUser, pendingSlotToAccept, swap]);

  const handleDeclineSwap = useCallback(() => {
    if (!swap) {
      return;
    }
    console.log('[SwapDetail] Declining swap', { swapId: swap.id });
    declineSwap({ requestId: swap.id, note: counterNotes.trim().length > 0 ? counterNotes.trim() : undefined });
    setCounterNotes('');
  }, [counterNotes, declineSwap, swap]);

  const handleLocationUpdate = useCallback(() => {
    if (!swap) {
      return;
    }
    if (locationDraft.trim().length === 0) {
      setErrorBanner('Add a location before saving.');
      return;
    }
    setErrorBanner(null);
    console.log('[SwapDetail] Updating location', { swapId: swap.id });
    updateLocation({ requestId: swap.id, location: locationDraft.trim() });
    setLocationDraft('');
  }, [locationDraft, swap, updateLocation]);

  const handleCompleteSwap = useCallback(async () => {
    if (!swap) {
      return;
    }
    console.log('[SwapDetail] Completing swap', { swapId: swap.id });
    try {
      await completeSwap(swap.id || (swap as any)._id);
    } catch (err: any) {
      const msg = err?.message || 'Failed to complete swap';
      setErrorBanner(msg);
      showAlert('Swap Completion Failed', msg);
    }
  }, [completeSwap, swap, showAlert]);

  const handleAddToCalendar = useCallback(async () => {
    if (!swap || !swap.acceptedTimeId) {
      showAlert('Error', 'No confirmed time slot to add to calendar');
      return;
    }

    const acceptedTime = swap.proposedTimes.find((t) => t._id === swap.acceptedTimeId);
    if (!acceptedTime) {
      showAlert('Error', 'Could not find accepted time slot');
      return;
    }

    setIsSyncingCalendar(true);
    setErrorBanner(null);

    try {
      const result = await addSwapToCalendar(
        swap,
        acceptedTime,
        counterpartSkill?.title ?? 'Skill Swap',
        partner?.username ?? (partner?.name ?? 'Partner'),
      );

      if (result.success && result.eventId) {
        setCalendarEventId(swap.id, result.eventId);
        showAlert(
          'Success',
          'Event added to your calendar with reminders set for 1 hour and 15 minutes before.',
          [{ text: 'OK' }]
        );
      } else {
        if (Platform.OS === 'web') {
          showAlert(
            'Web Platform',
            'Calendar sync is not available on web. Use "Export to iCalendar" instead to download an .ics file.',
            [{ text: 'OK' }]
          );
        } else {
          showAlert('Error', result.error || 'Failed to add event to calendar');
        }
      }
    } catch (error) {
      console.error('[SwapDetail] Calendar sync error:', error);
      showAlert('Error', 'An unexpected error occurred');
    } finally {
      setIsSyncingCalendar(false);
    }
  }, [swap, counterpartSkill, partner, showAlert]);

  const handleExportToICalendar = useCallback(async () => {
    if (!swap || !swap.acceptedTimeId) {
      showAlert('Error', 'No confirmed time slot to export');
      return;
    }

    const acceptedTime = swap.proposedTimes.find((t) => t._id === swap.acceptedTimeId);
    if (!acceptedTime) {
      showAlert('Error', 'Could not find accepted time slot');
      return;
    }

    setIsSyncingCalendar(true);
    setErrorBanner(null);

    try {
      const result = await exportSwapToICalendar(
        swap,
        acceptedTime,
        counterpartSkill?.title ?? 'Skill Swap',
        partner?.username ?? (partner?.name ?? 'Partner'),
      );

      if (result.success) {
        if (Platform.OS === 'web') {
          showAlert(
            'Export Complete',
            'iCalendar file downloaded. Open it to add the event to your calendar app.',
            [{ text: 'OK' }]
          );
        } else {
          showAlert(
            'Export Complete',
            'Share the iCalendar file with your calendar app to add the event.',
            [{ text: 'OK' }]
          );
        }
      } else {
        showAlert('Error', result.error || 'Failed to export calendar file');
      }
    } catch (error) {
      console.error('[SwapDetail] iCal export error:', error);
      showAlert('Error', 'An unexpected error occurred');
    } finally {
      setIsSyncingCalendar(false);
    }
  }, [swap, counterpartSkill, partner, showAlert]);

  const lockedInSlot = useMemo(() => {
    if (!swap) return null;
    if (swap.acceptedTimeId) {
      const found = swap.proposedTimes?.find(
        (t) => (t._id && String(t._id) === String(swap.acceptedTimeId)) || (t.id && String(t.id) === String(swap.acceptedTimeId))
      );
      if (found) return found;
    }
    return swap.proposedTimes?.find((t) => t.status === 'accepted') || null;
  }, [swap]);

  const handleStartCall = useCallback((callMode: 'video' | 'voice') => {
    if (typeof document !== 'undefined' && document.activeElement) {
      (document.activeElement as HTMLElement).blur();
    }

    if (!swap) return;

    // Check locked in slot
    const lockedSlot = swap.acceptedTimeId
      ? swap.proposedTimes?.find(
        (t) => (t._id && String(t._id) === String(swap.acceptedTimeId)) || (t.id && String(t.id) === String(swap.acceptedTimeId))
      ) || swap.proposedTimes?.find((t) => t.status === 'accepted')
      : swap.proposedTimes?.find((t) => t.status === 'accepted');

    if (!lockedSlot) {
      showAlert(
        'Time Slot Required 📅',
        'You can only start a call once a time slot has been accepted and locked in by you and your partner.'
      );
      return;
    }

    const startTime = new Date(lockedSlot.startISO).getTime();
    const now = Date.now();

    // If current time is before the locked in start time
    if (now < startTime) {
      setCallModeToStart(callMode);
      setCallTimeModalVisible(true);
      return;
    }

    const callerName = currentUser?.name || 'Partner';
    const callerId = String(currentUser?.id || (currentUser as any)?._id || '');
    const reqId = String((swap?.requesterId as any)?._id || (swap?.requesterId as any)?.id || swap?.requesterId || '');
    const recId = String((swap?.recipientId as any)?._id || (swap?.recipientId as any)?.id || swap?.recipientId || '');
    const partnerId = String(partner?.id || (partner as any)?._id || (reqId === callerId ? recId : reqId));

    // 1. Post real-time call alert message to swap thread
    if (swap?.id && callerId) {
      addMessage({
        requestId: swap.id,
        authorId: callerId,
        body: `${callerName} started the ${callMode} call. Tap to join!`,
        isSystem: true,
      });
    }

    // 2. Emit real-time call alert to partner
    if (socket && partnerId && partnerId !== 'partner-id' && partnerId !== 'partner' && partnerId.length > 2) {
      socket.emit('swap_call_started', {
        swapId: swap?.id || id,
        callerId,
        callerName,
        partnerId,
        recipientId: partnerId,
        mode: callMode,
      });
    }

    // 3. Navigate immediately to call room preview
    router.push(`/call/${swap?.id || id}?mode=${callMode}&partnerId=${partnerId}` as any);
  }, [currentUser, partner, swap, id, addMessage, router, showAlert, socket]);

  if (loading && !swap) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (!swap) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.emptyTitle}>Swap not found</Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => router.back()}
          testID="swap-not-found-back"
        >
          <Text style={styles.emptyButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Exchange details',
        }}
      />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#1F2937', '#111827']} style={styles.heroBanner}>
          <TouchableOpacity style={styles.backRow} onPress={() => router.back()} testID="swap-detail-back">
            <ArrowLeft size={20} color="#F8FAFC" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{partner?.username ? (partner.username.startsWith('@') ? partner.username : `@${partner.username}`) : (partner?.name ? `@${partner.name.toLowerCase().replace(/\s+/g, '')}` : 'Skill Partner')}</Text>
            <Text style={styles.heroSubtitle}>{headerCopy?.title}</Text>
            <Text style={styles.heroBody}>{headerCopy?.description}</Text>
          </View>
          <View style={[styles.heroBadge, { backgroundColor: headerCopy?.accent ?? '#38BDF8' }]}>
            <Text style={styles.heroBadgeText}>{swap.status.toUpperCase()}</Text>
          </View>
        </LinearGradient>

        {errorBanner && (
          <View style={styles.errorBanner} testID="swap-error">
            <X size={16} color="#F87171" />
            <Text style={styles.errorText}>{errorBanner}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Exchange Overview</Text>
          {/* Role badge */}
          {roleInfo && (
            <View style={[styles.detailRoleBadge, { backgroundColor: roleInfo.bg, borderColor: roleInfo.color }]}>
              <roleInfo.Icon size={16} color={roleInfo.color} />
              <Text style={[styles.detailRoleText, { color: roleInfo.color }]}>
                {roleInfo.myRole === 'Swapper' ? 'Mutual Skill Swap' : `You are the ${roleInfo.myRole}`}
              </Text>
            </View>
          )}
          <View style={styles.overviewCard}>
            <View style={styles.overviewRow}>
              {/* Teaching Skill Box */}
              <View style={[styles.overviewColumn, styles.overviewColumnTeaching]}>
                <View style={styles.overviewHeader}>
                  <View style={[styles.roleIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <GraduationCap size={16} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.overviewRoleTitle, { color: '#10B981' }]}>TEACHING</Text>
                    <Text style={styles.overviewPersonName} numberOfLines={1}>
                      {exchangeSkills.teacherName}
                    </Text>
                  </View>
                </View>
                <View style={styles.overviewSkillBox}>
                  <Text style={styles.overviewSkillLabel}>Skill to Teach</Text>
                  <Text style={styles.overviewValue} numberOfLines={2}>
                    {exchangeSkills.teachingSkillTitle}
                  </Text>
                  {!!exchangeSkills.teachingCategory && (
                    <Text style={styles.overviewCategory}>{exchangeSkills.teachingCategory}</Text>
                  )}
                </View>
              </View>

              {/* Learning Skill Box */}
              <View style={[styles.overviewColumn, styles.overviewColumnLearning]}>
                <View style={styles.overviewHeader}>
                  <View style={[styles.roleIconCircle, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                    <BookOpen size={16} color="#6366F1" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.overviewRoleTitle, { color: '#6366F1' }]}>LEARNING</Text>
                    <Text style={styles.overviewPersonName} numberOfLines={1}>
                      {exchangeSkills.learnerName}
                    </Text>
                  </View>
                </View>
                <View style={styles.overviewSkillBox}>
                  <Text style={styles.overviewSkillLabel}>
                    {exchangeSkills.swapType === 'swap' ? 'Skill to Learn' : 'Session Objective'}
                  </Text>
                  <Text style={styles.overviewValue} numberOfLines={2}>
                    {exchangeSkills.learningSkillTitle}
                  </Text>
                  {!!exchangeSkills.learningCategory && (
                    <Text style={styles.overviewCategory}>{exchangeSkills.learningCategory}</Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Proposed time slots</Text>
            <CalendarClock size={18} color={Colors.light.primary} />
          </View>
          <View style={styles.slotList}>
            {swap.proposedTimes.map((slot, i) => {
              const statusMeta = classifySlotStatus(slot);
              const isPending = slot.status === 'pending';
              const currentUserId = String(currentUser?.id || (currentUser as any)?._id || '');
              const slotProposerId = String(slot.proposedById || (slot as any)?.proposedById?._id || swap.requesterId || '');
              const isProposer = Boolean(currentUserId && slotProposerId && slotProposerId === currentUserId);
              const slotId = slot._id || slot.id || '';

              return (
                <View key={slotId || i} style={styles.slotCard} testID={`swap-slot-${slot.id}`}>
                  <View style={styles.slotInfo}>
                    <Clock size={18} color={statusMeta.color} />
                    <View style={styles.slotCopy}>
                      <Text style={styles.slotPrimary}>{formatTimestamp(slot.startISO)}</Text>
                      <Text style={[styles.slotSecondary, { color: statusMeta.color }]}>
                        {slot.status === 'pending'
                          ? isProposer
                            ? 'Proposed by you • Awaiting partner'
                            : 'Proposed by partner • Awaiting your response'
                          : statusMeta.label}
                      </Text>
                    </View>
                  </View>

                  {isPending && !isProposer && (
                    <View style={styles.slotActionButtons}>
                      <TouchableOpacity
                        style={styles.declineSlotButton}
                        onPress={() => handleDeclineSlot(slotId)}
                        activeOpacity={0.8}
                        testID={`decline-slot-${slot.id}`}
                      >
                        <X size={15} color="#EF4444" />
                        <Text style={styles.declineSlotText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => handleAcceptSlot(slotId)}
                        activeOpacity={0.9}
                        testID={`accept-slot-${slot.id}`}
                      >
                        <Check size={16} color="#0B1220" />
                        <Text style={styles.acceptText}>Accept</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {isPending && isProposer && (
                    <View style={styles.pendingProposerBadge}>
                      <Text style={styles.pendingProposerBadgeText}>Awaiting partner</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Suggest new times</Text>

          <Text style={styles.subHeadingLabel}>Quick options</Text>
          <View style={styles.suggestionRow}>
            {timeSuggestions.map((suggestion, i) => {
              const isActive = selectedSuggestions.some((item) => item.id === suggestion.id);
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleToggleSuggestion(suggestion)}
                  style={[styles.suggestionChip, isActive && styles.suggestionChipActive]}
                  testID={`counter-suggestion-${suggestion.id}`}
                >
                  <Text style={[styles.suggestionText, isActive && styles.suggestionTextActive]}>{suggestion.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Interactive Calendar Date & Time Button */}
          <TouchableOpacity
            style={styles.openCalendarPickerBtn}
            onPress={() => setCalendarModalVisible(true)}
            activeOpacity={0.85}
          >
            <CalendarClock size={20} color="#38BDF8" />
            <Text style={styles.openCalendarPickerText}>Choose Date & Time from Calendar 📅</Text>
          </TouchableOpacity>

          {/* Selected Slots Tag List */}
          {selectedSuggestions.length > 0 && (
            <View style={styles.selectedSlotsBox}>
              <Text style={styles.selectedSlotsTitle}>Selected Counter Slots ({selectedSuggestions.length}):</Text>
              <View style={styles.selectedSlotsRow}>
                {selectedSuggestions.map((slot) => (
                  <View key={slot.id} style={styles.selectedSlotTag}>
                    <Text style={styles.selectedSlotTagText}>{slot.label}</Text>
                    <TouchableOpacity onPress={() => handleToggleSuggestion(slot)}>
                      <X size={14} color="#F8FAFC" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* <TextInput
            style={styles.textArea}
            placeholder="Add context or preferred cadence (optional)"
            value={counterNotes}
            onChangeText={setCounterNotes}
            multiline
            numberOfLines={3}
            placeholderTextColor="rgba(148, 163, 184, 0.65)"
            testID="counter-notes-input"
          /> */}
          <View style={styles.counterActions}>
            <TouchableOpacity
              style={[styles.counterButton, styles.primaryButton]}
              onPress={handleSendCounterProposal}
              activeOpacity={0.9}
              testID="submit-counter-proposal"
            >
              <PlusCircle size={18} color="#0B1220" />
              <Text style={styles.primaryButtonText}>Send counter slots</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.counterButton, styles.declineButton]}
              onPress={handleDeclineSwap}
              activeOpacity={0.9}
              testID="decline-swap"
            >
              <X size={18} color="#991B1B" />
              <Text style={styles.declineText}>Decline swap</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Negotiation thread</Text>
            <Sparkles size={18} color={Colors.light.primary} />
          </View>
          <View style={styles.timeline}>
            {sortedNotes.map((note, i) => {
              const isSelf = note.authorId === currentUser?.id;
              return (
                <View key={i} style={[styles.noteBubble, isSelf ? styles.noteSelf : styles.notePartner]}
                  testID={`swap-note-${note.id}`}
                >
                  <Text style={styles.noteBody}>{note.body}</Text>
                  <Text style={styles.noteTimestamp}>{formatTimestamp(note.createdAt)}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.messageComposer}>
            <TextInput
              style={styles.messageInput}
              placeholder="Drop a note or next step"
              value={messageDraft}
              onChangeText={setMessageDraft}
              placeholderTextColor="rgba(148, 163, 184, 0.65)"
              testID="message-input"
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSendMessage}
              activeOpacity={0.9}
              testID="send-message"
            >
              <Send size={18} color="#0B1220" />
            </TouchableOpacity>
          </View>
        </View>

        {swap.status === 'scheduled' && (
          <View style={styles.section}>
            <View style={styles.calendarActions}>
              <TouchableOpacity
                style={[styles.calendarButton, swap.calendarEventId && styles.calendarButtonAdded]}
                onPress={handleAddToCalendar}
                activeOpacity={0.9}
                disabled={isSyncingCalendar || !!swap.calendarEventId}
                testID="add-to-calendar"
              >
                <CalendarPlus size={18} color={swap.calendarEventId ? '#10B981' : '#FFFFFF'} />
                <Text style={[styles.calendarButtonText, swap.calendarEventId && styles.calendarButtonTextAdded]}>
                  {swap.calendarEventId ? 'Added to Calendar' : isSyncingCalendar ? 'Syncing...' : 'Add to Calendar'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={handleExportToICalendar}
                activeOpacity={0.9}
                disabled={isSyncingCalendar}
                testID="export-ical"
              >
                <Download size={18} color="#3B82F6" />
                <Text style={styles.exportButtonText}>Export iCal</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.callActions}>
              <TouchableOpacity
                style={[styles.callButton, styles.videoCallButton, { backgroundColor: '#8B5CF6' }]}
                onPress={() => handleStartCall('video')}
                activeOpacity={0.9}
                testID="start-video-call"
              >
                <Video size={20} color="#FFFFFF" />
                <Text style={styles.callButtonText}>Start Video Call</Text>
              </TouchableOpacity>
            </View>
            {roleInfo?.myRole !== 'Teacher' && (
              <TouchableOpacity
                style={[styles.counterButton, styles.completeButton]}
                onPress={handleCompleteSwap}
                activeOpacity={0.9}
                testID="complete-swap"
              >
                <ShieldCheck size={18} color="#0F172A" />
                <Text style={styles.completeText}>Mark swap as completed</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* 📅 Visual Calendar Date & Time Selector Modal */}
      <Modal
        visible={calendarModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCalendarModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <LinearGradient
              colors={['#38BDF8', '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modalTopBar}
            />

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setCalendarModalVisible(false)}
            >
              <X size={18} color={Colors.light.textSecondary} />
            </TouchableOpacity>

            <View style={styles.modalIconBox}>
              <LinearGradient
                colors={['#F0F9FF', '#E0F2FE']}
                style={styles.modalIconCircle}
              >
                <CalendarClock size={32} color="#0284C7" />
              </LinearGradient>
            </View>

            <Text style={styles.modalTitle}>Choose Date & Time 📅</Text>
            <Text style={styles.modalDesc}>Select your preferred day and time slot to suggest for this swap.</Text>

            {/* HTML Calendar Date & Time Input */}
            <View style={styles.pickerSection}>
              <Text style={styles.pickerSectionTitle}>Select Date & Time (Calendar)</Text>
              {Platform.OS === 'web' ? (
                // @ts-ignore - native HTML datetime-local input popover
                <input
                  type="datetime-local"
                  value={customDateTimeStr}
                  onChange={(e: any) => setCustomDateTimeStr(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: '14px',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    backgroundColor: '#0F172A',
                    color: '#F8FAFC',
                    colorScheme: 'dark',
                    fontSize: '15px',
                    fontFamily: 'inherit',
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                />
              ) : (
                <TextInput
                  style={styles.customDateTimeInput}
                  placeholder="YYYY-MM-DD HH:MM"
                  placeholderTextColor="rgba(148, 163, 184, 0.65)"
                  value={customDateTimeStr}
                  onChangeText={setCustomDateTimeStr}
                />
              )}
            </View>

            {/* Quick Day Chips */}
            <View style={styles.pickerSection}>
              <Text style={styles.pickerSectionTitle}>Or Quick Select Day</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScroll}>
                {next14Days.map((d) => {
                  const isSelected = pickerSelectedDate === d.dateStr;
                  return (
                    <TouchableOpacity
                      key={d.dateStr}
                      style={[styles.dayCard, isSelected && styles.dayCardSelected]}
                      onPress={() => {
                        setPickerSelectedDate(d.dateStr);
                        setCustomDateTimeStr(`${d.dateStr}T${pickerSelectedTime}`);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.dayCardLabel, isSelected && styles.dayCardLabelSelected]}>{d.label}</Text>
                      <Text style={[styles.dayCardSublabel, isSelected && styles.dayCardSublabelSelected]}>{d.sublabel}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Quick Time Slot Grid */}
            <View style={styles.pickerSection}>
              <Text style={styles.pickerSectionTitle}>Or Quick Select Time</Text>
              <View style={styles.timeGrid}>
                {timeSlotOptions.map((time) => {
                  const isSelected = pickerSelectedTime === time;
                  const [h, m] = time.split(':').map(Number);
                  const displayTime = new Date(2026, 0, 1, h, m).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  });
                  return (
                    <TouchableOpacity
                      key={time}
                      style={[styles.timeSlotPill, isSelected && styles.timeSlotPillSelected]}
                      onPress={() => {
                        setPickerSelectedTime(time);
                        setCustomDateTimeStr(`${pickerSelectedDate}T${time}`);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.timeSlotPillText, isSelected && styles.timeSlotPillTextSelected]}>
                        {displayTime}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelActionBtn}
                onPress={() => setCalendarModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelActionText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmActionBtn}
                onPress={handleConfirmCalendarSlot}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#38BDF8', '#6366F1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmGradient}
                >
                  <PlusCircle size={16} color="#FFFFFF" />
                  <Text style={styles.confirmActionText}>Confirm & Add Slot</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ⚡ Custom Credit Deduction Warning Modal */}
      <Modal
        visible={creditConfirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isAcceptingWithCredit) {
            setCreditConfirmModalVisible(false);
            setPendingSlotToAccept(null);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Top Accent Bar */}
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modalTopBar}
            />

            {/* Close Button */}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => {
                if (!isAcceptingWithCredit) {
                  setCreditConfirmModalVisible(false);
                  setPendingSlotToAccept(null);
                }
              }}
              disabled={isAcceptingWithCredit}
            >
              <X size={18} color={Colors.light.textSecondary} />
            </TouchableOpacity>

            {/* Icon Banner */}
            <View style={styles.modalIconBox}>
              <LinearGradient
                colors={['#FFFBEB', '#FEF3C7']}
                style={styles.modalIconCircle}
              >
                <Coins size={32} color="#D97706" />
              </LinearGradient>
            </View>

            {/* Title & Description */}
            <Text style={styles.modalTitle}>Credit Requirement ⚡</Text>
            <Text style={styles.modalDesc}>
              As a {swap?.swapType === 'swap' ? 'Skill Swapper' : 'Learner'}, accepting this skill swap session requires <Text style={{ fontWeight: '700', color: '#D97706' }}>5 credits</Text>.
            </Text>

            {/* Credit Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Current Balance</Text>
                <Text style={styles.summaryValue}>{currentUser?.credits ?? 0} credits</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Deduction</Text>
                <Text style={[styles.summaryValue, { color: '#DC2626' }]}>-5 credits</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { fontWeight: '700', color: Colors.light.text }]}>Remaining Balance</Text>
                <Text style={[styles.summaryValue, { fontWeight: '700', color: '#10B981' }]}>
                  {Math.max(0, (currentUser?.credits ?? 0) - 5)} credits
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelActionBtn}
                onPress={() => {
                  setCreditConfirmModalVisible(false);
                  setPendingSlotToAccept(null);
                }}
                disabled={isAcceptingWithCredit}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelActionText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmActionBtn}
                onPress={handleConfirmCreditDeduction}
                disabled={isAcceptingWithCredit}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#F59E0B', '#D97706']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmGradient}
                >
                  {isAcceptingWithCredit ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Zap size={16} color="#FFFFFF" />
                      <Text style={styles.confirmActionText}>Accept (-5 Credits)</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ⏰ Call Time Restriction Modal */}
      <Modal
        visible={callTimeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCallTimeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Top Accent Bar */}
            <LinearGradient
              colors={['#8B5CF6', '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modalTopBar}
            />

            {/* Close Button */}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setCallTimeModalVisible(false)}
            >
              <X size={18} color={Colors.light.textSecondary} />
            </TouchableOpacity>

            {/* Icon Banner */}
            <View style={styles.modalIconBox}>
              <LinearGradient
                colors={['#F5F3FF', '#EDE9FE']}
                style={styles.modalIconCircle}
              >
                <CalendarClock size={34} color="#8B5CF6" />
              </LinearGradient>
            </View>

            {/* Title & Description */}
            <Text style={styles.modalTitle}>
              {callModeToStart === 'video' ? 'Video Call Not Started Yet' : 'Voice Call Not Started Yet'}
            </Text>
            <Text style={styles.modalDesc}>
              You can only start the {callModeToStart} call once the locked-in session time slot begins.
            </Text>

            {/* Locked In Slot Info Box */}
            {lockedInSlot && (
              <View style={styles.callLockInfoBox}>
                <View style={styles.callLockRow}>
                  <Clock size={18} color="#8B5CF6" />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.callLockLabel}>Locked-in Time Slot</Text>
                    <Text style={styles.callLockValue}>{formatTimestamp(lockedInSlot.startISO)}</Text>
                  </View>
                </View>

                <View style={styles.callLockDivider} />

                <View style={styles.callLockRow}>
                  <AlertCircle size={18} color="#6366F1" />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.callLockLabel}>Status</Text>
                    <Text style={styles.callLockCountdown}>
                      {getTimeRemainingText(lockedInSlot.startISO)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.confirmActionBtn, { flex: 1 }]}
                onPress={() => setCallTimeModalVisible(false)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#6366F1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmGradient}
                >
                  <Text style={styles.confirmActionText}>Got it</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  heroBanner: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    fontSize: 14,
    color: '#F8FAFC',
    fontWeight: '600' as const,
  },
  heroContent: {
    gap: 6,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: '#F8FAFC',
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(191, 219, 254, 0.9)',
    fontWeight: '600' as const,
  },
  heroBody: {
    fontSize: 13,
    color: 'rgba(203, 213, 225, 0.8)',
    lineHeight: 20,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#0B1220',
    letterSpacing: 0.6,
  },
  errorBanner: {
    marginTop: 18,
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#F87171',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
    gap: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  overviewCard: {
    backgroundColor: Colors.light.background,
    borderRadius: 18,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  overviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  overviewColumn: {
    flex: 1,
    minWidth: 140,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
  },
  overviewColumnTeaching: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  overviewColumnLearning: {
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewRoleTitle: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  overviewPersonName: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  overviewSkillBox: {
    gap: 4,
  },
  overviewSkillLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  overviewValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
    lineHeight: 20,
  },
  overviewCategory: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.primary,
    marginTop: 2,
  },
  overviewLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '600' as const,
  },
  overviewLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationLabel: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: '600' as const,
  },
  slotList: {
    gap: 12,
  },
  slotCard: {
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  slotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 200,
  },
  slotCopy: {
    flex: 1,
    gap: 4,
  },
  slotPrimary: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  slotSecondary: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#34D399',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  acceptText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#0B1220',
  },
  slotActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    alignSelf: 'flex-start',
  },
  declineSlotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  declineSlotText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#EF4444',
  },
  pendingProposerBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  pendingProposerBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#6366F1',
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 10,
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  suggestionChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  suggestionText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '600' as const,
  },
  suggestionTextActive: {
    color: '#FFFFFF',
  },
  textArea: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    backgroundColor: Colors.light.background,
    padding: 16,
    minHeight: 96,
    fontSize: 14,
    color: Colors.light.text,
    textAlignVertical: 'top' as const,
  },
  counterActions: {
    flexDirection: 'row',
    gap: 12,
  },
  counterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  primaryButton: {
    backgroundColor: '#38BDF8',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#0B1220',
  },
  declineButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  declineText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#991B1B',
  },
  locationCard: {
    backgroundColor: Colors.light.background,
    borderRadius: 18,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationHeading: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  locationValue: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  locationEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationInput: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.light.text,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  saveLocationButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.light.primary,
  },
  saveLocationText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  timeline: {
    gap: 12,
  },
  noteBubble: {
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  noteSelf: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  notePartner: {
    backgroundColor: Colors.light.background,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  noteBody: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
  },
  noteTimestamp: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  messageComposer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  messageInput: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: Colors.light.text,
  },
  sendButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButton: {
    backgroundColor: '#A855F7',
  },
  completeText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  callActions: {
    flexDirection: 'row',
    gap: 12,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  videoCallButton: {
    backgroundColor: '#8B5CF6',
  },
  voiceCallButton: {
    backgroundColor: '#10B981',
  },
  callButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  calendarActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  calendarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#6366F1',
  },
  calendarButtonAdded: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  calendarButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  calendarButtonTextAdded: {
    color: '#10B981',
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#3B82F6',
  },
  bottomSpacer: {
    height: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: Colors.light.background,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  emptyButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.light.primary,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  detailRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  detailRoleText: {
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.light.card,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalTopBar: {
    height: 6,
    width: '100%',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalIconBox: {
    alignItems: 'center',
    marginTop: 24,
  },
  modalIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FDE68A',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.light.text,
    textAlign: 'center',
    marginTop: 14,
  },
  modalDesc: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 6,
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.light.borderLight,
    marginVertical: 10,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
  },
  cancelActionBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  cancelActionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  confirmActionBtn: {
    flex: 1.4,
    borderRadius: 14,
    overflow: 'hidden',
  },
  confirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  confirmActionText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  subHeadingLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  openCalendarPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  openCalendarPickerText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#38BDF8',
  },
  selectedSlotsBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginBottom: 12,
    gap: 8,
  },
  selectedSlotsTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#38BDF8',
  },
  selectedSlotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  selectedSlotTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  selectedSlotTagText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#F8FAFC',
  },
  pickerSection: {
    marginHorizontal: 20,
    marginTop: 14,
    gap: 8,
  },
  pickerSectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
  },
  daysScroll: {
    flexDirection: 'row',
  },
  dayCard: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 72,
  },
  dayCardSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  dayCardLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 2,
  },
  dayCardLabelSelected: {
    color: '#FFFFFF',
  },
  dayCardSublabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  dayCardSublabelSelected: {
    color: 'rgba(255,255,255,0.85)',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  timeSlotPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  timeSlotPillSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  timeSlotPillText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  timeSlotPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  customDateTimeInput: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  callLockInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    width: '100%',
    gap: 12,
    marginVertical: 12,
  },
  callLockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  callLockLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#64748B',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  callLockValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  callLockDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  callLockCountdown: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#8B5CF6',
  },
});
