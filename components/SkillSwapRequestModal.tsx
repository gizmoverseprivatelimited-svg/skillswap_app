import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarCheck2, Clock, MapPin, Sparkles, X, ArrowRight, Check, AlertTriangle, Coins } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Colors from '../constants/colors';
import type { SkillSwapRequest, SkillWithUser } from '../types';
import { useCurrentUser } from '../providers/current-user';
import { useSkillSwaps } from '../providers/skill-swaps';

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
const stepTitles = ['Choose your trade', 'Pick session slots', 'Wrap-up details'];

export default function SkillSwapRequestModal({ visible, skill, onClose }: SkillSwapRequestModalProps) {
  const router = useRouter();
  const { currentUser } = useCurrentUser();
  const { createSwapRequest } = useSkillSwaps();
  const [step, setStep] = useState<number>(0);
  const [selectedSkillId, setSelectedSkillId] = useState<string>(currentUser?.skillsOffered[0]?._id ?? '');
  const [selectedTimes, setSelectedTimes] = useState<TimeOption[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('Virtual Studio Lounge');
  const [customLocation, setCustomLocation] = useState<string>('');
  const [introMessage, setIntroMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const swapCost = currentUser?.premiumTier === 'free' ? 5 : 0;
  const hasEnoughCredits = currentUser?.credits ? currentUser?.credits : 1 >= swapCost;

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

  useEffect(() => {
    if (visible) {
      setStep(0);
      setSelectedSkillId(currentUser?.skillsOffered[0]?._id ?? '');
      setSelectedTimes([]);
      setSelectedLocation('Virtual Studio Lounge');
      setCustomLocation('');
      setIntroMessage('');
      setError(null);
      resetSwapMutation();
    }
  }, [visible, currentUser?.skillsOffered, resetSwapMutation]);

  const timeOptions = useMemo<TimeOption[]>(() => {
    return buildTimeOptions();
  }, []);

  const mergedLocation = useMemo<string>(() => {
    if (customLocation?.trim().length > 0) {
      return customLocation?.trim();
    }
    return selectedLocation;
  }, [customLocation, selectedLocation]);

  const canAdvance = useMemo<boolean>(() => {
    if (step === 0) {
      console.log(selectedSkillId);
      return selectedSkillId?.trim().length > 0;
    }
    if (step === 1) {
      console.log(selectedTimes.length);
      return selectedTimes.length > 0;
    }
    if (step === 2) {
      console.log(mergedLocation?.trim().length);
      return mergedLocation?.trim().length > 0;
    }
    return false;
  }, [mergedLocation, selectedSkillId, selectedTimes.length, step]);

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
    if (step < 2) {
      setStep((previous) => previous + 1);
      return;
    }
    const payloadTimes = selectedTimes.map((slot) => {
      return { startISO: slot.startISO, endISO: slot.endISO };
    });
    const submit = async () => {
      if (!hasEnoughCredits && swapCost > 0) {
        setError(`You need ${swapCost - (currentUser?.credits || 0)} more credits to send this request.`);
        return;
      }
      try {
        console.log(skill);

        // const createdSwap = await submitSwapRequest({
        //   recipientId: skill.user.id,
        //   recipientSkillId: skill.id,
        //   requesterSkillId: selectedSkillId,
        //   proposedTimes: payloadTimes,
        //   locationPreference: mergedLocation,
        //   message: introMessage?.trim().length > 0 ? introMessage : undefined,
        // });

        const payload = {
          recipientId: skill.user.id,
          recipientSkillId: skill.id,
          requesterSkillId: selectedSkillId,
          proposedTimes: payloadTimes,
          locationPreference: mergedLocation,
          message: introMessage?.trim().length > 0 ? introMessage : undefined,
        };

        const createdSwap = await createSwapRequest(payload)
        // console.log(createdSwap);
        onClose();
        router.push(`/swaps/${createdSwap.id}` as never);
      } catch (swapError) {
        console.log('[SkillSwap] Failed to create request', swapError);
        setError('Unable to create the request. Try again.');
      }
    };
    void submit();
  }, [canAdvance, introMessage, isSubmitting, mergedLocation, onClose, router, selectedSkillId, selectedTimes, skill.id, skill.user.id, step, submitSwapRequest]);

  const activeSkill = useMemo(() => {
    return currentUser?.skillsOffered.find((candidate) => candidate._id === selectedSkillId) ?? null;
  }, [currentUser?.skillsOffered, selectedSkillId]);

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
            <View>
              <Text style={styles.headline}>Propose a swap with {skill.user.name.split(' ')[0]}</Text>
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

          <ScrollView
            style={styles.contentScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.contentInner}
          >
            <View>
              {step === 0 && (
                <View style={styles.stepSection}>
                  <Text style={styles.sectionLabel}>You will teach</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skillsRow}>
                    {currentUser?.skillsOffered.map((offeredSkill, i) => {
                      const isActive = offeredSkill._id === selectedSkillId;
                      return (
                        <Pressable
                          key={i}
                          onPress={() => {
                            return setSelectedSkillId(offeredSkill._id || '')
                          }}
                          style={[styles.skillCard, isActive && styles.skillCardActive]}
                          testID={`offer-skill-${offeredSkill._id}`}
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
                  {activeSkill && (
                    <View style={styles.skillSummary}>
                      <Text style={styles.skillSummaryTitle}>{activeSkill.title}</Text>
                      <Text style={styles.skillSummaryText}>
                        {activeSkill.description.slice(0, 140)}{activeSkill.description.length > 140 ? '…' : ''}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {step === 1 && (
                <View style={styles.stepSection}>
                  <Text style={styles.sectionLabel}>Suggest up to 3 slots</Text>
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
                  {selectedTimes.length > 0 && (
                    <View style={styles.selectedPreview}>
                      <Text style={styles.sectionLabel}>Selected</Text>
                      {selectedTimes.map((slot, i) => (
                        <View key={`preview-${i}`} style={styles.selectedRow}>
                          <CalendarCheck2 size={16} color={Colors.light.primary} />
                          <Text style={styles.selectedText}>{formatTimeLabel(slot.startISO)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {step === 2 && (
                <View style={styles.stepSection}>
                  <View style={styles.creditsCostCard}>
                    <View style={styles.creditsCostHeader}>
                      <View style={styles.creditsCostIcon}>
                        <Coins size={20} color="#F59E0B" />
                      </View>
                      <View style={styles.creditsCostInfo}>
                        <Text style={styles.creditsCostTitle}>Swap Request Cost</Text>
                        <Text style={styles.creditsCostValue}>
                          {swapCost === 0 ? (
                            <Text style={styles.creditsFreeText}>Free with Premium</Text>
                          ) : (
                            `${swapCost} Credits`
                          )}
                        </Text>
                      </View>
                    </View>
                    {!hasEnoughCredits && (
                      <View style={styles.creditsWarning}>
                        <AlertTriangle size={16} color="#F59E0B" />
                        <Text style={styles.creditsWarningText}>
                          You need {swapCost - (currentUser?.credits || 0)} more credits
                        </Text>
                      </View>
                    )}
                    <View style={styles.creditsBalance}>
                      <Text style={styles.creditsBalanceLabel}>Your Balance:</Text>
                      <Text style={styles.creditsBalanceValue}>{currentUser?.credits} Credits</Text>
                    </View>
                  </View>
                  <Text style={styles.sectionLabel}>Location & intro note</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.locationRow}>
                    {locationOptions.map((location, i) => {
                      const isActive = location === selectedLocation && customLocation?.trim().length === 0;
                      return (
                        <Pressable
                          key={i}
                          onPress={() => {
                            setSelectedLocation(location);
                            setCustomLocation('');
                          }}
                          style={[styles.locationChip, isActive && styles.locationChipActive]}
                          testID={`location-option-${location}`}
                        >
                          <MapPin size={16} color={isActive ? '#0B1220' : Colors.light.primary} />
                          <Text style={[styles.locationText, isActive && styles.locationTextActive]}>{location}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Custom location</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Add a venue or video call link"
                      value={customLocation}
                      onChangeText={setCustomLocation}
                      placeholderTextColor="rgba(148, 163, 184, 0.7)"
                      testID="custom-location-input"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Add a warm intro</Text>
                    <TextInput
                      style={[styles.input, styles.messageInput]}
                      placeholder="Share context, goals, or what excites you about this swap"
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
            testID={step < 2 ? 'swap-continue-button' : 'swap-submit-button'}
            disabled={!canAdvance || isSubmitting}
          >
            <LinearGradient
              colors={canAdvance && !isSubmitting ? ['#22D3EE', '#6366F1'] : ['#1E293B', '#1E293B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryGradient}
            >
              <Text style={styles.primaryText}>
                {isSubmitting ? 'Sending…' : step < 2 ? 'Continue' : 'Send Request'}
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
});
