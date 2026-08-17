import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarCheck2, Clock, MapPin, Sparkles, X, ArrowRight, Check, AlertTriangle, Coins, GraduationCap, BookOpen, ArrowLeftRight, IndianRupee, CalendarClock } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Colors from '../constants/colors';
import { formatPrice } from '../constants/locale';
import type { SkillSwapRequest, SkillWithUser, SwapType } from '../types';
import { useCurrentUser } from '../providers/current-user';
import { useSafety } from '../providers/safety';
import { useSkillSwaps } from '../providers/skill-swaps';
import { getSwapRequestCost, getSessionCreditCost, getPlatformFee, formatCredits } from '../lib/payments';

interface SkillSwapRequestModalProps {
  visible: boolean;
  skill: SkillWithUser;
  onClose: () => void;
}

interface TimeOption {
  id: string;
  label: string;
  startISO: string;
  endISO: string;
}

const formatTimeLabel = (startISO: string): string => {
  const date = new Date(startISO);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const buildTimeOptions = (): TimeOption[] => {
  const base = Date.now();
  return [
    { offsetHours: 6, durationMinutes: 60 },
    { offsetHours: 24, durationMinutes: 60 },
    { offsetHours: 30, durationMinutes: 75 },
    { offsetHours: 48, durationMinutes: 90 },
    { offsetHours: 72, durationMinutes: 60 },
  ].map((config) => {
    const start = new Date(base + config.offsetHours * 60 * 60 * 1000);
    const end = new Date(start.getTime() + config.durationMinutes * 60 * 1000);
    return {
      id: `time-${config.offsetHours}-${config.durationMinutes}`,
      label: formatTimeLabel(start.toISOString()),
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    };
  });
};

const locationOptions = [
  'Virtual Studio Lounge',
  'Creative Hive Cowork',
  'Neighborhood Coffee Lab',
  'Outdoor Park Meetup',
];

const headlineGradient = ['#0F172A', '#1E293B'] as const;

const SWAP_TYPE_OPTIONS: {
  key: SwapType;
  title: string;
  subtitle: string;
  icon: typeof GraduationCap;
  color: string;
  bg: string;
}[] = [
  {
    key: 'learn',
    title: 'Learn from them',
    subtitle: 'You are the learner',
    icon: BookOpen,
    color: '#6366F1',
    bg: '#EEF2FF',
  },
  {
    key: 'teach',
    title: 'Teach them',
    subtitle: 'You are the teacher',
    icon: GraduationCap,
    color: '#10B981',
    bg: '#ECFDF5',
  },
  {
    key: 'swap',
    title: 'Skill Exchange',
    subtitle: 'Teach & learn together',
    icon: ArrowLeftRight,
    color: '#F59E0B',
    bg: '#FFFBEB',
  },
];

export default function SkillSwapRequestModal({ visible, skill, onClose }: SkillSwapRequestModalProps) {
  const router = useRouter();
  const { currentUser, allUsers } = useCurrentUser();
  const { isBlocked, checkBlockStatus } = useSafety();
  const { createSwapRequest } = useSkillSwaps();
  const [step, setStep] = useState<number>(0);
  const [swapType, setSwapType] = useState<SwapType | null>(null);
  
  // Selected skills
  const [selectedRequesterSkillId, setSelectedRequesterSkillId] = useState<string>('');
  const [selectedRecipientSkillId, setSelectedRecipientSkillId] = useState<string>('');

  const [selectedTimes, setSelectedTimes] = useState<TimeOption[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('Online Video Call');
  const [introMessage, setIntroMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Calendar picker state
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

  const handleConfirmCalendarSlot = useCallback(() => {
    let start: Date | null = null;
    if (customDateTimeStr) {
      start = new Date(customDateTimeStr);
    }
    if (!start || isNaN(start.getTime())) {
      if (pickerSelectedDate && pickerSelectedTime) {
        const [year, month, day] = pickerSelectedDate.split('-').map(Number);
        const [hours, minutes] = pickerSelectedTime.split(':').map(Number);
        start = new Date(year, month - 1, day, hours, minutes, 0, 0);
      }
    }

    if (!start || isNaN(start.getTime())) {
      setError('Please select a valid date and time from the calendar.');
      return;
    }

    const id = `custom-${start.getTime()}`;
    const label = formatTimeLabel(start.toISOString());
    const newOption: TimeOption = {
      id,
      label,
      startISO: start.toISOString(),
      endISO: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
    };

    setSelectedTimes((prev) => {
      if (prev.some((s) => s.id === id)) return prev;
      if (prev.length >= 3) {
        return [...prev.slice(1), newOption];
      }
      return [...prev, newOption];
    });
    setCalendarModalVisible(false);
  }, [customDateTimeStr, pickerSelectedDate, pickerSelectedTime]);

  // Latest partner data from backend (via allUsers)
  const latestPartner = useMemo(() => {
    if (!skill?.user?.id) return skill?.user;
    return allUsers.find((u) => u.id === skill.user.id || (u as any)._id === skill.user.id) || skill.user;
  }, [allUsers, skill?.user]);

  // Partner skills list (ensure current skill is present)
  const partnerSkills = useMemo(() => {
    if (!skill) return [];
    const list = latestPartner?.skillsOffered || [];
    const currentId = skill._id || skill.id;
    const exists = list.some((s) => (s._id || s.id) === currentId);
    if (!exists && skill) {
      return [skill, ...list];
    }
    return list;
  }, [skill, latestPartner]);

  // For 'teach' type, teacher pays nothing; for 'learn'/'swap', credits apply
  const platformFee = useMemo(() => {
    if (swapType === 'teach') return 0;
    return getPlatformFee(currentUser || { premiumTier: 'free' });
  }, [swapType, currentUser]);
  const activeMySkill = useMemo(() => {
    return currentUser?.skillsOffered.find((candidate) => (candidate._id || candidate.id) === selectedRequesterSkillId) ?? null;
  }, [currentUser?.skillsOffered, selectedRequesterSkillId]);

  const activePartnerSkill = useMemo(() => {
    return partnerSkills.find((candidate) => (candidate._id || candidate.id) === selectedRecipientSkillId) ?? null;
  }, [partnerSkills, selectedRecipientSkillId]);

  const targetLearnedSkill = useMemo(() => {
    return activePartnerSkill || skill;
  }, [activePartnerSkill, skill]);

  const sessionCost = useMemo(() => getSessionCreditCost(targetLearnedSkill), [targetLearnedSkill]);
  const isMonthlySkill = targetLearnedSkill?.pricingModel === 'monthly';
  const swapCost = platformFee; // paid upfront at request time
  const totalCost = swapCost;
  const hasEnoughCredits = (currentUser?.credits ?? 0) >= totalCost;
  const isPaidSession = sessionCost > 0;

  // Step titles — consistent 4 steps across all swap types
  const stepTitles = ['Request type', 'Choose skills', 'Pick session slots', 'Wrap-up details'];
  const totalSteps = stepTitles.length;

  type SwapPayload = Parameters<typeof createSwapRequest>[0];

  const {
    mutateAsync: submitSwapRequest,
    reset: resetSwapMutation,
    isPending: isSubmitting,
  } = useMutation<SkillSwapRequest, unknown, SwapPayload>({
    mutationFn: async (payload) => {
      return createSwapRequest(payload);
    },
  });

  const wasVisible = useRef(false);

  useEffect(() => {
    if (visible && !wasVisible.current) {
      setStep(0);
      setSwapType(null);
      setSelectedRequesterSkillId(currentUser?.skillsOffered[0]?._id || currentUser?.skillsOffered[0]?.id || '');
      setSelectedRecipientSkillId(skill?._id || skill?.id || '');
      setSelectedTimes([]);
      setSelectedLocation('Online Video Call');
      setIntroMessage('');
      setError(null);
      setCalendarModalVisible(false);
      resetSwapMutation();
    }
    wasVisible.current = visible;
  }, [visible, resetSwapMutation]);

  const timeOptions = useMemo<TimeOption[]>(() => {
    return buildTimeOptions();
  }, []);

  const mergedLocation = useMemo<string>(() => {
    return selectedLocation || 'Online Video Call';
  }, [selectedLocation]);

  // Determine step roles
  const isTypeStep = step === 0;
  const isSkillStep = step === 1;
  const isTimeStep = step === 2;
  const isDetailsStep = step === 3;

  const canAdvance = useMemo<boolean>(() => {
    if (isTypeStep) {
      return swapType !== null;
    }
    if (isSkillStep) {
      if (swapType === 'learn') {
        return selectedRecipientSkillId?.trim().length > 0;
      }
      if (swapType === 'teach') {
        return selectedRequesterSkillId?.trim().length > 0;
      }
      if (swapType === 'swap') {
        return selectedRequesterSkillId?.trim().length > 0 && selectedRecipientSkillId?.trim().length > 0;
      }
    }
    if (isTimeStep) {
      return selectedTimes.length > 0;
    }
    if (isDetailsStep) {
      return mergedLocation?.trim().length > 0;
    }
    return false;
  }, [isTypeStep, isSkillStep, isTimeStep, isDetailsStep, swapType, selectedRequesterSkillId, selectedRecipientSkillId, selectedTimes.length, mergedLocation]);

  const handleSelectTime = useCallback(
    (option: TimeOption) => {
      setSelectedTimes((previous) => {
        const exists = previous.some((item) => item.id === option.id);
        if (exists) {
          return previous.filter((item) => item.id !== option.id);
        }
        if (previous.length >= 3) {
          return [...previous.slice(1), option];
        }
        return [...previous, option];
      });
    },
    []);

  const handleContinue = useCallback(() => {
    if (!canAdvance || isSubmitting) {
      if (!canAdvance) {
        setError('Complete this step to move forward.');
      }
      return;
    }
    setError(null);
    if (step < totalSteps - 1) {
      setStep((previous) => previous + 1);
      return;
    }
    const payloadTimes = selectedTimes.map((slot) => {
      return { startISO: slot.startISO, endISO: slot.endISO };
    });
    const submit = async () => {
      const targetUid = skill.user?.id || (skill.user as any)?._id;
      if (targetUid) {
        if (isBlocked(targetUid)) {
          setError('You cannot send swap requests to a blocked user.');
          return;
        }
        const blockStatus = await checkBlockStatus(targetUid);
        if (blockStatus.isBlocked) {
          setError('You cannot send swap requests to this user due to block settings.');
          return;
        }
      }
      if (!hasEnoughCredits && swapCost > 0) {
        setError(`You need ${swapCost - (currentUser?.credits || 0)} more credits to send this request.`);
        return;
      }
      try {
        const payload = {
          recipientId: skill.user.id,
          recipientSkillId: selectedRecipientSkillId || skill.id,
          requesterSkillId: swapType === 'learn' ? undefined : selectedRequesterSkillId,
          swapType: swapType!,
          proposedTimes: payloadTimes,
          locationPreference: mergedLocation,
          message: introMessage?.trim().length > 0 ? introMessage : undefined,
        };

        const createdSwap = await createSwapRequest(payload);
        onClose();
        router.push(`/swaps/${createdSwap.id}` as never);
      } catch (swapError) {
        console.log('[SkillSwap] Failed to create request', swapError);
        setError('Unable to create the request. Try again.');
      }
    };
    void submit();
  }, [canAdvance, introMessage, isSubmitting, mergedLocation, onClose, router, selectedRequesterSkillId, selectedRecipientSkillId, selectedTimes, skill.id, skill.user.id, step, totalSteps, swapType, swapCost, hasEnoughCredits, currentUser?.credits, createSwapRequest]);

  const partnerName = useMemo(() => {
    const target = latestPartner || skill.user;
    if (!target) return 'Partner';
    return target.username ? (target.username.startsWith('@') ? target.username : `@${target.username}`) : `@${target.name.toLowerCase().replace(/\s+/g, '')}`;
  }, [latestPartner, skill.user]);

  const roleDescription = useMemo(() => {
    if (!swapType) return '';
    const learnedSkillTitle = activePartnerSkill?.title || skill.title;
    const taughtSkillTitle = activeMySkill?.title || 'your skill';
    if (swapType === 'learn') return `You will learn "${learnedSkillTitle}" from ${partnerName}`;
    if (swapType === 'teach') return `You will teach "${taughtSkillTitle}" to ${partnerName}`;
    return `You teach "${taughtSkillTitle}" & learn "${learnedSkillTitle}"`;
  }, [swapType, skill, activePartnerSkill, activeMySkill, partnerName]);

  const headlineText = useMemo(() => {
    if (!swapType) return `Request a session with ${partnerName}`;
    if (swapType === 'learn') return `Learn from ${partnerName}`;
    if (swapType === 'teach') return `Teach ${partnerName}`;
    return `Exchange with ${partnerName}`;
  }, [swapType, partnerName]);

  return (
    <Modal
      visible={visible}
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <LinearGradient colors={headlineGradient} style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headline}>{headlineText}</Text>
              <Text style={styles.subheadline}>{stepTitles[step]}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton} testID="close-swap-modal">
              <X size={20} color="#E2E8F0" />
            </Pressable>
          </LinearGradient>

          <View style={styles.progressRow}>
            {stepTitles.map((title, index) => {
              const isActive = index === step;
              const isDone = index < step;
              return (
                <View key={index} style={[styles.progressDot, (isActive || isDone) && styles.progressDotActive]} />
              );
            })}
          </View>

          {/* Role badge — shown after type is selected */}
          {swapType && step > 0 && (
            <View style={styles.roleBanner}>
              <View style={[styles.roleBadge, {
                backgroundColor: swapType === 'teach' ? '#ECFDF5' : swapType === 'learn' ? '#EEF2FF' : '#FFFBEB',
                borderColor: swapType === 'teach' ? '#10B981' : swapType === 'learn' ? '#6366F1' : '#F59E0B',
              }]}>
                {swapType === 'teach' && <GraduationCap size={14} color="#10B981" />}
                {swapType === 'learn' && <BookOpen size={14} color="#6366F1" />}
                {swapType === 'swap' && <ArrowLeftRight size={14} color="#F59E0B" />}
                <Text style={[styles.roleBadgeText, {
                  color: swapType === 'teach' ? '#10B981' : swapType === 'learn' ? '#6366F1' : '#F59E0B',
                }]}>
                  {swapType === 'teach' ? 'You are the Teacher' : swapType === 'learn' ? 'You are the Learner' : 'Mutual Swap'}
                </Text>
              </View>
              <Text style={styles.roleDescription}>{roleDescription}</Text>
            </View>
          )}

          <ScrollView
            style={styles.contentScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.contentInner}
          >
            <View>
              {/* Step 0: Swap Type Selection */}
              {isTypeStep && (
                <View style={styles.stepSection}>
                  <Text style={styles.sectionLabel}>How do you want to connect?</Text>
                  <View style={styles.typeOptions}>
                    {SWAP_TYPE_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isActive = swapType === opt.key;
                      return (
                        <Pressable
                          key={opt.key}
                          onPress={() => setSwapType(opt.key)}
                          style={[styles.typeCard, isActive && { borderColor: opt.color, borderWidth: 2 }]}
                          testID={`swap-type-${opt.key}`}
                        >
                          <View style={[styles.typeIconWrap, { backgroundColor: opt.bg }]}>
                            <Icon size={24} color={opt.color} />
                          </View>
                          <View style={styles.typeCardContent}>
                            <Text style={styles.typeCardTitle}>{opt.title}</Text>
                            <Text style={styles.typeCardSubtitle}>{opt.subtitle}</Text>
                          </View>
                          {isActive && (
                            <View style={[styles.typeCheckCircle, { backgroundColor: opt.color }]}>
                              <Check size={14} color="#FFFFFF" />
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                  {swapType && (
                    <View style={styles.typeCostHint}>
                      <Coins size={16} color={swapType === 'teach' ? '#10B981' : '#F59E0B'} />
                      <Text style={styles.typeCostText}>
                        {swapType === 'teach'
                          ? 'Free — you earn 50 points on completion'
                          : swapCost === 0
                            ? 'Free with Premium'
                            : `Costs ${swapCost} credits`}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Step 1: Skill Selection (Learner chooses target skill, Teacher chooses taught skill, Swap chooses both) */}
              {isSkillStep && (
                <View style={styles.stepSection}>
                  {/* TEACHER SKILL SELECTION (For 'teach' or 'swap') */}
                  {(swapType === 'teach' || swapType === 'swap') && (
                    <View style={{ gap: 10 }}>
                      <Text style={styles.sectionLabel}>
                        Skill you will teach {skill.user.name.split(' ')[0]}
                      </Text>
                      {currentUser?.skillsOffered && currentUser.skillsOffered.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skillsRow}>
                          {currentUser.skillsOffered.map((offeredSkill, i) => {
                            const itemKey = offeredSkill._id || offeredSkill.id || `my-skill-${i}`;
                            const isActive = itemKey === selectedRequesterSkillId;
                            return (
                              <Pressable
                                key={i}
                                onPress={() => setSelectedRequesterSkillId(itemKey)}
                                style={[styles.skillCard, isActive && styles.skillCardActive]}
                                testID={`offer-skill-${itemKey}`}
                              >
                                <LinearGradient
                                  colors={isActive ? ['#38BDF8', '#6366F1'] : ['#1E293B', '#0F172A']}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 1 }}
                                  style={styles.skillCardGradient}
                                >
                                  <View style={styles.skillCardHeader}>
                                    <Sparkles size={16} color={isActive ? '#0B1220' : '#3B82F6'} />
                                    <Text style={[styles.skillCardLevel, isActive && styles.skillCardLevelActive]}>{offeredSkill.level}</Text>
                                  </View>
                                  <Text style={[styles.skillCardTitle, isActive && styles.skillCardTitleActive]} numberOfLines={2}>
                                    {offeredSkill.title}
                                  </Text>
                                </LinearGradient>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      ) : (
                        <Text style={{ fontSize: 13, color: '#F87171' }}>
                          You don't have any teaching skills added to your profile yet.
                        </Text>
                      )}
                    </View>
                  )}

                  {/* LEARNER SKILL SELECTION (For 'learn' or 'swap') */}
                  {(swapType === 'learn' || swapType === 'swap') && (
                    <View style={{ gap: 10, marginTop: swapType === 'swap' ? 16 : 0 }}>
                      <Text style={styles.sectionLabel}>
                        Skill you want to learn from {skill.user.name.split(' ')[0]}
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skillsRow}>
                        {partnerSkills.map((pSkill, i) => {
                          const itemKey = pSkill._id || pSkill.id || `partner-skill-${i}`;
                          const isActive = itemKey === selectedRecipientSkillId;
                          return (
                            <Pressable
                              key={i}
                              onPress={() => setSelectedRecipientSkillId(itemKey)}
                              style={[styles.skillCard, isActive && styles.skillCardActive]}
                              testID={`learn-skill-${itemKey}`}
                            >
                              <LinearGradient
                                colors={isActive ? ['#34D399', '#059669'] : ['#1E293B', '#0F172A']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.skillCardGradient}
                              >
                                <View style={styles.skillCardHeader}>
                                  <BookOpen size={16} color={isActive ? '#0B1220' : '#10B981'} />
                                  <Text style={[styles.skillCardLevel, isActive && styles.skillCardLevelActive]}>{pSkill.level}</Text>
                                </View>
                                <Text style={[styles.skillCardTitle, isActive && styles.skillCardTitleActive]} numberOfLines={2}>
                                  {pSkill.title}
                                </Text>
                              </LinearGradient>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              {/* Time Selection Step */}
              {isTimeStep && (
                <View style={styles.stepSection}>
                  <Text style={styles.sectionLabel}>Suggest up to 3 slots</Text>

                  <Text style={styles.subHeadingLabel}>Quick options</Text>
                  <View style={styles.timeGrid}>
                    {timeOptions.map((option, i) => {
                      const isSelected = selectedTimes.some((item) => item.id === option.id);
                      return (
                        <Pressable
                          key={i}
                          onPress={() => handleSelectTime(option)}
                          style={[styles.timeChip, isSelected && styles.timeChipActive]}
                          testID={`swap-time-${option.id}`}
                        >
                          <Clock size={16} color={isSelected ? '#0B1220' : Colors.light.primary} />
                          <Text style={[styles.timeChipText, isSelected && styles.timeChipTextActive]}>{option.label}</Text>
                          {isSelected && <Check size={16} color="#0B1220" />}
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Interactive Calendar Date & Time Button */}
                  <TouchableOpacity
                    style={styles.openCalendarPickerBtn}
                    onPress={() => setCalendarModalVisible(true)}
                    activeOpacity={0.85}
                    testID="open-calendar-picker-btn"
                  >
                    <CalendarClock size={20} color="#38BDF8" />
                    <Text style={styles.openCalendarPickerText}>Choose Date & Time from Calendar 📅</Text>
                  </TouchableOpacity>

                  {selectedTimes.length > 0 && (
                    <View style={styles.selectedPreview}>
                      <Text style={styles.sectionLabel}>Selected ({selectedTimes.length}/3)</Text>
                      {selectedTimes.map((slot, i) => (
                        <View key={`preview-${i}`} style={styles.selectedRow}>
                          <CalendarCheck2 size={16} color={Colors.light.primary} />
                          <Text style={styles.selectedText}>{formatTimeLabel(slot.startISO)}</Text>
                          <Pressable onPress={() => handleSelectTime(slot)} style={{ marginLeft: 'auto', padding: 4 }}>
                            <X size={14} color="#94A3B8" />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Details Step */}
              {isDetailsStep && (
                <View style={styles.stepSection}>
                  <View style={styles.creditsCostCard}>
                    <View style={styles.creditsCostHeader}>
                      <View style={styles.creditsCostIcon}>
                        <Coins size={20} color={swapType === 'teach' ? '#10B981' : '#F59E0B'} />
                      </View>
                      <View style={styles.creditsCostInfo}>
                        <Text style={{ fontSize: 13, fontWeight: '600' as const, color: '#92400E', marginBottom: 2 }}>Payment Summary</Text>
                        <Text style={{ fontSize: 18, fontWeight: '700' as const, color: '#78350F' }}>
                          {swapType === 'teach' ? 'Free — Earn on completion' : totalCost === 0 ? 'Free Request' : `${totalCost} Credits`}
                        </Text>
                      </View>
                    </View>

                    {swapType !== 'teach' && (
                      <View style={{ gap: 8, paddingTop: 4 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 13, color: '#92400E' }}>Platform fee (request):</Text>
                          <Text style={{ fontSize: 14, fontWeight: '600' as const, color: '#78350F' }}>
                            {platformFee === 0 ? 'Free (Premium)' : `${platformFee} cr`}
                          </Text>
                        </View>
                        {isPaidSession && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 13, color: '#92400E' }}>
                              {isMonthlySkill ? 'Monthly subscription:' : 'Session cost (at completion):'}
                            </Text>
                            <Text style={{ fontSize: 14, fontWeight: '600' as const, color: '#78350F' }}>
                              {sessionCost} cr ({formatPrice(sessionCost)}){isMonthlySkill ? '/month' : ''}
                            </Text>
                          </View>
                        )}
                        {!isPaidSession && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 13, color: '#92400E' }}>Session type:</Text>
                            <Text style={{ fontSize: 14, fontWeight: '600' as const, color: '#15803D' }}>Free skill exchange</Text>
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTopWidth: 1, borderTopColor: '#FDE68A' }}>
                          <Text style={{ fontSize: 13, fontWeight: '600' as const, color: '#92400E' }}>Pay now:</Text>
                          <Text style={{ fontSize: 16, fontWeight: '800' as const, color: '#78350F' }}>
                            {totalCost === 0 ? 'Free' : `${totalCost} cr`}
                          </Text>
                        </View>
                      </View>
                    )}

                    {swapType !== 'teach' && !hasEnoughCredits && totalCost > 0 && (
                      <View style={styles.creditsWarning}>
                        <AlertTriangle size={16} color="#F59E0B" />
                        <Text style={styles.creditsWarningText}>
                          You need {totalCost - (currentUser?.credits || 0)} more credits
                        </Text>
                      </View>
                    )}
                    {swapType !== 'teach' && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#FDE68A' }}>
                        <Text style={{ fontSize: 13, color: '#92400E' }}>Your Balance:</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700' as const, color: '#78350F' }}>{formatCredits(currentUser?.credits ?? 0)}</Text>
                      </View>
                    )}
                    {isPaidSession && swapType !== 'teach' && (
                      <View style={{ backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <IndianRupee size={14} color="#15803D" />
                        <Text style={{ fontSize: 12, color: '#15803D', fontWeight: '500' as const, flex: 1 }}>
                          {isMonthlySkill
                            ? 'Monthly subscription fee is auto-debited each month while active. Teacher earns 80%.'
                            : 'Session cost charged when swap completes. Teacher earns 80%.'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Add a warm intro</Text>
                    <TextInput
                      style={[styles.input, styles.messageInput]}
                      placeholder="Share context, goals, or what excites you about this session"
                      value={introMessage}
                      onChangeText={setIntroMessage}
                      multiline
                      numberOfLines={4}
                      placeholderTextColor="rgba(148, 163, 184, 0.7)"
                      testID="intro-message-input"
                    />
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {error && (
            <View style={styles.errorBanner}>
              <AlertTriangle size={18} color="#F87171" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            onPress={handleContinue}
            style={[
              styles.primaryButton,
              (!canAdvance || isSubmitting) && styles.primaryButtonDisabled,
            ]}
            testID={step < totalSteps - 1 ? 'swap-continue-button' : 'swap-submit-button'}
            disabled={!canAdvance || isSubmitting}
          >
            <LinearGradient
              colors={canAdvance && !isSubmitting ? ['#22D3EE', '#6366F1'] : ['#1E293B', '#1E293B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryGradient}
            >
              <Text style={styles.primaryText}>
                {isSubmitting ? 'Sending…' : step < totalSteps - 1 ? 'Continue' : 'Send Request'}
              </Text>
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#0B1220" />
              ) : (
                <ArrowRight size={18} color="#0B1220" />
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      {/* 📅 Visual Calendar Date & Time Selector Modal */}
      <Modal
        visible={calendarModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCalendarModalVisible(false)}
      >
        <View style={styles.calModalOverlay}>
          <View style={styles.calModalCard}>
            <LinearGradient
              colors={['#38BDF8', '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.calModalTopBar}
            />

            <TouchableOpacity
              style={styles.calModalCloseBtn}
              onPress={() => setCalendarModalVisible(false)}
              testID="close-calendar-modal-btn"
            >
              <X size={18} color={Colors.light.textSecondary} />
            </TouchableOpacity>

            <View style={styles.calModalIconBox}>
              <LinearGradient
                colors={['#F0F9FF', '#E0F2FE']}
                style={styles.calModalIconCircle}
              >
                <CalendarClock size={32} color="#0284C7" />
              </LinearGradient>
            </View>

            <Text style={styles.calModalTitle}>Choose Date & Time 📅</Text>
            <Text style={styles.calModalDesc}>Select your preferred day and time slot to suggest for this swap.</Text>

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
            <View style={styles.calModalActions}>
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
                testID="confirm-calendar-slot-btn"
              >
                <LinearGradient
                  colors={['#38BDF8', '#6366F1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmGradient}
                >
                  <CalendarCheck2 size={18} color="#FFFFFF" />
                  <Text style={styles.confirmActionText}>Add Slot</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    backgroundColor: Colors.light.background,
    overflow: 'hidden',
  },
  header: {
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headline: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#F8FAFC',
    marginBottom: 6,
  },
  subheadline: {
    fontSize: 14,
    color: 'rgba(226, 232, 240, 0.8)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.borderLight,
  },
  progressDotActive: {
    backgroundColor: Colors.light.primary,
  },
  contentScroll: {
    maxHeight: 420,
  },
  contentInner: {
    paddingBottom: 12,
  },
  stepSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 18,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
    letterSpacing: 0.5,
  },
  skillsRow: {
    gap: 16,
    paddingVertical: 8,
    paddingRight: 24,
  },
  skillCard: {
    width: 200,
    borderRadius: 20,
    overflow: 'hidden',
  },
  skillCardActive: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 22,
    elevation: 8,
  },
  skillCardGradient: {
    padding: 16,
    gap: 12,
  },
  skillCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skillCardLevel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#60A5FA',
  },
  skillCardLevelActive: {
    color: '#0B1220',
  },
  skillCardTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#E2E8F0',
    lineHeight: 20,
  },
  skillCardTitleActive: {
    color: '#0B1220',
  },
  skillSummary: {
    backgroundColor: Colors.light.backgroundTertiary,
    borderRadius: 16,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  skillSummaryTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  skillSummaryText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 12,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.background,
  },
  timeChipActive: {
    backgroundColor: Colors.light.primary,
  },
  timeChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  timeChipTextActive: {
    color: '#0B1220',
  },
  selectedPreview: {
    gap: 12,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  selectedText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  locationRow: {
    gap: 12,
    paddingVertical: 8,
    paddingRight: 24,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.background,
  },
  locationChipActive: {
    backgroundColor: Colors.light.primary,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  locationTextActive: {
    color: '#0B1220',
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: Colors.light.text,
  },
  messageInput: {
    minHeight: 120,
    textAlignVertical: 'top' as const,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderRadius: 16,
    marginHorizontal: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  errorText: {
    fontSize: 13,
    color: '#F87171',
  },
  primaryButton: {
    margin: 24,
    borderRadius: 18,
    overflow: 'hidden',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#0B1220',
  },
  creditsCostCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 12,
  },
  creditsCostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  creditsCostIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditsCostInfo: {
    flex: 1,
  },
  creditsCostTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#92400E',
    marginBottom: 2,
  },
  creditsCostValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#78350F',
  },
  creditsFreeText: {
    color: '#15803D',
  },
  creditsWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 10,
  },
  creditsWarningText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  creditsBalance: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  creditsBalanceLabel: {
    fontSize: 13,
    color: '#92400E',
  },
  creditsBalanceValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#78350F',
  },
  // Swap type selector
  typeOptions: {
    gap: 12,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.light.backgroundTertiary,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.light.borderLight,
  },
  typeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeCardContent: {
    flex: 1,
  },
  typeCardTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 2,
  },
  typeCardSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  typeCheckCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeCostHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.light.backgroundTertiary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  typeCostText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  // Role badge
  roleBanner: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 6,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  roleDescription: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  subHeadingLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 8,
    marginTop: 4,
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
  calModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calModalCard: {
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
  calModalTopBar: {
    height: 6,
    width: '100%',
  },
  calModalCloseBtn: {
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
  calModalIconBox: {
    alignItems: 'center',
    marginTop: 24,
  },
  calModalIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FDE68A',
  },
  calModalTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.light.text,
    textAlign: 'center',
    marginTop: 14,
  },
  calModalDesc: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 6,
    lineHeight: 20,
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
  calModalActions: {
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
