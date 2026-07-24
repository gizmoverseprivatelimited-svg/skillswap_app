import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapPin, Clock, Check, X, Send, Sparkles, CalendarClock, PlusCircle, ArrowLeft, ShieldCheck, Video, Phone, CalendarPlus, Download } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { useSkillSwaps } from '../../providers/skill-swaps';
import { useCurrentUser } from '../../providers/current-user';
import { trpc } from '../../lib/trpc';
import { getSkillsWithUsers } from '../../mocks/data';
import type { SkillWithUser, SkillSwapStatus, SwapTimeProposal } from '../../types';
import { addSwapToCalendar, exportSwapToICalendar } from '../../lib/calendar';

type TimeSuggestion = { id: string; label: string; startISO: string; endISO: string };

const statusCopy: Record<SkillSwapStatus, { title: string; accent: string; description: string }> = {
  pending: { title: 'Waiting for confirmation', accent: '#F97316', description: 'Your invite is in their inbox.' },
  negotiating: { title: 'Crafting the exchange', accent: '#60A5FA', description: 'Both sides are fine-tuning the schedule.' },
  scheduled: { title: 'Session confirmed', accent: '#34D399', description: 'Everything is locked. Get ready!' },
  declined: { title: 'Swap declined', accent: '#F87171', description: 'This swap was declined.' },
  completed: { title: 'Swap completed', accent: '#A855F7', description: 'Share a review with your partner.' },
};

const buildTimeSuggestions = (): TimeSuggestion[] => {
  const now = Date.now();
  return [
    { offsetHours: 6, dur: 60 }, { offsetHours: 20, dur: 75 }, { offsetHours: 32, dur: 90 },
    { offsetHours: 54, dur: 60 }, { offsetHours: 80, dur: 120 },
  ].map((c) => {
    const start = new Date(now + c.offsetHours * 3600000);
    const end = new Date(start.getTime() + c.dur * 60000);
    return {
      id: `suggest-${c.offsetHours}-${c.dur}`,
      label: start.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    };
  });
};

const formatTimestamp = (ts: string) => new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const classifySlotStatus = (slot: SwapTimeProposal) => {
  if (slot.status === 'accepted') return { label: 'Locked in', color: '#34D399' };
  if (slot.status === 'declined') return { label: 'Declined', color: '#F87171' };
  return { label: 'Awaiting reply', color: '#60A5FA' };
};

export default function SwapDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { swaps, addMessage, addCounterProposal, acceptProposal, declineSwap, updateLocation, completeSwap, setCalendarEventId } = useSkillSwaps();
  const { currentUser, allUsers } = useCurrentUser();
  const sendMessageMutation = trpc.chat.sendMessage.useMutation();
  const [messageDraft, setMessageDraft] = useState<string>('');
  const [counterNotes, setCounterNotes] = useState<string>('');
  const [locationDraft, setLocationDraft] = useState<string>('');
  const [selectedSuggestions, setSelectedSuggestions] = useState<TimeSuggestion[]>([]);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState<boolean>(false);

  const swap = useMemo(() => id ? swaps.find((s) => s.id === id) : undefined, [swaps, id]);
  const allSkills = useMemo<SkillWithUser[]>(() => getSkillsWithUsers(), []);
  const skillsMap = useMemo(() => { const m = new Map<string, SkillWithUser>(); allSkills.forEach((s) => m.set(s.id, s)); return m; }, [allSkills]);
  const timeSuggestions = useMemo(() => buildTimeSuggestions(), []);

  const partner = useMemo(() => {
    if (!swap) return undefined;
    const pid = swap.requesterId === currentUser.id ? swap.recipientId : swap.requesterId;
    return allUsers.find((u) => u.id === pid);
  }, [allUsers, currentUser.id, swap]);

  const counterpartSkill = useMemo(() => {
    if (!swap) return undefined;
    const tid = swap.requesterId === currentUser.id ? swap.recipientSkillId : swap.requesterSkillId;
    return skillsMap.get(tid);
  }, [currentUser.id, skillsMap, swap]);

  const yourSkill = useMemo(() => {
    if (!swap) return undefined;
    const oid = swap.requesterId === currentUser.id ? swap.requesterSkillId : swap.recipientSkillId;
    return skillsMap.get(oid);
  }, [currentUser.id, skillsMap, swap]);

  const isRecipient = useMemo(() => swap ? swap.recipientId === currentUser.id : false, [swap, currentUser.id]);
  const headerCopy = useMemo(() => swap ? statusCopy[swap.status] : undefined, [swap]);
  const sortedNotes = useMemo(() => swap ? [...swap.negotiationNotes].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) : [], [swap]);

  useEffect(() => {
    if (swap?.locationPreference && locationDraft.length === 0) setLocationDraft(swap.locationPreference);
  }, [locationDraft.length, swap?.locationPreference]);

  const handleToggleSuggestion = useCallback((s: TimeSuggestion) => {
    setSelectedSuggestions((prev) => {
      const exists = prev.some((i) => i.id === s.id);
      if (exists) return prev.filter((i) => i.id !== s.id);
      if (prev.length >= 3) return [...prev.slice(1), s];
      return [...prev, s];
    });
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!swap || messageDraft.trim().length === 0) { setErrorBanner('Add a message before sending.'); return; }
    setErrorBanner(null);
    const trimmed = messageDraft.trim();
    addMessage({ requestId: swap.id, authorId: currentUser.id, body: trimmed });
    setMessageDraft('');
    try { await sendMessageMutation.mutateAsync({ swapId: swap.id, body: trimmed }); } catch (e) { console.error('[SwapDetail] Send failed:', e); }
  }, [addMessage, currentUser.id, messageDraft, swap, sendMessageMutation]);

  const handleSubmitCounter = useCallback(() => {
    if (!swap) return;
    if (selectedSuggestions.length === 0) { setErrorBanner('Select at least one time.'); return; }
    setErrorBanner(null);
    addCounterProposal({ requestId: swap.id, proposerId: currentUser.id, slots: selectedSuggestions.map((s) => ({ startISO: s.startISO, endISO: s.endISO })), message: counterNotes.trim().length > 0 ? counterNotes.trim() : undefined });
    setSelectedSuggestions([]); setCounterNotes('');
  }, [addCounterProposal, counterNotes, currentUser.id, selectedSuggestions, swap]);

  const handleAcceptSlot = useCallback((slotId: string) => { if (!swap) return; setErrorBanner(null); acceptProposal({ requestId: swap.id, timeId: slotId }); }, [acceptProposal, swap]);

  const handleAcceptSwap = useCallback(() => {
    if (!swap) return;
    const firstSlot = swap.proposedTimes.find((t) => t.status === 'pending');
    if (firstSlot) { acceptProposal({ requestId: swap.id, timeId: firstSlot.id }); }
    else { addCounterProposal({ requestId: swap.id, proposerId: currentUser.id, slots: [{ startISO: new Date(Date.now() + 86400000).toISOString(), endISO: new Date(Date.now() + 90000000).toISOString() }], message: 'Accepted! Let\'s finalize.' }); }
  }, [acceptProposal, addCounterProposal, currentUser.id, swap]);

  const handleDeclineSwap = useCallback(() => {
    if (!swap) return;
    declineSwap({ requestId: swap.id, note: counterNotes.trim().length > 0 ? counterNotes.trim() : undefined });
    setCounterNotes('');
  }, [counterNotes, declineSwap, swap]);

  const handleLocationUpdate = useCallback(() => {
    if (!swap) return;
    if (locationDraft.trim().length === 0) { setErrorBanner('Add a location.'); return; }
    setErrorBanner(null);
    updateLocation({ requestId: swap.id, location: locationDraft.trim() });
    setLocationDraft('');
  }, [locationDraft, swap, updateLocation]);

  const handleCompleteSwap = useCallback(() => { if (!swap) return; completeSwap(swap.id); }, [completeSwap, swap]);

  const handleAddToCalendar = useCallback(async () => {
    if (!swap || !swap.acceptedTimeId) { Alert.alert('Error', 'No confirmed time slot'); return; }
    const at = swap.proposedTimes.find((t) => t.id === swap.acceptedTimeId);
    if (!at) { Alert.alert('Error', 'Could not find time slot'); return; }
    setIsSyncingCalendar(true); setErrorBanner(null);
    try {
      const result = await addSwapToCalendar(swap, at, counterpartSkill?.title ?? 'Skill Swap', partner?.name ?? 'Partner');
      if (result.success && result.eventId) { setCalendarEventId(swap.id, result.eventId); Alert.alert('Success', 'Event added to your calendar.'); }
      else if (Platform.OS === 'web') { Alert.alert('Web', 'Use "Export iCal" instead.'); }
      else { Alert.alert('Error', result.error || 'Failed'); }
    } catch { Alert.alert('Error', 'Unexpected error'); } finally { setIsSyncingCalendar(false); }
  }, [swap, counterpartSkill, partner, setCalendarEventId]);

  const handleExportToICalendar = useCallback(async () => {
    if (!swap || !swap.acceptedTimeId) { Alert.alert('Error', 'No confirmed time slot'); return; }
    const at = swap.proposedTimes.find((t) => t.id === swap.acceptedTimeId);
    if (!at) { Alert.alert('Error', 'Could not find time slot'); return; }
    setIsSyncingCalendar(true); setErrorBanner(null);
    try {
      const result = await exportSwapToICalendar(swap, at, counterpartSkill?.title ?? 'Skill Swap', partner?.name ?? 'Partner');
      if (result.success) { Alert.alert('Export Complete', 'Open the file to add to calendar.'); }
      else { Alert.alert('Error', result.error || 'Failed'); }
    } catch { Alert.alert('Error', 'Unexpected error'); } finally { setIsSyncingCalendar(false); }
  }, [swap, counterpartSkill, partner]);

  if (!swap) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Swap not found</Text>
        <TouchableOpacity style={styles.emptyButton} onPress={() => router.back()} testID="swap-not-found-back">
          <Text style={styles.emptyButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#1F2937', '#111827']} style={styles.heroBanner}>
          <TouchableOpacity style={styles.backRow} onPress={() => router.back()} testID="swap-detail-back">
            <ArrowLeft size={20} color="#F8FAFC" /><Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={{ gap: 6 }}>
            <Text style={styles.heroTitle}>{partner?.name ?? 'Skill Partner'}</Text>
            <Text style={styles.heroSubtitle}>{headerCopy?.title}</Text>
            <Text style={styles.heroBody}>{headerCopy?.description}</Text>
          </View>
          <View style={[styles.heroBadge, { backgroundColor: headerCopy?.accent ?? '#38BDF8' }]}>
            <Text style={styles.heroBadgeText}>{swap.status.toUpperCase()}</Text>
          </View>
        </LinearGradient>

        {swap.status === 'pending' && isRecipient && (
          <View style={styles.section}>
            <View style={styles.acceptCard}>
              <Text style={styles.acceptTitle}>You received a swap request</Text>
              <Text style={styles.acceptDesc}>{partner?.name ?? 'Someone'} wants to exchange skills with you.</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                <TouchableOpacity style={styles.acceptBtn} onPress={handleAcceptSwap} activeOpacity={0.85} testID="accept-swap-request">
                  <Check size={18} color="#0B1220" /><Text style={styles.acceptBtnText}>Accept Swap</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.declineBtn} onPress={handleDeclineSwap} activeOpacity={0.85} testID="decline-swap-request">
                  <X size={18} color="#DC2626" /><Text style={styles.declineBtnText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {errorBanner && (
          <View style={styles.errorBanner} testID="swap-error">
            <X size={16} color="#F87171" /><Text style={styles.errorText}>{errorBanner}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.heading}>Exchange Overview</Text>
          <View style={styles.overviewCard}>
            <View style={{ flexDirection: 'row', gap: 18 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.overviewLabel}>You offer</Text>
                <Text style={styles.overviewValue}>{yourSkill?.title ?? 'Skill TBD'}</Text>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.overviewLabel}>{partner ? `${partner.name.split(' ')[0]} offers` : 'Partner offers'}</Text>
                <Text style={styles.overviewValue}>{counterpartSkill?.title ?? 'Skill TBD'}</Text>
              </View>
            </View>
            {swap.locationPreference && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MapPin size={16} color={Colors.light.primary} />
                <Text style={{ fontSize: 13, color: Colors.light.primary, fontWeight: '600' as const }}>{swap.locationPreference}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.heading}>Proposed time slots</Text>
            <CalendarClock size={18} color={Colors.light.primary} />
          </View>
          <View style={{ gap: 12 }}>
            {swap.proposedTimes.map((slot) => {
              const meta = classifySlotStatus(slot);
              return (
                <View key={slot.id} style={styles.slotCard} testID={`swap-slot-${slot.id}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <Clock size={18} color={meta.color} />
                    <View style={{ gap: 4 }}>
                      <Text style={styles.slotPrimary}>{formatTimestamp(slot.startISO)}</Text>
                      <Text style={[styles.slotSecondary, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </View>
                  {slot.status === 'pending' && (
                    <TouchableOpacity style={styles.slotAcceptBtn} onPress={() => handleAcceptSlot(slot.id)} activeOpacity={0.9} testID={`accept-slot-${slot.id}`}>
                      <Check size={16} color="#0B1220" /><Text style={{ fontSize: 13, fontWeight: '700' as const, color: '#0B1220' }}>Accept</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Suggest new times</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' as const, gap: 10 }}>
            {timeSuggestions.map((s) => {
              const active = selectedSuggestions.some((i) => i.id === s.id);
              return (
                <TouchableOpacity key={s.id} onPress={() => handleToggleSuggestion(s)} style={[styles.chip, active && styles.chipActive]} testID={`counter-suggestion-${s.id}`}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput style={styles.textArea} placeholder="Add context" value={counterNotes} onChangeText={setCounterNotes} multiline numberOfLines={3} placeholderTextColor="rgba(148,163,184,0.65)" testID="counter-notes-input" />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#38BDF8' }]} onPress={handleSubmitCounter} activeOpacity={0.9} testID="submit-counter-proposal">
              <PlusCircle size={18} color="#0B1220" /><Text style={styles.actionBtnText}>Send counter slots</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.declineBtnStyle]} onPress={handleDeclineSwap} activeOpacity={0.9} testID="decline-swap">
              <X size={18} color="#991B1B" /><Text style={{ fontSize: 14, fontWeight: '700' as const, color: '#991B1B' }}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Location</Text>
          <View style={styles.locationCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MapPin size={18} color={Colors.light.primary} />
              <Text style={{ fontSize: 14, fontWeight: '700' as const, color: Colors.light.text }}>Preferred space</Text>
            </View>
            <Text style={{ fontSize: 14, color: Colors.light.textSecondary }}>{swap.locationPreference ?? 'No location yet'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TextInput style={styles.locationInput} placeholder="Add or update meetup details" value={locationDraft} onChangeText={setLocationDraft} placeholderTextColor="rgba(148,163,184,0.65)" testID="location-input" />
              <TouchableOpacity style={styles.saveBtn} onPress={handleLocationUpdate} activeOpacity={0.9} testID="save-location">
                <Text style={{ fontSize: 13, fontWeight: '700' as const, color: '#FFFFFF' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.heading}>Negotiation thread</Text>
            <Sparkles size={18} color={Colors.light.primary} />
          </View>
          <View style={{ gap: 12 }}>
            {sortedNotes.map((note) => {
              const isSelf = note.authorId === currentUser.id;
              return (
                <View key={note.id} style={[styles.noteBubble, isSelf ? styles.noteSelf : styles.notePartner]} testID={`swap-note-${note.id}`}>
                  <Text style={styles.noteBody}>{note.body}</Text>
                  <Text style={styles.noteTimestamp}>{formatTimestamp(note.createdAt)}</Text>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <TextInput style={styles.messageInput} placeholder="Drop a note" value={messageDraft} onChangeText={setMessageDraft} placeholderTextColor="rgba(148,163,184,0.65)" testID="message-input" />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage} activeOpacity={0.9} disabled={sendMessageMutation.isPending} testID="send-message">
              {sendMessageMutation.isPending ? <Text style={{ color: '#0B1220', fontSize: 12, fontWeight: '600' as const }}>...</Text> : <Send size={18} color="#0B1220" />}
            </TouchableOpacity>
          </View>
        </View>

        {swap.status === 'scheduled' && (
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <TouchableOpacity style={[styles.calendarBtn, swap.calendarEventId && styles.calendarBtnAdded]} onPress={handleAddToCalendar} activeOpacity={0.9} disabled={isSyncingCalendar || !!swap.calendarEventId} testID="add-to-calendar">
                <CalendarPlus size={18} color={swap.calendarEventId ? '#10B981' : '#FFFFFF'} />
                <Text style={[styles.calendarBtnText, swap.calendarEventId && { color: '#10B981' }]}>{swap.calendarEventId ? 'Added' : isSyncingCalendar ? 'Syncing...' : 'Add to Calendar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.exportBtn} onPress={handleExportToICalendar} activeOpacity={0.9} disabled={isSyncingCalendar} testID="export-ical">
                <Download size={18} color="#3B82F6" /><Text style={{ fontSize: 14, fontWeight: '700' as const, color: '#3B82F6' }}>Export iCal</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={[styles.callBtn, { backgroundColor: '#8B5CF6' }]} onPress={() => router.push(`/call/${swap.id}` as any)} activeOpacity={0.9} testID="start-video-call">
                <Video size={20} color="#FFFFFF" /><Text style={styles.callBtnText}>Video Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.callBtn, { backgroundColor: '#10B981' }]} onPress={() => router.push(`/call/${swap.id}` as any)} activeOpacity={0.9} testID="start-voice-call">
                <Phone size={20} color="#FFFFFF" /><Text style={styles.callBtnText}>Voice Call</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#A855F7' }]} onPress={handleCompleteSwap} activeOpacity={0.9} testID="complete-swap">
              <ShieldCheck size={18} color="#0F172A" /><Text style={{ fontSize: 14, fontWeight: '700' as const, color: '#0F172A' }}>Mark swap as completed</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.backgroundSecondary },
  heroBanner: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, gap: 18, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { fontSize: 14, color: '#F8FAFC', fontWeight: '600' as const },
  heroTitle: { fontSize: 26, fontWeight: '800' as const, color: '#F8FAFC' },
  heroSubtitle: { fontSize: 16, color: 'rgba(191,219,254,0.9)', fontWeight: '600' as const },
  heroBody: { fontSize: 13, color: 'rgba(203,213,225,0.8)', lineHeight: 20 },
  heroBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  heroBadgeText: { fontSize: 11, fontWeight: '700' as const, color: '#0B1220', letterSpacing: 0.6 },
  errorBanner: { marginTop: 18, marginHorizontal: 20, padding: 12, borderRadius: 16, backgroundColor: 'rgba(248,113,113,0.12)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.35)', flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { fontSize: 13, color: '#F87171' },
  section: { marginTop: 24, paddingHorizontal: 20, gap: 16 },
  heading: { fontSize: 18, fontWeight: '700' as const, color: Colors.light.text },
  overviewCard: { backgroundColor: Colors.light.background, borderRadius: 18, padding: 18, gap: 16, borderWidth: 1, borderColor: Colors.light.borderLight },
  overviewLabel: { fontSize: 12, color: Colors.light.textSecondary, fontWeight: '600' as const },
  overviewValue: { fontSize: 16, fontWeight: '700' as const, color: Colors.light.text, lineHeight: 22 },
  slotCard: { backgroundColor: Colors.light.background, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.light.borderLight },
  slotPrimary: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.text },
  slotSecondary: { fontSize: 13, fontWeight: '600' as const },
  slotAcceptBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#34D399', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: Colors.light.background, borderWidth: 1, borderColor: Colors.light.borderLight },
  chipActive: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  chipText: { fontSize: 13, color: Colors.light.textSecondary, fontWeight: '600' as const },
  chipTextActive: { color: '#FFFFFF' },
  textArea: { borderRadius: 16, borderWidth: 1, borderColor: Colors.light.borderLight, backgroundColor: Colors.light.background, padding: 16, minHeight: 96, fontSize: 14, color: Colors.light.text, textAlignVertical: 'top' as const },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16 },
  actionBtnText: { fontSize: 14, fontWeight: '700' as const, color: '#0B1220' },
  declineBtnStyle: { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)' },
  locationCard: { backgroundColor: Colors.light.background, borderRadius: 18, padding: 18, gap: 14, borderWidth: 1, borderColor: Colors.light.borderLight },
  locationInput: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: Colors.light.borderLight, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.light.text, backgroundColor: Colors.light.backgroundSecondary },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, backgroundColor: Colors.light.primary },
  noteBubble: { borderRadius: 16, padding: 14, gap: 6 },
  noteSelf: { backgroundColor: 'rgba(59,130,246,0.15)', alignSelf: 'flex-end', borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)' },
  notePartner: { backgroundColor: Colors.light.background, alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.light.borderLight },
  noteBody: { fontSize: 14, color: Colors.light.text, lineHeight: 20 },
  noteTimestamp: { fontSize: 12, color: Colors.light.textSecondary },
  messageInput: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: Colors.light.borderLight, backgroundColor: Colors.light.background, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: Colors.light.text },
  sendBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#38BDF8', alignItems: 'center', justifyContent: 'center' },
  calendarBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, backgroundColor: '#6366F1' },
  calendarBtnAdded: { backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.35)' },
  calendarBtnText: { fontSize: 14, fontWeight: '700' as const, color: '#FFFFFF' },
  exportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(59,130,246,0.15)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.35)' },
  callBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16 },
  callBtnText: { fontSize: 14, fontWeight: '700' as const, color: '#FFFFFF' },
  acceptCard: { backgroundColor: 'rgba(52,211,153,0.08)', borderWidth: 1.5, borderColor: 'rgba(52,211,153,0.3)', borderRadius: 20, padding: 20, gap: 14 },
  acceptTitle: { fontSize: 17, fontWeight: '700' as const, color: Colors.light.text },
  acceptDesc: { fontSize: 14, color: Colors.light.textSecondary, lineHeight: 20 },
  acceptBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#34D399', paddingVertical: 14, borderRadius: 16 },
  acceptBtnText: { fontSize: 15, fontWeight: '700' as const, color: '#0B1220' },
  declineBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(220,38,38,0.1)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.3)', paddingVertical: 14, borderRadius: 16 },
  declineBtnText: { fontSize: 15, fontWeight: '700' as const, color: '#DC2626' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: Colors.light.background },
  emptyTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.light.text },
  emptyButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, backgroundColor: Colors.light.primary },
  emptyButtonText: { fontSize: 14, fontWeight: '700' as const, color: '#FFFFFF' },
});
