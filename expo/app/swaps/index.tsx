import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Sparkles, CalendarDays, MessageCircle, Timer, ArrowRight } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { useSkillSwaps } from '../../providers/skill-swaps';
import { useCurrentUser } from '../../providers/current-user';
import { getSkillsWithUsers } from '../../mocks/data';
import type { SkillWithUser, SkillSwapRequest, SkillSwapStatus } from '../../types';

const statusPalette: Record<SkillSwapStatus | 'fallback', { bg: string; text: string }> = {
  pending: { bg: 'rgba(249, 115, 22, 0.15)', text: '#EA580C' },
  negotiating: { bg: 'rgba(59, 130, 246, 0.18)', text: '#2563EB' },
  scheduled: { bg: 'rgba(16, 185, 129, 0.18)', text: '#059669' },
  declined: { bg: 'rgba(248, 113, 113, 0.18)', text: '#DC2626' },
  completed: { bg: 'rgba(139, 92, 246, 0.18)', text: '#7C3AED' },
  fallback: { bg: 'rgba(148, 163, 184, 0.18)', text: '#475569' },
};

const filters = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Waiting' },
  { key: 'negotiating', label: 'Negotiating' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'completed', label: 'Completed' },
];

type FilterKey = (typeof filters)[number]['key'];

const buildStatusBadge = (status: SkillSwapStatus | string) => {
  const palette = statusPalette[status as SkillSwapStatus] ?? statusPalette.fallback;
  return {
    backgroundColor: palette.bg,
    color: palette.text,
  };
};

const buildSkillsLookup = (skills: SkillWithUser[]) => {
  const map = new Map<string, SkillWithUser>();
  skills.forEach((skill) => {
    map.set(skill.id, skill);
  });
  return map;
};

export default function SwapsIndexScreen() {
  const router = useRouter();
  const { swaps, pendingSwaps, negotiatingSwaps, scheduledSwaps, completedSwaps } = useSkillSwaps();
  const { currentUser, allUsers } = useCurrentUser();
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('all');
  const allSkills = useMemo<SkillWithUser[]>(() => getSkillsWithUsers(), []);
  const skillsMap = useMemo(() => buildSkillsLookup(allSkills), [allSkills]);

  const metrics = useMemo(() => {
    return [
      {
        label: 'Scheduled',
        value: scheduledSwaps.length,
        icon: <CalendarDays size={18} color="#0F172A" />,
        gradient: ['#34D399', '#10B981'] as const,
      },
      {
        label: 'Negotiating',
        value: negotiatingSwaps.length,
        icon: <MessageCircle size={18} color="#0F172A" />,
        gradient: ['#60A5FA', '#2563EB'] as const,
      },
      {
        label: 'Pending',
        value: pendingSwaps.length,
        icon: <Timer size={18} color="#0F172A" />,
        gradient: ['#FBBF24', '#F59E0B'] as const,
      },
    ];
  }, [negotiatingSwaps.length, pendingSwaps.length, scheduledSwaps.length]);

  const filteredSwaps = useMemo<SkillSwapRequest[]>(() => {
    if (selectedFilter === 'all') {
      return swaps;
    }
    return swaps.filter((swap) => swap.status === selectedFilter);
  }, [selectedFilter, swaps]);

  const handleNavigateToDetail = useCallback((swapId: string) => {
    router.push(`/swaps/${swapId}` as never);
  }, [router]);

  const renderSwapCard = useCallback((swap: SkillSwapRequest) => {
    const isRequester = swap.requesterId === currentUser.id;
    const partnerId = isRequester ? swap.recipientId : swap.requesterId;
    const partner = allUsers.find((user) => user.id === partnerId);
    const partnerSkill = skillsMap.get(isRequester ? swap.recipientSkillId : swap.requesterSkillId);
    const offeredSkill = skillsMap.get(isRequester ? swap.requesterSkillId : swap.recipientSkillId);
    const nextAction = (() => {
      if (swap.status === 'pending') {
        return 'Awaiting confirmation';
      }
      if (swap.status === 'negotiating') {
        return 'Align on time & location';
      }
      if (swap.status === 'scheduled') {
        return 'Prepare for your session';
      }
      if (swap.status === 'completed') {
        return 'Share feedback & reviews';
      }
      if (swap.status === 'declined') {
        return 'Swap closed';
      }
      return 'Stay in touch';
    })();
    const statusBadge = buildStatusBadge(swap.status);
    const upcomingSlot = (() => {
      const accepted = swap.acceptedTimeId
        ? swap.proposedTimes.find((slot) => slot.id === swap.acceptedTimeId)
        : undefined;
      const pending = swap.proposedTimes.find((slot) => slot.status === 'pending');
      const slot = accepted ?? pending ?? null;
      if (!slot) {
        return null;
      }
      return new Date(slot.startISO).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    })();

    return (
      <TouchableOpacity
        key={swap.id}
        style={styles.swapCard}
        onPress={() => handleNavigateToDetail(swap.id)}
        activeOpacity={0.85}
        testID={`swap-card-${swap.id}`}
      >
        <View style={styles.swapHeader}>
          <View style={styles.swapPartnerRow}>
            {partner?.avatarUrl ? (
              <Image source={{ uri: partner.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Sparkles size={16} color="#E0F2FE" />
              </View>
            )}
            <View style={styles.partnerInfo}>
              <Text style={styles.partnerName}>{partner?.name ?? 'Skill Partner'}</Text>
              <Text style={styles.partnerSubtitle}>{nextAction}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBadge.backgroundColor }]}
            testID={`swap-status-${swap.id}`}
          >
            <Text style={[styles.statusText, { color: statusBadge.color }]}>{swap.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.skillsRow}>
          <View style={styles.skillColumn}>
            <Text style={styles.skillLabel}>{isRequester ? 'You share' : 'They share'}</Text>
            <Text style={styles.skillTitle} numberOfLines={1}>{offeredSkill?.title ?? 'Skill TBD'}</Text>
          </View>
          <ArrowRight size={18} color={Colors.light.primary} />
          <View style={styles.skillColumn}>
            <Text style={styles.skillLabel}>{isRequester ? 'You learn' : 'They learn'}</Text>
            <Text style={styles.skillTitle} numberOfLines={1}>{partnerSkill?.title ?? 'Skill TBD'}</Text>
          </View>
        </View>

        <View style={styles.swapFooterRow}>
          <View style={styles.timelineRow}>
            {upcomingSlot ? (
              <Text style={styles.timelineText}>{upcomingSlot}</Text>
            ) : (
              <Text style={styles.timelineText}>Choose a time together</Text>
            )}
            {swap.locationPreference && (
              <Text style={styles.locationText}>{swap.locationPreference}</Text>
            )}
          </View>
          <View style={styles.cardChevron}>
            <ArrowRight size={20} color={Colors.light.textSecondary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [allUsers, currentUser.id, handleNavigateToDetail, skillsMap]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#312E81', '#1E1B4B']} style={styles.heroPanel}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroTitle}>Skill Swap Hub</Text>
            <Text style={styles.heroSubtitle}>Track negotiations, confirm sessions, and keep progress flowing.</Text>
          </View>
          <View style={styles.metricsRow}>
            {metrics.map((metric) => (
              <LinearGradient
                key={metric.label}
                colors={metric.gradient}
                style={styles.metricCard}
              >
                <View style={styles.metricIcon}>{metric.icon}</View>
                <Text style={styles.metricValue}>{metric.value}</Text>
                <Text style={styles.metricLabel}>{metric.label}</Text>
              </LinearGradient>
            ))}
          </View>
        </LinearGradient>

        <View style={styles.filterRow}>
          {filters.map((filter) => {
            const isActive = selectedFilter === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                onPress={() => setSelectedFilter(filter.key)}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                activeOpacity={0.85}
                testID={`swap-filter-${filter.key}`}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{filter.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.listSection}>
          {filteredSwaps.length === 0 ? (
            <View style={styles.emptyState} testID="swap-empty-state">
              <Sparkles size={28} color={Colors.light.primary} />
              <Text style={styles.emptyTitle}>No swaps here yet</Text>
              <Text style={styles.emptySubtitle}>Start a new request from any skill to see it appear in this hub.</Text>
            </View>
          ) : (
            filteredSwaps.map(renderSwapCard)
          )}
        </View>
      </ScrollView>
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
  heroPanel: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 26,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroHeader: {
    gap: 8,
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#F8FAFC',
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(226, 232, 240, 0.82)',
    lineHeight: 22,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  metricCard: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    gap: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#0F172A',
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: 'rgba(15, 23, 42, 0.8)',
  },
  filterRow: {
    marginTop: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  filterChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 60,
    gap: 16,
  },
  swapCard: {
    backgroundColor: Colors.light.background,
    borderRadius: 20,
    padding: 18,
    gap: 16,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  swapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  swapPartnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(191, 219, 254, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerInfo: {
    gap: 4,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  partnerSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.6,
  },
  skillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 16,
    padding: 14,
  },
  skillColumn: {
    flex: 1,
    gap: 4,
  },
  skillLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '600' as const,
  },
  skillTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  swapFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineRow: {
    flex: 1,
    gap: 6,
  },
  timelineText: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: '600' as const,
  },
  locationText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  cardChevron: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 60,
    backgroundColor: Colors.light.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
});
