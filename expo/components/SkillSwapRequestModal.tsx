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

interface SkillSwapRequestModalProps { visible: boolean; skill: SkillWithUser; onClose: () => void; }
interface TimeOption { id: string; label: string; startISO: string; endISO: string; }

const formatTimeLabel = (startISO: string): string => new Date(startISO).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const buildTimeOptions = (): TimeOption[] => {
  const base = Date.now();
  return [
    { offsetHours: 6, durationMinutes: 60 }, { offsetHours: 24, durationMinutes: 60 },
    { offsetHours: 30, durationMinutes: 75 }, { offsetHours: 48, durationMinutes: 90 },
    { offsetHours: 72, durationMinutes: 60 },
  ].map((c) => {
    const start = new Date(base + c.offsetHours * 3600000);
    const end = new Date(start.getTime() + c.durationMinutes * 60000);
    return { id: `time-${c.offsetHours}-${c.durationMinutes}`, label: formatTimeLabel(start.toISOString()), startISO: start.toISOString(), endISO: end.toISOString() };
  });
};

const locationOptions = ['Virtual Studio Lounge', 'Creative Hive Cowork', 'Neighborhood Coffee Lab', 'Outdoor Park Meetup'];
const headlineGradient = ['#0F172A', '#1E293B'] as const;
const stepTitles = ['Choose your trade', 'Pick session slots', 'Wrap-up details'];

export default function SkillSwapRequestModal({ visible, skill, onClose }: SkillSwapRequestModalProps) {
  const router = useRouter();
  const { currentUser } = useCurrentUser();
  const { createSwapRequest } = useSkillSwaps();
  const [step, setStep] = useState<number>(0);
  const [selectedSkillId, setSelectedSkillId] = useState<string>(currentUser.skillsOffered[0]?.id ?? '');
  const [selectedTimes, setSelectedTimes] = useState<TimeOption[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('Virtual Studio Lounge');
  const [customLocation, setCustomLocation] = useState<string>('');
  const [introMessage, setIntroMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const swapCost = currentUser.premiumTier === 'free' ? 5 : 0;
  const hasEnoughCredits = currentUser.credits >= swapCost;
  type SwapPayload = Parameters<typeof createSwapRequest>[0];

  const { mutateAsync: submitSwapRequest, reset: resetSwapMutation, isPending: isSubmitting } = useMutation<SkillSwapRequest, unknown, SwapPayload>({
    mutationFn: async (payload) => createSwapRequest(payload),
  });

  useEffect(() => {
    if (visible) { setStep(0); setSelectedSkillId(currentUser.skillsOffered[0]?.id ?? ''); setSelectedTimes([]); setSelectedLocation('Virtual Studio Lounge'); setCustomLocation(''); setIntroMessage(''); setError(null); resetSwapMutation(); }
  }, [visible, currentUser.skillsOffered, resetSwapMutation]);

  const timeOptions = useMemo<TimeOption[]>(() => buildTimeOptions(), []);
  const mergedLocation = useMemo<string>(() => customLocation.trim().length > 0 ? customLocation.trim() : selectedLocation, [customLocation, selectedLocation]);
  const canAdvance = useMemo<boolean>(() => {
    if (step === 0) return selectedSkillId.trim().length > 0;
    if (step === 1) return selectedTimes.length > 0;
    if (step === 2) return mergedLocation.trim().length > 0;
    return false;
  }, [mergedLocation, selectedSkillId, selectedTimes.length, step]);

  const handleSelectTime = useCallback((option: TimeOption) => {
    setSelectedTimes((prev) => {
      const exists = prev.some((i) => i.id === option.id);
      if (exists) return prev.filter((i) => i.id !== option.id);
      if (prev.length >= 3) return [...prev.slice(1), option];
      return [...prev, option];
    });
  }, []);

  const handleContinue = useCallback(() => {
    if (!canAdvance || isSubmitting) { if (!canAdvance) setError('Complete this step to move forward.'); return; }
    setError(null);
    if (step < 2) { setStep((p) => p + 1); return; }
    const submit = async () => {
      if (!hasEnoughCredits && swapCost > 0) { setError(`You need ${swapCost - currentUser.credits} more credits.`); return; }
      try {
        const createdSwap = await submitSwapRequest({
          recipientId: skill.user.id, recipientSkillId: skill.id, requesterSkillId: selectedSkillId,
          proposedTimes: selectedTimes.map((s) => ({ startISO: s.startISO, endISO: s.endISO })),
          locationPreference: mergedLocation, message: introMessage.trim().length > 0 ? introMessage : undefined,
        });
        onClose();
        router.push(`/swaps/${createdSwap.id}` as never);
      } catch (e) { console.log('[SkillSwap] Failed', e); setError('Unable to create the request. Try again.'); }
    };
    void submit();
  }, [canAdvance, introMessage, isSubmitting, mergedLocation, onClose, router, selectedSkillId, selectedTimes, skill.id, skill.user.id, step, submitSwapRequest]);

  const activeSkill = useMemo(() => currentUser.skillsOffered.find((c) => c.id === selectedSkillId) ?? null, [currentUser.skillsOffered, selectedSkillId]);

  return (
    <Modal visible={visible} animationType={Platform.OS === 'web' ? 'fade' : 'slide'} transparent onRequestClose={onClose}>
      <View style={st.backdrop}>
        <View style={st.modalCard}>
          <LinearGradient colors={headlineGradient} style={st.header}>
            <View>
              <Text style={st.headline}>Propose a swap with {skill.user.name.split(' ')[0]}</Text>
              <Text style={st.subheadline}>{stepTitles[step]}</Text>
            </View>
            <Pressable onPress={onClose} style={st.closeButton} testID="close-swap-modal"><X size={20} color="#E2E8F0" /></Pressable>
          </LinearGradient>
          <View style={st.progressRow}>
            {stepTitles.map((title, i) => <View key={title} style={[st.progressDot, (i === step || i < step) && st.progressDotActive]} />)}
          </View>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
            <View>
              {step === 0 && (
                <View style={st.stepSection}>
                  <Text style={st.sectionLabel}>You will teach</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingVertical: 8, paddingRight: 24 }}>
                    {currentUser.skillsOffered.map((s) => {
                      const isActive = s.id === selectedSkillId;
                      return (
                        <Pressable key={s.id} onPress={() => setSelectedSkillId(s.id)} style={[st.skillCard, isActive && st.skillCardActive]} testID={`offer-skill-${s.id}`}>
                          <LinearGradient colors={isActive ? ['#38BDF8', '#6366F1'] : ['#1E293B', '#0F172A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16, gap: 12 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Sparkles size={16} color={isActive ? '#0B1220' : '#3B82F6'} />
                              <Text style={{ fontSize: 11, fontWeight: '700' as const, color: isActive ? '#0B1220' : '#60A5FA' }}>{s.level}</Text>
                            </View>
                            <Text style={{ fontSize: 15, fontWeight: '700' as const, color: isActive ? '#0B1220' : '#E2E8F0', lineHeight: 20 }} numberOfLines={2}>{s.title}</Text>
                          </LinearGradient>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  {activeSkill && (
                    <View style={st.skillSummary}>
                      <Text style={{ fontSize: 16, fontWeight: '700' as const, color: Colors.light.text }}>{activeSkill.title}</Text>
                      <Text style={{ fontSize: 13, color: Colors.light.textSecondary, lineHeight: 20 }}>{activeSkill.description.slice(0, 140)}{activeSkill.description.length > 140 ? '…' : ''}</Text>
                    </View>
                  )}
                </View>
              )}
              {step === 1 && (
                <View style={st.stepSection}>
                  <Text style={st.sectionLabel}>Suggest up to 3 slots</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' as const, gap: 12 }}>
                    {timeOptions.map((option) => {
                      const sel = selectedTimes.some((i) => i.id === option.id);
                      return (
                        <Pressable key={option.id} onPress={() => handleSelectTime(option)} style={[st.chip, sel && st.chipActive]} testID={`swap-time-${option.id}`}>
                          <Clock size={16} color={sel ? '#0B1220' : Colors.light.primary} />
                          <Text style={[st.chipText, sel && st.chipTextActive]}>{option.label}</Text>
                          {sel && <Check size={16} color="#0B1220" />}
                        </Pressable>
                      );
                    })}
                  </View>
                  {selectedTimes.length > 0 && (
                    <View style={{ gap: 12 }}>
                      <Text style={st.sectionLabel}>Selected</Text>
                      {selectedTimes.map((slot) => (
                        <View key={`preview-${slot.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                          <CalendarCheck2 size={16} color={Colors.light.primary} /><Text style={{ fontSize: 14, color: Colors.light.text }}>{formatTimeLabel(slot.startISO)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
              {step === 2 && (
                <View style={st.stepSection}>
                  <View style={st.creditsCostCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}><Coins size={20} color="#F59E0B" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600' as const, color: '#92400E', marginBottom: 2 }}>Swap Request Cost</Text>
                        <Text style={{ fontSize: 18, fontWeight: '700' as const, color: '#78350F' }}>{swapCost === 0 ? <Text style={{ color: '#15803D' }}>Free with Premium</Text> : `${swapCost} Credits`}</Text>
                      </View>
                    </View>
                    {!hasEnoughCredits && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', padding: 10, borderRadius: 10 }}>
                        <AlertTriangle size={16} color="#F59E0B" /><Text style={{ fontSize: 13, fontWeight: '600' as const, color: '#92400E' }}>You need {swapCost - currentUser.credits} more credits</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#FDE68A' }}>
                      <Text style={{ fontSize: 13, color: '#92400E' }}>Your Balance:</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700' as const, color: '#78350F' }}>{currentUser.credits} Credits</Text>
                    </View>
                  </View>
                  <Text style={st.sectionLabel}>Location & intro note</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 8, paddingRight: 24 }}>
                    {locationOptions.map((loc) => {
                      const isActive = loc === selectedLocation && customLocation.trim().length === 0;
                      return (
                        <Pressable key={loc} onPress={() => { setSelectedLocation(loc); setCustomLocation(''); }} style={[st.chip, isActive && st.chipActive]} testID={`location-option-${loc}`}>
                          <MapPin size={16} color={isActive ? '#0B1220' : Colors.light.primary} />
                          <Text style={[st.chipText, isActive && st.chipTextActive]}>{loc}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <View style={{ gap: 8 }}>
                    <Text style={st.inputLabel}>Custom location</Text>
                    <TextInput style={st.input} placeholder="Add a venue or video call link" value={customLocation} onChangeText={setCustomLocation} placeholderTextColor="rgba(148,163,184,0.7)" testID="custom-location-input" />
                  </View>
                  <View style={{ gap: 8 }}>
                    <Text style={st.inputLabel}>Add a warm intro</Text>
                    <TextInput style={[st.input, { minHeight: 120, textAlignVertical: 'top' as const }]} placeholder="Share context, goals, or what excites you" value={introMessage} onChangeText={setIntroMessage} multiline numberOfLines={4} placeholderTextColor="rgba(148,163,184,0.7)" testID="intro-message-input" />
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
          {error && (
            <View style={st.errorBanner}><AlertTriangle size={18} color="#F87171" /><Text style={{ fontSize: 13, color: '#F87171' }}>{error}</Text></View>
          )}
          <Pressable onPress={handleContinue} style={[st.primaryButton, (!canAdvance || isSubmitting) && { opacity: 0.7 }]} testID={step < 2 ? 'swap-continue-button' : 'swap-submit-button'} disabled={!canAdvance || isSubmitting}>
            <LinearGradient colors={canAdvance && !isSubmitting ? ['#22D3EE', '#6366F1'] : ['#1E293B', '#1E293B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }}>
              <Text style={{ fontSize: 16, fontWeight: '700' as const, color: '#0B1220' }}>{isSubmitting ? 'Sending…' : step < 2 ? 'Continue' : 'Send Request'}</Text>
              {isSubmitting ? <ActivityIndicator size="small" color="#0B1220" /> : <ArrowRight size={18} color="#0B1220" />}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.72)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 28, backgroundColor: Colors.light.background, overflow: 'hidden' },
  header: { padding: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headline: { fontSize: 20, fontWeight: '700' as const, color: '#F8FAFC', marginBottom: 6 },
  subheadline: { fontSize: 14, color: 'rgba(226,232,240,0.8)' },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(15,23,42,0.6)', alignItems: 'center', justifyContent: 'center' },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.light.borderLight },
  progressDotActive: { backgroundColor: Colors.light.primary },
  stepSection: { paddingHorizontal: 24, paddingBottom: 24, gap: 18 },
  sectionLabel: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.text, letterSpacing: 0.5 },
  skillCard: { width: 200, borderRadius: 20, overflow: 'hidden' },
  skillCardActive: { shadowColor: '#38BDF8', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 22, elevation: 8 },
  skillSummary: { backgroundColor: Colors.light.backgroundTertiary, borderRadius: 16, padding: 16, gap: 6, borderWidth: 1, borderColor: Colors.light.borderLight },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: Colors.light.primary, backgroundColor: Colors.light.background },
  chipActive: { backgroundColor: Colors.light.primary },
  chipText: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.primary },
  chipTextActive: { color: '#0B1220' },
  creditsCostCard: { backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FDE68A', gap: 12 },
  inputLabel: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.textSecondary },
  input: { borderRadius: 16, borderWidth: 1, borderColor: Colors.light.borderLight, backgroundColor: Colors.light.background, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: Colors.light.text },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(248,113,113,0.12)', borderRadius: 16, marginHorizontal: 24, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(248,113,113,0.35)' },
  primaryButton: { margin: 24, borderRadius: 18, overflow: 'hidden' },
});
