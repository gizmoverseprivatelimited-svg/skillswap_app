import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform, ActivityIndicator, Alert, Modal } from 'react-native';
import { useAlert } from '@/providers/alert';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MapPin, Clock, Check, X, Send, Sparkles, CalendarClock, PlusCircle, ArrowLeft, ShieldCheck, Video, Phone, CalendarPlus, Download, GraduationCap, BookOpen, ArrowLeftRight, Coins, Zap, AlertTriangle } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { useSkillSwaps } from '../../providers/skill-swaps';
import { useCurrentUser } from '../../providers/current-user';
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
  scheduled: { title: 'Session confirmed', accent: '#34D399', description: 'Everything is locked. Get ready to swap skills.' },
  declined: { title: 'Swap declined', accent: '#F87171', description: 'This swap was declined. You can explore other partners.' },
  completed: { title: 'Swap completed', accent: '#A855F7', description: 'Mark reflections and share a review with your partner.' },
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
      id: `suggest-${config.offsetHours}-${config.durationMinutes}`,
      label: start.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
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
  const { getSwapById, addMessage, addCounterProposal, acceptProposal, declineSwap, updateLocation, completeSwap, setCalendarEventId, loading } = useSkillSwaps();
  const { currentUser, allUsers, loadUser } = useCurrentUser();
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

  const swap = useMemo(() => {
    if (!id) {
      return undefined;
    }
    return getSwapById(id);
  }, [getSwapById, id]);

  // const allSkills = useMemo<SkillWithUser[]>(() => getSkillsWithUsers(), []);

  const [allSkills, setAllSkills] = useState<SkillWithUser[]>()

  useEffect(() => {
    getSkillsWithUsers().then((list) => {
      setAllSkills(list);
    });
  }, [id]);

  const skillsMap = useMemo(() => {
    const map = new Map<string, SkillWithUser>();
    allSkills?.forEach((skill) => {
      map.set(skill.id, skill);
    });
    return map;
  }, [allSkills]);

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
    if (swapType === 'learn') {
      if (isRequester) {
        return { myRole: 'Learner', partnerRole: 'Teacher', color: '#6366F1', bg: '#EEF2FF', Icon: BookOpen, myLabel: 'You learn', partnerLabel: `${partner?.name?.split(' ')[0] || 'Partner'} teaches` };
      }
      return { myRole: 'Teacher', partnerRole: 'Learner', color: '#10B981', bg: '#ECFDF5', Icon: GraduationCap, myLabel: 'You teach', partnerLabel: `${partner?.name?.split(' ')[0] || 'Partner'} learns` };
    }
    if (swapType === 'teach') {
      if (isRequester) {
        return { myRole: 'Teacher', partnerRole: 'Learner', color: '#10B981', bg: '#ECFDF5', Icon: GraduationCap, myLabel: 'You teach', partnerLabel: `${partner?.name?.split(' ')[0] || 'Partner'} learns` };
      }
      return { myRole: 'Learner', partnerRole: 'Teacher', color: '#6366F1', bg: '#EEF2FF', Icon: BookOpen, myLabel: 'You learn', partnerLabel: `${partner?.name?.split(' ')[0] || 'Partner'} teaches` };
    }
    return { myRole: 'Swapper', partnerRole: 'Swapper', color: '#F59E0B', bg: '#FFFBEB', Icon: ArrowLeftRight, myLabel: 'You offer', partnerLabel: `${partner?.username ? `@${partner.username}` : partner?.name?.split(' ')[0] || 'Partner'} offers` };
  }, [swap, currentUser, partner]);

  // Computed exchange details: clearly separated Teaching & Learning skills
  const exchangeSkills = useMemo(() => {
    if (!swap || !currentUser) {
      return { teachingSkill: null, learningSkill: null, teachingOwner: '', learningOwner: '' };
    }

    const isRequester = swap.requesterId === currentUser.id;
    const swapType = swap.swapType || 'swap';

    const requesterSkill = swap.requesterSkillId ? (skillsMap.get(swap.requesterSkillId) || null) : null;
    const recipientSkill = swap.recipientSkillId ? (skillsMap.get(swap.recipientSkillId) || null) : null;

    let teachingSkill: SkillWithUser | null = null;
    let learningSkill: SkillWithUser | null = null;
    let teachingOwner: string = '';
    let learningOwner: string = '';

    const partnerName = partner?.name?.split(' ')[0] || (partner?.username ? `@${partner.username}` : 'Partner');

    if (swapType === 'learn') {
      if (isRequester) {
        learningSkill = recipientSkill;
        teachingSkill = null;
        teachingOwner = `${partnerName} teaches`;
        learningOwner = 'You learn';
      } else {
        teachingSkill = recipientSkill;
        learningSkill = null;
        teachingOwner = 'You teach';
        learningOwner = `${partnerName} learns`;
      }
    } else if (swapType === 'teach') {
      if (isRequester) {
        teachingSkill = requesterSkill;
        learningSkill = null;
        teachingOwner = 'You teach';
        learningOwner = `${partnerName} learns`;
      } else {
        learningSkill = requesterSkill;
        teachingSkill = null;
        teachingOwner = `${partnerName} teaches`;
        learningOwner = 'You learn';
      }
    } else {
      if (isRequester) {
        teachingSkill = requesterSkill;
        learningSkill = recipientSkill;
        teachingOwner = 'You teach';
        learningOwner = `${partnerName} teaches`;
      } else {
        teachingSkill = recipientSkill;
        learningSkill = requesterSkill;
        teachingOwner = 'You teach';
        learningOwner = `${partnerName} teaches`;
      }
    }

    return {
      teachingSkill,
      learningSkill,
      teachingOwner,
      learningOwner,
      swapType,
      isRequester,
    };
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

  const handleSubmitCounter = useCallback(() => {
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

  const handleCompleteSwap = useCallback(() => {
    if (!swap) {
      return;
    }
    console.log('[SwapDetail] Completing swap', { swapId: swap.id });
    completeSwap(swap.id);
  }, [completeSwap, swap]);

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

  if (loading) {
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
          title: 'Swap details',
        }}
      />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#1F2937', '#111827']} style={styles.heroBanner}>
          <TouchableOpacity style={styles.backRow} onPress={() => router.back()} testID="swap-detail-back">
            <ArrowLeft size={20} color="#F8FAFC" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{partner?.username ? `@${partner.username}` : (partner?.name ?? 'Skill Partner')}</Text>
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
              <View style={styles.overviewColumn}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <GraduationCap size={16} color="#10B981" />
                  <Text style={[styles.overviewLabel, { color: '#10B981', fontWeight: '700' }]}>
                    {exchangeSkills.teachingOwner || 'Teaching'}
                  </Text>
                </View>
                <Text style={styles.overviewValue}>
                  {exchangeSkills.teachingSkill?.title ?? (swap?.swapType === 'learn' ? counterpartSkill?.title ?? 'Skill TBD' : 'None (Learner only)')}
                </Text>
              </View>

              {/* Learning Skill Box */}
              <View style={styles.overviewColumn}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <BookOpen size={16} color="#6366F1" />
                  <Text style={[styles.overviewLabel, { color: '#6366F1', fontWeight: '700' }]}>
                    {exchangeSkills.learningOwner || 'Learning'}
                  </Text>
                </View>
                <Text style={styles.overviewValue}>
                  {exchangeSkills.learningSkill?.title ?? (swap?.swapType === 'teach' ? yourSkill?.title ?? 'Skill TBD' : 'None (Teacher only)')}
                </Text>
              </View>
            </View>
            {swap.locationPreference && (
              <View style={styles.overviewLocation}>
                <MapPin size={16} color={Colors.light.primary} />
                <Text style={styles.locationLabel}>{swap.locationPreference}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Proposed time slots</Text>
            <CalendarClock size={18} color={Colors.light.primary} />
          </View>
          <View style={styles.slotList}>
            {swap.proposedTimes.map((slot,i) => {
              const statusMeta = classifySlotStatus(slot);
              const isPending = slot.status === 'pending';
              return (
                <View key={i} style={styles.slotCard} testID={`swap-slot-${slot.id}`}>
                  <View style={styles.slotInfo}>
                    <Clock size={18} color={statusMeta.color} />
                    <View style={styles.slotCopy}>
                      <Text style={styles.slotPrimary}>{formatTimestamp(slot.startISO)}</Text>
                      <Text style={[styles.slotSecondary, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                    </View>
                  </View>
                  {isPending && (
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => handleAcceptSlot(slot._id|| "")}
                      activeOpacity={0.9}
                      testID={`accept-slot-${slot.id}`}
                    >
                      <Check size={16} color="#0B1220" />
                      <Text style={styles.acceptText}>Accept</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Suggest new times</Text>
          <View style={styles.suggestionRow}>
            {timeSuggestions.map((suggestion,i) => {
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
          <TextInput
            style={styles.textArea}
            placeholder="Add context or preferred cadence"
            value={counterNotes}
            onChangeText={setCounterNotes}
            multiline
            numberOfLines={3}
            placeholderTextColor="rgba(148, 163, 184, 0.65)"
            testID="counter-notes-input"
          />
          <View style={styles.counterActions}>
            <TouchableOpacity
              style={[styles.counterButton, styles.primaryButton]}
              onPress={handleSubmitCounter}
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
          <Text style={styles.sectionHeading}>Location</Text>
          <View style={styles.locationCard}>
            <View style={styles.locationHeader}>
              <MapPin size={18} color={Colors.light.primary} />
              <Text style={styles.locationHeading}>Preferred space</Text>
            </View>
            <Text style={styles.locationValue}>{swap.locationPreference ?? 'No location yet'}</Text>
            <View style={styles.locationEditor}>
              <TextInput
                style={styles.locationInput}
                placeholder="Add or update meetup details"
                value={locationDraft}
                onChangeText={setLocationDraft}
                placeholderTextColor="rgba(148, 163, 184, 0.65)"
                testID="location-input"
              />
              <TouchableOpacity
                style={styles.saveLocationButton}
                onPress={handleLocationUpdate}
                activeOpacity={0.9}
                testID="save-location"
              >
                <Text style={styles.saveLocationText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Negotiation thread</Text>
            <Sparkles size={18} color={Colors.light.primary} />
          </View>
          <View style={styles.timeline}>
            {sortedNotes.map((note,i) => {
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
                style={[styles.callButton, styles.videoCallButton]}
                onPress={() => {
                  if (typeof document !== 'undefined' && document.activeElement) {
                    (document.activeElement as HTMLElement).blur();
                  }
                  router.push(`/call/${swap.id}`);
                }}
                activeOpacity={0.9}
                testID="start-video-call"
              >
                <Video size={20} color="#FFFFFF" />
                <Text style={styles.callButtonText}>Video Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.callButton, styles.voiceCallButton]}
                onPress={() => {
                  if (typeof document !== 'undefined' && document.activeElement) {
                    (document.activeElement as HTMLElement).blur();
                  }
                  router.push(`/call/${swap.id}`);
                }}
                activeOpacity={0.9}
                testID="start-voice-call"
              >
                <Phone size={20} color="#FFFFFF" />
                <Text style={styles.callButtonText}>Voice Call</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.counterButton, styles.completeButton]}
              onPress={handleCompleteSwap}
              activeOpacity={0.9}
              testID="complete-swap"
            >
              <ShieldCheck size={18} color="#0F172A" />
              <Text style={styles.completeText}>Mark swap as completed</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

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
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  overviewRow: {
    flexDirection: 'row',
    gap: 18,
  },
  overviewColumn: {
    flex: 1,
    gap: 6,
  },
  overviewLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '600' as const,
  },
  overviewValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    lineHeight: 22,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  slotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  slotCopy: {
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
});
