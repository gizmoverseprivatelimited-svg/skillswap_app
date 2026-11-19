import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, Image, TextInput, RefreshControl, ScrollView, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, X, Calendar, Clock, Users, Coins, Sparkles, Video, CheckCircle2, Layers, RotateCcw } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeTopInset } from '@/lib/safeArea';
import Colors from '@/constants/colors';
import { categories as defaultCategories } from '@/mocks/data';
import { useClasses } from '@/providers/classes';
import { useCurrentUser } from '@/providers/current-user';
import { useSafety } from '@/providers/safety';
import type { ClassWithTeacher } from '@/types';
import { formatCredits, formatClassSchedule, formatBillingCycle } from '@/lib/payments';
import { resolveImageUrl } from '@/lib/resolveImageUrl';
import url from '@/constants/backurl';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800';
const DEFAULT_AVATAR = 'https://i.pravatar.cc/150?img=1';

function ClassCardItem({ item, router, isEnrolledUser, cardWidth, numColumns, isSmallScreen }: { item: ClassWithTeacher; router: any; isEnrolledUser: boolean; cardWidth?: any; numColumns?: number; isSmallScreen?: boolean }) {
  const seatsLeft = item.maxCapacity - item.enrolledCount;
  const fillPct = Math.round((item.enrolledCount / item.maxCapacity) * 100);
  const isFree = item.seatPriceCredits === 0;
  const isCancelled = item.status === 'cancelled';
  const isCompleted = item.status === 'completed';
  const isRecurring = item.sessionType && item.sessionType !== 'single';

  const [coverUrl, setCoverUrl] = useState(() => resolveImageUrl(item.coverImageUrl, DEFAULT_COVER) || DEFAULT_COVER);
  const [avatarUrl, setAvatarUrl] = useState(() => resolveImageUrl(item.teacher.avatarUrl, DEFAULT_AVATAR) || DEFAULT_AVATAR);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };
  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };
  const formatShortDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <View style={[s.card, isCancelled ? s.cardCancelled : null, isSmallScreen && s.cardMobile, Boolean(numColumns && numColumns > 1) ? { flex: 1, maxWidth: cardWidth } : null]}>
      <TouchableOpacity
        onPress={() => router.push(`/class/${item.id}` as any)}
        activeOpacity={0.85}
      >
        <View style={s.coverWrap}>
          <Image
            source={{ uri: coverUrl }}
            style={[
              s.cover,
              isSmallScreen
                ? { height: 125 }
                : (numColumns ?? 1) >= 4
                  ? { height: 135 }
                  : (numColumns ?? 1) >= 3
                    ? { height: 150 }
                    : { height: 165 }
            ]}
            onError={() => setCoverUrl(DEFAULT_COVER)}
          />
          {isCancelled && (
            <View style={s.cancelledBadge}>
              <Text style={s.cancelledBadgeText}>CANCELLED</Text>
            </View>
          )}
        </View>
        <View style={[s.cardBody, isSmallScreen && s.cardBodyMobile]}>
          <View style={[s.cardHeader, isSmallScreen && s.cardHeaderMobile]}>
            <View style={[s.catBadgeWrap, isSmallScreen && s.catBadgeWrapMobile]}>
              <Text style={[s.catBadge, isSmallScreen && s.catBadgeMobile]}>{item.category}</Text>
            </View>
            <View style={[s.rightBadges, isSmallScreen && s.rightBadgesMobile]}>
              <View style={[s.levelPill, isSmallScreen && s.levelPillMobile]}><Text style={[s.levelText, isSmallScreen && s.levelTextMobile]}>{item.level}</Text></View>
              {isCancelled ? (
                <View style={s.statusCancelledPill}><Text style={s.statusCancelledText}>Cancelled</Text></View>
              ) : isCompleted ? (
                <View style={s.statusCompletedPill}><Text style={s.statusCompletedText}>Completed</Text></View>
              ) : item.isLive ? (
                <View style={s.statusLivePill}><Text style={s.statusLiveText}>🔴 Live</Text></View>
              ) : (
                <View style={s.statusOpenPill}><Text style={s.statusOpenText}>Open</Text></View>
              )}
            </View>
          </View>

          <Text style={[s.title, isSmallScreen && s.titleMobile]}>{item.title}</Text>

          <View style={[s.metaRow, isSmallScreen && s.metaRowMobile]}>
            <View style={s.metaChunk}>
              <Calendar size={12} color={Colors.light.textTertiary} />
              <Text style={[s.metaText, isSmallScreen && s.metaTextMobile]}>
                {isRecurring
                  ? `${formatShortDate(item.startISO)} — ${formatShortDate(item.endISO)}`
                  : formatDate(item.startISO)}
              </Text>
            </View>
            <View style={s.metaChunk}>
              <Clock size={12} color={Colors.light.textTertiary} />
              <Text style={[s.metaText, isSmallScreen && s.metaTextMobile]}>{formatTime(item.startISO)}</Text>
            </View>
          </View>

          {isRecurring && (
            <View style={s.scheduleRow}>
              <RotateCcw size={11} color={Colors.light.primary} />
              <Text style={[s.scheduleText, isSmallScreen && s.scheduleTextMobile]}>
                {formatClassSchedule(item.sessionType, item.sessionCount, item.scheduleDays)}
              </Text>
            </View>
          )}

          <View style={[s.teacherRow, isSmallScreen && s.teacherRowMobile]}>
            <Image
              source={{ uri: avatarUrl }}
              style={s.teacherAvatar}
              onError={() => setAvatarUrl(DEFAULT_AVATAR)}
            />
            <Text style={[s.teacherName, isSmallScreen && s.teacherNameMobile]}>{item.teacher.name}</Text>
          </View>

          {!isCancelled && (
            <>
              <View style={[s.seatRow, isSmallScreen && s.seatRowMobile]}>
                <View style={s.seatInfo}>
                  <Users size={12} color={Colors.light.primary} />
                  <Text style={[s.seatText, isSmallScreen && s.seatTextMobile]}>{item.enrolledCount}/{item.maxCapacity} enrolled</Text>
                </View>
                <Text style={[s.seatsLeft, isSmallScreen && s.seatsLeftMobile]}>{seatsLeft} seat{seatsLeft === 1 ? '' : 's'} left</Text>
              </View>
              <View style={s.progressBar}>
                <View style={[s.progressFill, { width: `${fillPct}%` }]} />
              </View>
            </>
          )}

          <View style={[s.priceRow, isSmallScreen && s.priceRowMobile]}>
            <View style={[s.priceGroup, isSmallScreen && s.priceGroupMobile]}>
              {isCancelled ? (
                <View style={s.cancelledPriceTag}>
                  <Text style={s.cancelledPriceText}>Closed</Text>
                </View>
              ) : isFree ? (
                <View style={s.freeTag}><Sparkles size={12} color="#10B981" /><Text style={s.freeText}>Free</Text></View>
              ) : (
                <View style={s.priceTag}><Coins size={13} color="#F59E0B" /><Text style={s.priceText}>{formatCredits(item.seatPriceCredits)}</Text></View>
              )}
              {Boolean(item.billingCycle) && !isCancelled && !isFree && (
                <View style={s.billingPill}>
                  <Text style={[s.billingPillText, isSmallScreen && s.billingPillTextMobile]}>{formatBillingCycle(item.billingCycle)}</Text>
                </View>
              )}
            </View>

            {Boolean(item.isLive) && !isCancelled && !isCompleted && isEnrolledUser && (
              <TouchableOpacity
                style={s.joinCardBtn}
                onPress={() => router.push(`/class/call/${item.id}` as any)}
                activeOpacity={0.8}
              >
                <Video size={12} color="#FFFFFF" />
                <Text style={s.joinCardBtnText}>Join</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function ClassesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const isSmallScreen = windowWidth < 600;
  const safeTopInset = useSafeTopInset(isSmallScreen ? 14 : 20);

  const numColumns = useMemo(() => {
    if (windowWidth >= 1150) return 4;
    if (windowWidth >= 820) return 3;
    return 2; // Always 2 cards in a row on mobile devices
  }, [windowWidth]);

  const gridPadding = isSmallScreen ? (windowWidth < 360 ? 12 : 16) : 20;
  const gridGap = isSmallScreen ? (windowWidth < 360 ? 8 : 12) : 16;

  const cardWidth = useMemo(() => {
    const totalPadding = gridPadding * 2;
    const totalGap = (numColumns - 1) * gridGap;
    const availableWidth = Math.min(windowWidth, 1280) - totalPadding - totalGap;
    return Math.floor(availableWidth / numColumns);
  }, [windowWidth, numColumns, gridPadding, gridGap]);

  const { getClassesWithTeachers, isEnrolled } = useClasses();
  const { currentUser } = useCurrentUser();
  const { isBlocked } = useSafety();
  const [search, setSearch] = useState('');
  const [categoriesList, setCategoriesList] = useState<string[]>(() => defaultCategories);
  const [selectedCat, setSelectedCat] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'upcoming' | 'completed' | 'all'>('upcoming');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${url}/skills/categories`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setCategoriesList(Array.from(new Set(['All', ...defaultCategories, ...data])));
          }
        }
      } catch (err) {
        console.warn('[ClassesScreen] Failed to fetch categories from backend:', err);
      }
    };
    void fetchCategories();
  }, []);

  const allClasses = useMemo(() => {
    const raw = getClassesWithTeachers();
    if (!currentUser?.id) return raw;
    return raw.filter((cls) => {
      const teacherId = String(cls.teacherId || cls.teacher?.id || '');
      if (teacherId && isBlocked(teacherId, currentUser.id)) return false;
      return true;
    });
  }, [getClassesWithTeachers, currentUser?.id, isBlocked]);

  const statusCounts = useMemo(() => {
    const valid = allClasses.filter(c => c.status !== 'cancelled');
    const upcomingCount = valid.filter(c => c.status !== 'completed').length;
    const completedCount = valid.filter(c => c.status === 'completed').length;
    return {
      upcoming: upcomingCount,
      completed: completedCount,
      all: valid.length,
    };
  }, [allClasses]);

  const filteredClasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allClasses.filter(cls => {
      if (cls.status === 'cancelled') return false;

      if (statusFilter === 'upcoming' && cls.status === 'completed') return false;
      if (statusFilter === 'completed' && cls.status !== 'completed') return false;

      const matchSearch = q.length === 0 ||
        cls.title.toLowerCase().includes(q) ||
        cls.description.toLowerCase().includes(q) ||
        cls.teacher.name.toLowerCase().includes(q);
      const matchCat = selectedCat === 'All' || cls.category === selectedCat;
      return matchSearch && matchCat;
    }).sort((a, b) => {
      if (a.status === 'open' && b.status !== 'open') return -1;
      if (a.status !== 'open' && b.status === 'open') return 1;
      return 0;
    });
  }, [allClasses, search, selectedCat, statusFilter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const renderClassCard = useCallback(({ item }: { item: ClassWithTeacher }) => {
    const enrolledUser = currentUser?.id ? isEnrolled(item.id, currentUser.id) || String(item.teacherId) === String(currentUser.id) : false;
    return (
      <ClassCardItem 
        item={item} 
        router={router} 
        isEnrolledUser={enrolledUser} 
        cardWidth={cardWidth} 
        numColumns={numColumns} 
        isSmallScreen={isSmallScreen}
      />
    );
  }, [router, currentUser?.id, isEnrolled, cardWidth, numColumns, isSmallScreen]);

  return (
    <View style={s.container}>
      <LinearGradient
        colors={[Colors.light.primary, Colors.light.primaryLight]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.header, isSmallScreen && s.headerMobile, { paddingTop: safeTopInset }]}
      >
        <View style={[s.headerTop, isSmallScreen && s.headerTopMobile]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, isSmallScreen && s.headerTitleMobile]}>Group Classes</Text>
            <Text style={[s.headerSub, isSmallScreen && s.headerSubMobile]}>Learn together with expert teachers</Text>
          </View>
        </View>
        <View style={[s.searchBar, isSmallScreen && s.searchBarMobile]}>
          <Search size={isSmallScreen ? 15 : 18} color="#FFFFFF" opacity={0.8} />
          <TextInput
            style={[s.searchInput, isSmallScreen && s.searchInputMobile]}
            placeholder="Search classes..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={isSmallScreen ? 14 : 16} color="#FFFFFF" opacity={0.7} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Premium Filter Section */}
      <View style={[s.filterSection, isSmallScreen && s.filterSectionMobile]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.catScroll, isSmallScreen && s.catScrollMobile]} contentContainerStyle={[s.catContainer, isSmallScreen && s.catContainerMobile]}>
          {categoriesList.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[s.catPill, isSmallScreen && s.catPillMobile, selectedCat === cat && s.catPillActive]}
              onPress={() => setSelectedCat(cat)}
              activeOpacity={0.7}
            >
              <Text style={[s.catPillText, isSmallScreen && s.catPillTextMobile, selectedCat === cat && s.catPillTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.segmentScroll, isSmallScreen && s.segmentScrollMobile]} contentContainerStyle={[s.segmentedControl, isSmallScreen && s.segmentedControlMobile]}>
          <TouchableOpacity
            style={[s.segmentTab, isSmallScreen && s.segmentTabMobile, statusFilter === 'upcoming' && s.segmentTabActive]}
            onPress={() => setStatusFilter('upcoming')}
            activeOpacity={0.85}
          >
            {statusFilter === 'upcoming' ? (
              <LinearGradient
                colors={['#6366F1', '#4F46E5']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[s.segmentGradient, isSmallScreen && s.segmentGradientMobile]}
              >
                <Sparkles size={isSmallScreen ? 11 : 13} color="#FFFFFF" />
                <Text style={[s.segmentTextActive, isSmallScreen && s.segmentTextActiveMobile]}>Upcoming</Text>
                <View style={[s.activeBadge, isSmallScreen && s.activeBadgeMobile]}>
                  <Text style={[s.activeBadgeText, isSmallScreen && s.activeBadgeTextMobile]}>{statusCounts.upcoming}</Text>
                </View>
              </LinearGradient>
            ) : (
              <View style={[s.segmentTabInner, isSmallScreen && s.segmentTabInnerMobile]}>
                <Sparkles size={isSmallScreen ? 11 : 13} color={Colors.light.textTertiary} />
                <Text style={[s.segmentText, isSmallScreen && s.segmentTextMobile]}>Upcoming</Text>
                <View style={[s.inactiveBadge, isSmallScreen && s.inactiveBadgeMobile]}>
                  <Text style={[s.inactiveBadgeText, isSmallScreen && s.inactiveBadgeTextMobile]}>{statusCounts.upcoming}</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.segmentTab, isSmallScreen && s.segmentTabMobile, statusFilter === 'completed' && s.segmentTabActive]}
            onPress={() => setStatusFilter('completed')}
            activeOpacity={0.85}
          >
            {statusFilter === 'completed' ? (
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[s.segmentGradient, isSmallScreen && s.segmentGradientMobile]}
              >
                <CheckCircle2 size={isSmallScreen ? 11 : 13} color="#FFFFFF" />
                <Text style={[s.segmentTextActive, isSmallScreen && s.segmentTextActiveMobile]}>Completed</Text>
                <View style={[s.activeBadge, isSmallScreen && s.activeBadgeMobile]}>
                  <Text style={[s.activeBadgeText, isSmallScreen && s.activeBadgeTextMobile]}>{statusCounts.completed}</Text>
                </View>
              </LinearGradient>
            ) : (
              <View style={[s.segmentTabInner, isSmallScreen && s.segmentTabInnerMobile]}>
                <CheckCircle2 size={isSmallScreen ? 11 : 13} color={Colors.light.textTertiary} />
                <Text style={[s.segmentText, isSmallScreen && s.segmentTextMobile]}>Completed</Text>
                <View style={[s.inactiveBadge, isSmallScreen && s.inactiveBadgeMobile]}>
                  <Text style={[s.inactiveBadgeText, isSmallScreen && s.inactiveBadgeTextMobile]}>{statusCounts.completed}</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.segmentTab, isSmallScreen && s.segmentTabMobile, statusFilter === 'all' && s.segmentTabActive]}
            onPress={() => setStatusFilter('all')}
            activeOpacity={0.85}
          >
            {statusFilter === 'all' ? (
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[s.segmentGradient, isSmallScreen && s.segmentGradientMobile]}
              >
                <Layers size={isSmallScreen ? 11 : 13} color="#FFFFFF" />
                <Text style={[s.segmentTextActive, isSmallScreen && s.segmentTextActiveMobile]}>All</Text>
                <View style={[s.activeBadge, isSmallScreen && s.activeBadgeMobile]}>
                  <Text style={[s.activeBadgeText, isSmallScreen && s.activeBadgeTextMobile]}>{statusCounts.all}</Text>
                </View>
              </LinearGradient>
            ) : (
              <View style={[s.segmentTabInner, isSmallScreen && s.segmentTabInnerMobile]}>
                <Layers size={isSmallScreen ? 11 : 13} color={Colors.light.textTertiary} />
                <Text style={[s.segmentText, isSmallScreen && s.segmentTextMobile]}>All</Text>
                <View style={[s.inactiveBadge, isSmallScreen && s.inactiveBadgeMobile]}>
                  <Text style={[s.inactiveBadgeText, isSmallScreen && s.inactiveBadgeTextMobile]}>{statusCounts.all}</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={[s.resultsHeader, isSmallScreen && s.resultsHeaderMobile]}>
        <Text style={[s.resultsText, isSmallScreen && s.resultsTextMobile]}>
          {filteredClasses.length} {statusFilter === 'upcoming' ? 'upcoming' : statusFilter === 'completed' ? 'completed' : 'total'} class{filteredClasses.length === 1 ? '' : 'es'}
        </Text>
        <TouchableOpacity onPress={() => router.push('/class/my' as any)}>
          <Text style={[s.myClassesLink, isSmallScreen && s.myClassesLinkMobile]}>My Classes →</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        key={`classes-list-${numColumns}`}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? { gap: gridGap, marginBottom: gridGap } : undefined}
        style={{ flex: 1 }}
        data={filteredClasses}
        keyExtractor={item => item.id}
        renderItem={renderClassCard}
        contentContainerStyle={[s.listContent, isSmallScreen && s.listContentMobile, { paddingHorizontal: gridPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.primary} />}
        ListEmptyComponent={
          <View style={[s.emptyWrap, isSmallScreen && s.emptyWrapMobile]}>
            <Text style={[s.emptyText, isSmallScreen && s.emptyTextMobile]}>
              No {statusFilter === 'upcoming' ? 'upcoming' : statusFilter === 'completed' ? 'completed' : ''} classes match your filters.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.backgroundSecondary },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  headerTitle: { fontSize: 26, fontWeight: '800' as const, color: '#FFFFFF' },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
  },
  createBtnText: { fontSize: 14, fontWeight: '700' as const, color: '#FFFFFF' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#FFFFFF' },
  filterSection: {
    backgroundColor: Colors.light.background,
    paddingTop: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  segmentScroll: {
    flexGrow: 0,
    marginTop: 6,
    marginBottom: 6,
  },
  segmentedControl: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  segmentTab: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.light.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  segmentTabActive: {
    borderColor: 'transparent',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  segmentGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  segmentTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  segmentTextActive: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  activeBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  inactiveBadge: {
    backgroundColor: Colors.light.borderLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  inactiveBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textTertiary,
  },
  catScroll: {
    flexGrow: 0,
    backgroundColor: Colors.light.background,
  },
  catContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  catPillActive: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  catPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  resetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  resetPillText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.light.error,
  },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  resultsText: { fontSize: 14, fontWeight: '600' as const, color: Colors.light.textSecondary },
  myClassesLink: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.primary },
  listContent: { paddingHorizontal: 20, paddingBottom: 100, maxWidth: 1280, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: Colors.light.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: Colors.light.borderLight, shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, width: '100%' },
  cardMobile: {
    borderRadius: 14,
  },
  cardBodyMobile: {
    padding: 10,
  },
  titleMobile: {
    fontSize: 13.5,
    lineHeight: 18,
    marginBottom: 6,
  },
  cardCancelled: { opacity: 0.85, borderColor: 'rgba(239,68,68,0.3)' },
  coverWrap: { position: 'relative' },
  cover: { width: '100%', height: 180, backgroundColor: Colors.light.backgroundTertiary },
  cancelledBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(239,68,68,0.95)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  cancelledBadgeText: { fontSize: 11, fontWeight: '800' as const, color: '#FFFFFF', letterSpacing: 0.8 },
  cardBody: { padding: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 },
  catBadgeWrap: { flex: 1, minWidth: 0 },
  catBadge: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.secondary, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  rightBadges: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  levelPill: { backgroundColor: Colors.light.backgroundTertiary, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  levelText: { fontSize: 10, fontWeight: '700' as const, color: Colors.light.primary },
  statusLivePill: { backgroundColor: 'rgba(239,68,68,0.12)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  statusLiveText: { fontSize: 10, fontWeight: '700' as const, color: '#EF4444' },
  statusCancelledPill: { backgroundColor: 'rgba(239,68,68,0.12)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  statusCancelledText: { fontSize: 10, fontWeight: '700' as const, color: Colors.light.error },
  statusCompletedPill: { backgroundColor: 'rgba(139,92,246,0.12)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  statusCompletedText: { fontSize: 10, fontWeight: '700' as const, color: '#8B5CF6' },
  statusOpenPill: { backgroundColor: 'rgba(16,185,129,0.12)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  statusOpenText: { fontSize: 10, fontWeight: '700' as const, color: '#10B981' },
  title: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 8, lineHeight: 21 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  metaChunk: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, minWidth: 0 },
  metaText: { fontSize: 11, color: Colors.light.textTertiary, fontWeight: '500' as const },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8, backgroundColor: 'rgba(99,102,241,0.06)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', maxWidth: '100%' },
  scheduleText: { fontSize: 11, color: Colors.light.primary, fontWeight: '600' as const, flexShrink: 1 },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  teacherAvatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border },
  teacherName: { fontSize: 12, fontWeight: '600' as const, color: Colors.light.textSecondary, flex: 1, minWidth: 0 },
  seatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, gap: 6 },
  seatInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, minWidth: 0 },
  seatText: { fontSize: 11, fontWeight: '600' as const, color: Colors.light.primary },
  seatsLeft: { fontSize: 11, color: Colors.light.textTertiary, flexShrink: 0 },
  progressBar: { height: 4, backgroundColor: Colors.light.borderLight, borderRadius: 2, marginBottom: 10 },
  progressFill: { height: '100%', backgroundColor: Colors.light.primary, borderRadius: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 2 },
  priceGroup: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap', flex: 1, minWidth: 0 },
  cancelledPriceTag: { backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  cancelledPriceText: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.error },
  freeTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(16,185,129,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  freeText: { fontSize: 11, fontWeight: '700' as const, color: '#10B981' },
  priceTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  priceText: { fontSize: 11, fontWeight: '700' as const, color: '#F59E0B' },
  billingPill: { backgroundColor: Colors.light.backgroundTertiary, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  billingPillText: { fontSize: 10, fontWeight: '600' as const, color: Colors.light.secondary },
  joinCardBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, flexShrink: 0 },
  joinCardBtnText: { fontSize: 11, fontWeight: '700' as const, color: '#FFFFFF' },
  cardHeaderMobile: { flexDirection: 'column', alignItems: 'flex-start', gap: 4, marginBottom: 6 },
  catBadgeWrapMobile: { width: '100%' },
  catBadgeMobile: { fontSize: 9.5, letterSpacing: 0.5, flexWrap: 'wrap' },
  rightBadgesMobile: { flexWrap: 'wrap', gap: 4 },
  levelPillMobile: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  levelTextMobile: { fontSize: 9 },
  metaRowMobile: { flexDirection: 'column', alignItems: 'flex-start', gap: 4, marginBottom: 6 },
  metaTextMobile: { fontSize: 10, flexWrap: 'wrap' },
  scheduleTextMobile: { fontSize: 10, flexWrap: 'wrap' },
  teacherRowMobile: { gap: 6, marginBottom: 8 },
  teacherNameMobile: { fontSize: 11, flexWrap: 'wrap' },
  seatRowMobile: { flexDirection: 'column', alignItems: 'flex-start', gap: 2, marginBottom: 4 },
  seatTextMobile: { fontSize: 10, flexWrap: 'wrap' },
  seatsLeftMobile: { fontSize: 10, flexWrap: 'wrap' },
  priceRowMobile: { flexWrap: 'wrap', gap: 4 },
  priceGroupMobile: { flexWrap: 'wrap', gap: 4 },
  billingPillTextMobile: { fontSize: 9, flexWrap: 'wrap' },
  emptyWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyWrapMobile: { paddingVertical: 30 },
  emptyText: { fontSize: 15, color: Colors.light.textTertiary, fontWeight: '500' as const },
  emptyTextMobile: { fontSize: 12 },
  headerMobile: { paddingHorizontal: 16, paddingBottom: 10 },
  headerTopMobile: { marginBottom: 8 },
  headerTitleMobile: { fontSize: 18 },
  headerSubMobile: { fontSize: 11.5, marginTop: 2 },
  searchBarMobile: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, gap: 6 },
  searchInputMobile: { fontSize: 13 },
  filterSectionMobile: { paddingTop: 6, paddingBottom: 2 },
  catScrollMobile: { flexGrow: 0 },
  catContainerMobile: { paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  catPillMobile: { paddingHorizontal: 10, paddingVertical: 4.5, borderRadius: 10 },
  catPillTextMobile: { fontSize: 11 },
  segmentScrollMobile: { marginTop: 3, marginBottom: 4 },
  segmentedControlMobile: { paddingHorizontal: 12, gap: 6 },
  segmentTabMobile: { borderRadius: 10 },
  segmentGradientMobile: { paddingVertical: 5, paddingHorizontal: 9, gap: 4, borderRadius: 9 },
  segmentTabInnerMobile: { paddingVertical: 5, paddingHorizontal: 9, gap: 4 },
  segmentTextMobile: { fontSize: 10.5 },
  segmentTextActiveMobile: { fontSize: 10.5 },
  activeBadgeMobile: { paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 8 },
  activeBadgeTextMobile: { fontSize: 9 },
  inactiveBadgeMobile: { paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 8 },
  inactiveBadgeTextMobile: { fontSize: 9 },
  resultsHeaderMobile: { paddingHorizontal: 16, paddingVertical: 8 },
  resultsTextMobile: { fontSize: 11.5 },
  myClassesLinkMobile: { fontSize: 11.5 },
  listContentMobile: { paddingBottom: 24 },
});
