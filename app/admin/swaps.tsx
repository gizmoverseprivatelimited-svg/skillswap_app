import { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  ArrowLeftRight,
  Clock,
  CheckCircle2,
  XCircle,
  MessageCircle,
  CalendarDays,
  MapPin,
  Handshake,
} from 'lucide-react-native';
import { useSkillSwaps } from '@/providers/skill-swaps';
import { useCurrentUser } from '@/providers/current-user';
import type { SkillSwapStatus } from '@/types';
import Colors from '@/constants/colors';

type SwapFilter = 'all' | SkillSwapStatus;

export default function SwapOversight() {
  const { width: windowWidth } = useWindowDimensions();
  const isSmallScreen = windowWidth < 600;
  const styles = useMemo(() => createStyles(isSmallScreen), [isSmallScreen]);
  const { allSwaps, loading } = useSkillSwaps();
  const { allUsers } = useCurrentUser();
  const [filter, setFilter] = useState<SwapFilter>('all');

  const filteredSwaps = useMemo(() => {
    if (filter === 'all') return allSwaps;
    return allSwaps.filter(s => s.status === filter);
  }, [allSwaps, filter]);

  const getUserName = (userId: string) => {
    const user = allUsers.find(u => u.id == userId || (u as any)._id == userId);
    return user ? (user.username ? `@${user.username}` : user.name) : 'Unknown';
  };

  const getSkillTitle = (userId: string, skillId: string) => {
    // console.log(userId,skillId);
    
    const user = allUsers.find(u => u.id == userId || (u as any)._id == userId);
    console.log(user);
    return (user?.skillsOffered || []).find(s => s._id == skillId || s.id == skillId)?.title ?? 'Unknown Skill';
  };

  const getStatusConfig = (status: SkillSwapStatus) => {
    switch (status) {
      case 'pending': return { color: '#F59E0B', bg: '#FFFBEB', icon: Clock, label: 'Pending' };
      case 'negotiating': return { color: '#3B82F6', bg: '#EFF6FF', icon: MessageCircle, label: 'Negotiating' };
      case 'scheduled': return { color: '#8B5CF6', bg: '#F5F3FF', icon: CalendarDays, label: 'Scheduled' };
      case 'completed': return { color: '#10B981', bg: '#ECFDF5', icon: CheckCircle2, label: 'Completed' };
      case 'declined': return { color: '#EF4444', bg: '#FEF2F2', icon: XCircle, label: 'Declined' };
    }
  };

  const filters: { label: string; value: SwapFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Negotiating', value: 'negotiating' },
    { label: 'Scheduled', value: 'scheduled' },
    { label: 'Completed', value: 'completed' },
    { label: 'Declined', value: 'declined' },
  ];

  const swapStats = useMemo(() => ({
    total: allSwaps.length,
    active: allSwaps.filter(s => s.status === 'negotiating' || s.status === 'scheduled').length,
    completed: allSwaps.filter(s => s.status === 'completed').length,
  }), [allSwaps]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: 'Exchange Oversight', headerStyle: { backgroundColor: '#0F172A' }, headerTintColor: '#F8FAFC' }} />

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: '#EFF6FF' }]}>
          <Text style={[styles.summaryValue, { color: '#3B82F6' }]}>{swapStats.total}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#F5F3FF' }]}>
          <Text style={[styles.summaryValue, { color: '#8B5CF6' }]}>{swapStats.active}</Text>
          <Text style={styles.summaryLabel}>Active</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#ECFDF5' }]}>
          <Text style={[styles.summaryValue, { color: '#10B981' }]}>{swapStats.completed}</Text>
          <Text style={styles.summaryLabel}>Done</Text>
        </View>
      </View>

      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
          {filters.map(f => (
            <TouchableOpacity
              key={f.value}
              style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
              onPress={() => setFilter(f.value)}
            >
              <Text style={[styles.filterChipText, filter === f.value && styles.filterChipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {filteredSwaps.map(swap => {
          const config = getStatusConfig(swap.status);
          const StatusIcon = config.icon;
          return (
            <View key={swap.id} style={styles.swapCard}>
              <View style={styles.swapHeader}>
                <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                  <StatusIcon size={13} color={config.color} />
                  <Text style={[styles.statusLabel, { color: config.color }]}>{config.label}</Text>
                </View>
                <Text style={styles.swapDate}>
                  {new Date(swap.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
              </View>

              <View style={styles.participantsRow}>
                <View style={styles.participant}>
                  <Text style={styles.participantName}>{getUserName(swap.requesterId || "")}</Text>
                  <Text style={styles.participantSkill}>{getSkillTitle(swap.requesterId || "", swap.requesterSkillId)}</Text>
                </View>
                <View style={styles.swapIcon}>
                  <ArrowLeftRight size={16} color="#8B5CF6" />
                </View>
                <View style={[styles.participant, styles.participantRight]}>
                  <Text style={[styles.participantName, { textAlign: 'right' as const }]}>{getUserName(swap.recipientId)}</Text>
                  <Text style={[styles.participantSkill, { textAlign: 'right' as const }]}>{getSkillTitle(swap.recipientId, swap.recipientSkillId)}</Text>
                </View>
              </View>

              <View style={styles.detailsRow}>
                {swap.locationPreference && (
                  <View style={styles.detailItem}>
                    <MapPin size={12} color="#94A3B8" />
                    <Text style={styles.detailText}>{swap.locationPreference}</Text>
                  </View>
                )}
                <View style={styles.detailItem}>
                  <MessageCircle size={12} color="#94A3B8" />
                  <Text style={styles.detailText}>{swap.negotiationNotes.length} messages</Text>
                </View>
                <View style={styles.detailItem}>
                  <Clock size={12} color="#94A3B8" />
                  <Text style={styles.detailText}>{swap.proposedTimes.length} time slots</Text>
                </View>
              </View>
            </View>
          );
        })}

        {filteredSwaps.length === 0 && (
          <View style={styles.empty}>
            <Handshake size={40} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No exchanges found</Text>
            <Text style={styles.emptySubtitle}>Try a different filter</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (isSmallScreen: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: isSmallScreen ? 6 : 10,
    padding: isSmallScreen ? 12 : 16,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: isSmallScreen ? 10 : 14,
    borderRadius: isSmallScreen ? 10 : 14,
  },
  summaryValue: {
    fontSize: isSmallScreen ? 16 : 22,
    fontWeight: '800' as const,
  },
  summaryLabel: {
    fontSize: isSmallScreen ? 10 : 11,
    color: '#64748B',
    fontWeight: '600' as const,
    marginTop: 2,
  },
  filterWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingTop: isSmallScreen ? 8 : 12,
    paddingBottom: isSmallScreen ? 6 : 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterRow: {
    marginBottom: 4,
  },
  filterContent: {
    gap: isSmallScreen ? 6 : 8,
  },
  filterChip: {
    paddingHorizontal: isSmallScreen ? 10 : 14,
    paddingVertical: isSmallScreen ? 4 : 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: '#0F172A',
  },
  filterChipText: {
    fontSize: isSmallScreen ? 11.5 : 13,
    fontWeight: '600' as const,
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: isSmallScreen ? 12 : 16,
    gap: isSmallScreen ? 8 : 12,
    paddingBottom: isSmallScreen ? 24 : 40,
  },
  swapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: isSmallScreen ? 12 : 16,
    padding: isSmallScreen ? 12 : 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  swapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  swapDate: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500' as const,
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  participant: {
    flex: 1,
  },
  participantRight: {
    alignItems: 'flex-end',
  },
  participantName: {
    fontSize: isSmallScreen ? 13 : 14,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  participantSkill: {
    fontSize: isSmallScreen ? 11 : 12,
    color: '#64748B',
    marginTop: 2,
  },
  swapIcon: {
    width: isSmallScreen ? 30 : 36,
    height: isSmallScreen ? 30 : 36,
    borderRadius: isSmallScreen ? 15 : 18,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: isSmallScreen ? 6 : 10,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: isSmallScreen ? 8 : 12,
    paddingTop: isSmallScreen ? 8 : 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: isSmallScreen ? 11 : 12,
    color: '#94A3B8',
    fontWeight: '500' as const,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#64748B',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
});
