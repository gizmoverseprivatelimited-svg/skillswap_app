import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { ArrowLeftRight, Clock, CheckCircle2, XCircle, MessageCircle, CalendarDays, MapPin, Filter, Handshake } from 'lucide-react-native';
import { useSkillSwaps } from '@/providers/skill-swaps';
import { useCurrentUser } from '@/providers/current-user';
import type { SkillSwapStatus } from '@/types';

type SwapFilter = 'all' | SkillSwapStatus;

export default function SwapOversight() {
  const { swaps } = useSkillSwaps();
  const { allUsers } = useCurrentUser();
  const [filter, setFilter] = useState<SwapFilter>('all');

  const filteredSwaps = useMemo(() => filter === 'all' ? swaps : swaps.filter(s => s.status === filter), [swaps, filter]);
  const getUserName = (id: string) => allUsers.find(u => u.id === id)?.name ?? 'Unknown';
  const getSkillTitle = (userId: string, skillId: string) => allUsers.find(u => u.id === userId)?.skillsOffered.find(s => s.id === skillId)?.title ?? 'Unknown Skill';

  const statusConfig = (st: SkillSwapStatus) => {
    const map: Record<SkillSwapStatus, { color: string; bg: string; icon: typeof Clock; label: string }> = {
      pending: { color: '#F59E0B', bg: '#FFFBEB', icon: Clock, label: 'Pending' },
      negotiating: { color: '#3B82F6', bg: '#EFF6FF', icon: MessageCircle, label: 'Negotiating' },
      scheduled: { color: '#8B5CF6', bg: '#F5F3FF', icon: CalendarDays, label: 'Scheduled' },
      completed: { color: '#10B981', bg: '#ECFDF5', icon: CheckCircle2, label: 'Completed' },
      declined: { color: '#EF4444', bg: '#FEF2F2', icon: XCircle, label: 'Declined' },
    };
    return map[st];
  };

  const filters: { label: string; value: SwapFilter }[] = [
    { label: 'All', value: 'all' }, { label: 'Pending', value: 'pending' },
    { label: 'Negotiating', value: 'negotiating' }, { label: 'Scheduled', value: 'scheduled' },
    { label: 'Completed', value: 'completed' }, { label: 'Declined', value: 'declined' },
  ];

  const stats = useMemo(() => ({
    total: swaps.length,
    active: swaps.filter(s => s.status === 'negotiating' || s.status === 'scheduled').length,
    completed: swaps.filter(s => s.status === 'completed').length,
  }), [swaps]);

  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: 'Swap Oversight', headerStyle: { backgroundColor: '#0F172A' }, headerTintColor: '#F8FAFC' }} />
      <View style={{ flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 8, backgroundColor: '#FFF' }}>
        {[{ v: stats.total, l: 'Total', c: '#3B82F6', bg: '#EFF6FF' }, { v: stats.active, l: 'Active', c: '#8B5CF6', bg: '#F5F3FF' }, { v: stats.completed, l: 'Done', c: '#10B981', bg: '#ECFDF5' }].map(i => (
          <View key={i.l} style={[s.summaryCard, { backgroundColor: i.bg }]}>
            <Text style={[s.summaryValue, { color: i.c }]}>{i.v}</Text>
            <Text style={s.summaryLabel}>{i.l}</Text>
          </View>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap: 8 }}>
        {filters.map(f => (
          <TouchableOpacity key={f.value} style={[s.chip, filter === f.value && s.chipActive]} onPress={() => setFilter(f.value)}>
            <Text style={[s.chipText, filter === f.value && s.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {filteredSwaps.map(swap => {
          const cfg = statusConfig(swap.status);
          const StatusIcon = cfg.icon;
          return (
            <View key={swap.id} style={s.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                  <StatusIcon size={13} color={cfg.color} /><Text style={{ fontSize: 12, fontWeight: '700' as const, color: cfg.color }}>{cfg.label}</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#94A3B8' }}>{new Date(swap.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.participantName} numberOfLines={1}>{getUserName(swap.requesterId)}</Text>
                  <Text style={s.participantSkill} numberOfLines={1}>{getSkillTitle(swap.requesterId, swap.requesterSkillId)}</Text>
                </View>
                <View style={s.swapIcon}><ArrowLeftRight size={16} color="#8B5CF6" /></View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={[s.participantName, { textAlign: 'right' as const }]} numberOfLines={1}>{getUserName(swap.recipientId)}</Text>
                  <Text style={[s.participantSkill, { textAlign: 'right' as const }]} numberOfLines={1}>{getSkillTitle(swap.recipientId, swap.recipientSkillId)}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                {swap.locationPreference && <View style={s.detailItem}><MapPin size={12} color="#94A3B8" /><Text style={s.detailText} numberOfLines={1}>{swap.locationPreference}</Text></View>}
                <View style={s.detailItem}><MessageCircle size={12} color="#94A3B8" /><Text style={s.detailText}>{swap.negotiationNotes.length} msgs</Text></View>
                <View style={s.detailItem}><Clock size={12} color="#94A3B8" /><Text style={s.detailText}>{swap.proposedTimes.length} slots</Text></View>
              </View>
            </View>
          );
        })}
        {filteredSwaps.length === 0 && <View style={{ alignItems: 'center', paddingTop: 60, gap: 8 }}><Handshake size={40} color="#CBD5E1" /><Text style={{ fontSize: 16, fontWeight: '700' as const, color: '#64748B' }}>No swaps found</Text></View>}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  summaryCard: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14 },
  summaryValue: { fontSize: 22, fontWeight: '800' as const },
  summaryLabel: { fontSize: 11, color: '#64748B', fontWeight: '600' as const, marginTop: 2 },
  filterRow: { backgroundColor: '#FFF', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  chipActive: { backgroundColor: '#0F172A' },
  chipText: { fontSize: 13, fontWeight: '600' as const, color: '#64748B' },
  chipTextActive: { color: '#FFF' },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  participantName: { fontSize: 14, fontWeight: '700' as const, color: '#0F172A' },
  participantSkill: { fontSize: 12, color: '#64748B', marginTop: 2 },
  swapIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 12, color: '#94A3B8', fontWeight: '500' as const },
});
