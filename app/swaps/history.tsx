import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import {
  ArrowLeft,
  CalendarDays,
  MessageCircle,
  Timer,
  ArrowRight,
  GraduationCap,
  BookOpen,
  ArrowLeftRight,
  ExternalLink,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
} from 'lucide-react-native';
import Colors from '../../constants/colors';
import { useSkillSwaps } from '../../providers/skill-swaps';
import { useCurrentUser } from '../../providers/current-user';
import { getSkillsWithUsers } from '../../mocks/data';
import type { SkillWithUser, SkillSwapRequest, SkillSwapStatus } from '../../types';
import { resolveImageUrl } from '@/lib/resolveImageUrl';

const statusPalette: Record<SkillSwapStatus | 'fallback', { bg: string; text: string; border: string }> = {
  pending: { bg: 'rgba(249, 115, 22, 0.12)', text: '#EA580C', border: '#FDBA74' },
  negotiating: { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563EB', border: '#93C5FD' },
  scheduled: { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', border: '#6EE7B7' },
  completed: { bg: 'rgba(139, 92, 246, 0.12)', text: '#7C3AED', border: '#C4B5FD' },
  declined: { bg: 'rgba(248, 113, 113, 0.12)', text: '#DC2626', border: '#FCA5A5' },
  fallback: { bg: 'rgba(148, 163, 184, 0.12)', text: '#475569', border: '#CBD5E1' },
};

const filterTabs = [
  { key: 'all', label: 'All Exchanges' },
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'completed', label: 'Completed' },
  { key: 'declined', label: 'Declined' },
];

type FilterKey = (typeof filterTabs)[number]['key'];

const buildStatusBadge = (status: SkillSwapStatus | string) => {
  const palette = statusPalette[status as SkillSwapStatus] ?? statusPalette.fallback;
  return palette;
};

const buildSkillsLookup = (skills: SkillWithUser[]) => {
  const map = new Map<string, SkillWithUser>();
  skills.forEach((skill) => {
    map.set(skill.id, skill);
  });
  return map;
};

export default function SwapHistoryScreen() {
  const router = useRouter();
  const { swaps, loading } = useSkillSwaps();
  const { currentUser, allUsers } = useCurrentUser();
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('all');
  const [allSkills, setAllSkills] = useState<SkillWithUser[]>([]);
  const [isSkillsLoading, setIsSkillsLoading] = useState(true);

  useEffect(() => {
    async function loadSkills() {
      try {
        setIsSkillsLoading(true);
        const skills = await getSkillsWithUsers();
        setAllSkills(skills);
      } catch (err) {
        console.error('[SwapHistory] Failed to load skills:', err);
      } finally {
        setIsSkillsLoading(false);
      }
    }
    loadSkills();
  }, []);

  const skillsMap = useMemo(() => buildSkillsLookup(allSkills), [allSkills]);

  const filteredSwaps = useMemo<SkillSwapRequest[]>(() => {
    if (selectedFilter === 'all') {
      return swaps;
    }
    if (selectedFilter === 'ongoing') {
      return swaps.filter((s) => s.status === 'pending' || s.status === 'negotiating' || s.status === 'scheduled');
    }
    return swaps.filter((s) => s.status === selectedFilter);
  }, [selectedFilter, swaps]);

  const counts = useMemo(() => {
    const ongoingCount = swaps.filter((s) => s.status === 'pending' || s.status === 'negotiating' || s.status === 'scheduled').length;
    const completedCount = swaps.filter((s) => s.status === 'completed').length;
    const declinedCount = swaps.filter((s) => s.status === 'declined').length;
    return {
      all: swaps.length,
      ongoing: ongoingCount,
      completed: completedCount,
      declined: declinedCount,
    };
  }, [swaps]);

  const handleOpenThread = useCallback(
    (swapId: string) => {
      router.push(`/swaps/${swapId}` as never);
    },
    [router]
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Exchange History',
          headerStyle: { backgroundColor: Colors.light.background },
          headerTintColor: Colors.light.text,
          headerShadowVisible: false,
        }}
      />
      <View style={styles.container}>
        {/* Header Hero Banner */}
        <LinearGradient
          colors={['#0F172A', '#1E293B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroIconWrap}>
              <History size={24} color="#6366F1" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Exchange Activity Log</Text>
              <Text style={styles.heroSubtitle}>Track and view all your skill exchange sessions</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          {filterTabs.map((tab) => {
            const isActive = selectedFilter === tab.key;
            const count = counts[tab.key as keyof typeof counts] ?? 0;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setSelectedFilter(tab.key)}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                activeOpacity={0.8}
                testID={`history-filter-${tab.key}`}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {tab.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Swap Items List */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading || isSkillsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
          ) : filteredSwaps.length === 0 ? (
            <View style={styles.emptyContainer}>
              <History size={48} color={Colors.light.borderLight} />
              <Text style={styles.emptyTitle}>No exchanges found</Text>
              <Text style={styles.emptySubtitle}>
                {selectedFilter === 'all'
                  ? 'You have not initiated or received any skill exchanges yet.'
                  : `No ${selectedFilter} exchanges to show.`}
              </Text>
            </View>
          ) : (
            filteredSwaps.map((swap) => {
              const isRequester = swap.requesterId === currentUser?.id;
              const partnerId = isRequester ? swap.recipientId : swap.requesterId;
              const partner = allUsers.find((user) => user.id === partnerId);
              const partnerSkill = skillsMap.get(isRequester ? swap.recipientSkillId : swap.requesterSkillId);
              const offeredSkill = skillsMap.get(isRequester ? swap.requesterSkillId : swap.recipientSkillId);

              const swapType = swap.swapType || 'swap';
              const getRoleInfo = () => {
                if (swapType === 'learn') {
                  if (isRequester) {
                    return { myRole: 'Learner', myLabel: 'You learn', partnerLabel: 'They teach', color: '#6366F1', bg: '#EEF2FF', Icon: BookOpen };
                  }
                  return { myRole: 'Teacher', myLabel: 'You teach', partnerLabel: 'They learn', color: '#10B981', bg: '#ECFDF5', Icon: GraduationCap };
                }
                if (swapType === 'teach') {
                  if (isRequester) {
                    return { myRole: 'Teacher', myLabel: 'You teach', partnerLabel: 'They learn', color: '#10B981', bg: '#ECFDF5', Icon: GraduationCap };
                  }
                  return { myRole: 'Learner', myLabel: 'You learn', partnerLabel: 'They teach', color: '#6366F1', bg: '#EEF2FF', Icon: BookOpen };
                }
                return { myRole: 'Mutual Exchange', myLabel: 'You share', partnerLabel: 'You learn', color: '#F59E0B', bg: '#FFFBEB', Icon: ArrowLeftRight };
              };
              const roleInfo = getRoleInfo();
              const badgeStyle = buildStatusBadge(swap.status);

              const scheduledTime = (() => {
                const accepted = swap.acceptedTimeId
                  ? swap.proposedTimes.find((slot) => slot.id === swap.acceptedTimeId)
                  : undefined;
                const pending = swap.proposedTimes.find((slot) => slot.status === 'pending');
                const slot = accepted ?? pending ?? null;
                if (!slot) return null;
                return new Date(slot.startISO).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                });
              })();

              return (
                <View key={swap.id} style={styles.historyCard}>
                  {/* Top Bar: Partner & Status */}
                  <View style={styles.cardHeader}>
                    <View style={styles.partnerRow}>
                      <Image
                        source={{ uri: resolveImageUrl(partner?.avatarUrl) }}
                        style={styles.avatar}
                      />
                      <View style={styles.partnerDetails}>
                        <Text style={styles.partnerName}>
                          {partner?.username ? (partner.username.startsWith('@') ? partner.username : `@${partner.username}`) : (partner?.name ? `@${partner.name.toLowerCase().replace(/\s+/g, '')}` : 'Skill Partner')}
                        </Text>
                        <Text style={styles.swapDateText}>
                          Updated {new Date(swap.updatedAt || Date.now()).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: badgeStyle.bg, borderColor: badgeStyle.border }]}>
                      <Text style={[styles.statusText, { color: badgeStyle.text }]}>
                        {swap.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Role Indicator Banner */}
                  <View style={[styles.roleRow, { backgroundColor: roleInfo.bg, borderColor: roleInfo.color }]}>
                    <roleInfo.Icon size={14} color={roleInfo.color} />
                    <Text style={[styles.roleText, { color: roleInfo.color }]}>
                      {roleInfo.myRole === 'Mutual Swap' ? 'Mutual Skill Exchange' : `You are the ${roleInfo.myRole}`}
                    </Text>
                  </View>

                  {/* Skills Exchange Info */}
                  <View style={styles.skillsExchangeBox}>
                    <View style={styles.skillCol}>
                      <Text style={styles.skillColLabel}>{roleInfo.myLabel}</Text>
                      <Text style={styles.skillColTitle} numberOfLines={1}>
                        {swapType === 'swap'
                          ? (offeredSkill?.title ?? 'Skill TBD')
                          : swapType === 'learn'
                            ? (isRequester ? partnerSkill?.title : offeredSkill?.title) ?? 'Skill TBD'
                            : (isRequester ? offeredSkill?.title : partnerSkill?.title) ?? 'Skill TBD'}
                      </Text>
                    </View>
                    <ArrowRight size={16} color={roleInfo.color} />
                    <View style={styles.skillCol}>
                      <Text style={styles.skillColLabel}>{roleInfo.partnerLabel}</Text>
                      <Text style={styles.skillColTitle} numberOfLines={1}>
                        {swapType === 'swap'
                          ? (partnerSkill?.title ?? 'Skill TBD')
                          : swapType === 'learn'
                            ? (isRequester ? offeredSkill?.title || 'N/A' : partnerSkill?.title) ?? 'Skill TBD'
                            : (isRequester ? partnerSkill?.title || 'N/A' : offeredSkill?.title) ?? 'Skill TBD'}
                      </Text>
                    </View>
                  </View>

                  {/* Time / Location metadata if available */}
                  {(scheduledTime || swap.locationPreference) && (
                    <View style={styles.metaRow}>
                      {scheduledTime && (
                        <View style={styles.metaItem}>
                          <Clock size={14} color={Colors.light.textSecondary} />
                          <Text style={styles.metaText}>{scheduledTime}</Text>
                        </View>
                      )}
                      {swap.locationPreference && (
                        <View style={styles.metaItem}>
                          <MapPin size={14} color={Colors.light.textSecondary} />
                          <Text style={styles.metaText} numberOfLines={1}>{swap.locationPreference}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Action Button: Open Swap Thread */}
                  <TouchableOpacity
                    style={styles.openThreadBtn}
                    onPress={() => handleOpenThread(swap.id)}
                    activeOpacity={0.85}
                    testID={`open-thread-${swap.id}`}
                  >
                    <LinearGradient
                      colors={['#6366F1', '#4F46E5']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.openThreadGradient}
                    >
                      <MessageCircle size={16} color="#FFFFFF" />
                      <Text style={styles.openThreadText}>Open Swap Thread</Text>
                      <ArrowRight size={16} color="#FFFFFF" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  heroBanner: {
    padding: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#F8FAFC',
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(226, 232, 240, 0.75)',
    marginTop: 2,
  },
  filterScroll: {
    maxHeight: 56,
    paddingVertical: 10,
  },
  filterContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  filterChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
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
    maxWidth: 280,
  },
  historyCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.backgroundTertiary,
  },
  partnerDetails: {
    flex: 1,
  },
  partnerName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  swapDateText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  skillsExchangeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  skillCol: {
    flex: 1,
  },
  skillColLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  skillColTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  openThreadBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  openThreadGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  openThreadText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
