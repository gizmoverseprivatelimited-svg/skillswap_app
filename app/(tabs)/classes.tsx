import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, Image, TextInput, RefreshControl, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, X, Calendar, Clock, Users, Coins, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { categories as defaultCategories } from '@/mocks/data';
import { useClasses } from '@/providers/classes';
import { useCurrentUser } from '@/providers/current-user';
import type { ClassWithTeacher } from '@/types';
import { formatCredits } from '@/lib/payments';
import { resolveImageUrl } from '@/lib/resolveImageUrl';
import url from '@/constants/backurl';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800';
const DEFAULT_AVATAR = 'https://i.pravatar.cc/150?img=1';

function ClassCardItem({ item, router }: { item: ClassWithTeacher; router: any }) {
  const seatsLeft = item.maxCapacity - item.enrolledCount;
  const fillPct = Math.round((item.enrolledCount / item.maxCapacity) * 100);
  const isFree = item.seatPriceCredits === 0;
  const isCancelled = item.status === 'cancelled';
  const isCompleted = item.status === 'completed';

  const [coverUrl, setCoverUrl] = useState(() => resolveImageUrl(item.coverImageUrl, DEFAULT_COVER) || DEFAULT_COVER);
  const [avatarUrl, setAvatarUrl] = useState(() => resolveImageUrl(item.teacher.avatarUrl, DEFAULT_AVATAR) || DEFAULT_AVATAR);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };
  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <TouchableOpacity
      style={[s.card, isCancelled && s.cardCancelled]}
      onPress={() => router.push(`/class/${item.id}` as any)}
      activeOpacity={0.85}
    >
      <View style={s.coverWrap}>
        <Image
          source={{ uri: coverUrl }}
          style={s.cover}
          onError={() => setCoverUrl(DEFAULT_COVER)}
        />
        {isCancelled && (
          <View style={s.cancelledBadge}>
            <Text style={s.cancelledBadgeText}>CANCELLED</Text>
          </View>
        )}
      </View>
      <View style={s.cardBody}>
        <View style={s.cardHeader}>
          <Text style={s.catBadge}>{item.category}</Text>
          <View style={s.rightBadges}>
            <View style={s.levelPill}><Text style={s.levelText}>{item.level}</Text></View>
            {isCancelled ? (
              <View style={s.statusCancelledPill}><Text style={s.statusCancelledText}>Cancelled</Text></View>
            ) : isCompleted ? (
              <View style={s.statusCompletedPill}><Text style={s.statusCompletedText}>Completed</Text></View>
            ) : (
              <View style={s.statusOpenPill}><Text style={s.statusOpenText}>Open</Text></View>
            )}
          </View>
        </View>
        <Text style={s.title} numberOfLines={2}>{item.title}</Text>
        <View style={s.metaRow}>
          <Calendar size={13} color={Colors.light.textTertiary} />
          <Text style={s.metaText}>{formatDate(item.startISO)}</Text>
          <Clock size={13} color={Colors.light.textTertiary} />
          <Text style={s.metaText}>{formatTime(item.startISO)}</Text>
        </View>
        <View style={s.teacherRow}>
          <Image
            source={{ uri: avatarUrl }}
            style={s.teacherAvatar}
            onError={() => setAvatarUrl(DEFAULT_AVATAR)}
          />
          <Text style={s.teacherName} numberOfLines={1}>{item.teacher.name}</Text>
        </View>
        {!isCancelled && (
          <>
            <View style={s.seatRow}>
              <View style={s.seatInfo}>
                <Users size={14} color={Colors.light.primary} />
                <Text style={s.seatText}>{item.enrolledCount}/{item.maxCapacity} enrolled</Text>
              </View>
              <Text style={s.seatsLeft}>{seatsLeft} seat{seatsLeft === 1 ? '' : 's'} left</Text>
            </View>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${fillPct}%` }]} />
            </View>
          </>
        )}
        <View style={s.priceRow}>
          {isCancelled ? (
            <View style={s.cancelledPriceTag}>
              <Text style={s.cancelledPriceText}>Enrollment Closed</Text>
            </View>
          ) : isFree ? (
            <View style={s.freeTag}><Sparkles size={13} color="#10B981" /><Text style={s.freeText}>Free</Text></View>
          ) : (
            <View style={s.priceTag}><Coins size={14} color="#F59E0B" /><Text style={s.priceText}>{formatCredits(item.seatPriceCredits)}</Text></View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ClassesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getClassesWithTeachers } = useClasses();
  const { currentUser } = useCurrentUser();
  const [search, setSearch] = useState('');
  const [categoriesList, setCategoriesList] = useState<string[]>(() => defaultCategories);
  const [selectedCat, setSelectedCat] = useState('All');
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

  const allClasses = useMemo(() => getClassesWithTeachers(), [getClassesWithTeachers]);

  const filteredClasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allClasses.filter(cls => {
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
  }, [allClasses, search, selectedCat]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const renderClassCard = useCallback(({ item }: { item: ClassWithTeacher }) => (
    <ClassCardItem item={item} router={router} />
  ), [router]);

  return (
    <View style={s.container}>
      <LinearGradient
        colors={[Colors.light.primary, Colors.light.primaryLight]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={s.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Group Classes</Text>
            <Text style={s.headerSub}>Learn together with expert teachers</Text>
          </View>
        </View>
        <View style={s.searchBar}>
          <Search size={18} color="#FFFFFF" opacity={0.8} />
          <TextInput
            style={s.searchInput}
            placeholder="Search classes..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={16} color="#FFFFFF" opacity={0.7} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll} contentContainerStyle={s.catContainer}>
        {categoriesList.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[s.catPill, selectedCat === cat && s.catPillActive]}
            onPress={() => setSelectedCat(cat)}
            activeOpacity={0.7}
          >
            <Text style={[s.catPillText, selectedCat === cat && s.catPillTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={s.resultsHeader}>
        <Text style={s.resultsText}>{filteredClasses.length} upcoming class{filteredClasses.length === 1 ? '' : 'es'}</Text>
        <TouchableOpacity onPress={() => router.push('/class/my' as any)}>
          <Text style={s.myClassesLink}>My Classes →</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={filteredClasses}
        keyExtractor={item => item.id}
        renderItem={renderClassCard}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.primary} />}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyText}>No upcoming classes match your filters.</Text>
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
  catScroll: { flexGrow: 0, backgroundColor: Colors.light.background, marginTop: 12, marginBottom: 4, borderTopWidth: 1, borderTopColor: Colors.light.borderLight, borderBottomWidth: 1, borderBottomColor: Colors.light.borderLight },
  catContainer: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'center' },
  catPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: Colors.light.backgroundTertiary, borderWidth: 1, borderColor: Colors.light.border },
  catPillActive: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  catPillText: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.textSecondary },
  catPillTextActive: { color: '#FFFFFF' },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  resultsText: { fontSize: 14, fontWeight: '600' as const, color: Colors.light.textSecondary },
  myClassesLink: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.primary },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { backgroundColor: Colors.light.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: Colors.light.borderLight, shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  cardCancelled: { opacity: 0.85, borderColor: 'rgba(239,68,68,0.3)' },
  coverWrap: { position: 'relative' },
  cover: { width: '100%', height: 180, backgroundColor: Colors.light.backgroundTertiary },
  cancelledBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(239,68,68,0.95)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  cancelledBadgeText: { fontSize: 11, fontWeight: '800' as const, color: '#FFFFFF', letterSpacing: 0.8 },
  cardBody: { padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  catBadge: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.secondary, textTransform: 'uppercase' as const, letterSpacing: 1 },
  rightBadges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  levelPill: { backgroundColor: Colors.light.backgroundTertiary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  levelText: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.primary },
  statusCancelledPill: { backgroundColor: 'rgba(239,68,68,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusCancelledText: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.error },
  statusCompletedPill: { backgroundColor: 'rgba(139,92,246,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusCompletedText: { fontSize: 11, fontWeight: '700' as const, color: '#8B5CF6' },
  statusOpenPill: { backgroundColor: 'rgba(16,185,129,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusOpenText: { fontSize: 11, fontWeight: '700' as const, color: '#10B981' },
  title: { fontSize: 17, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 10, lineHeight: 23 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  metaText: { fontSize: 13, color: Colors.light.textTertiary, fontWeight: '500' as const, marginRight: 8 },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  teacherAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.light.border },
  teacherName: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.textSecondary },
  seatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  seatInfo: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  seatText: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.primary },
  seatsLeft: { fontSize: 12, color: Colors.light.textTertiary },
  progressBar: { height: 5, backgroundColor: Colors.light.borderLight, borderRadius: 3, marginBottom: 12 },
  progressFill: { height: '100%', backgroundColor: Colors.light.primary, borderRadius: 3 },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  cancelledPriceTag: { backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  cancelledPriceText: { fontSize: 13, fontWeight: '700' as const, color: Colors.light.error },
  freeTag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(16,185,129,0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  freeText: { fontSize: 13, fontWeight: '700' as const, color: '#10B981' },
  priceTag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  priceText: { fontSize: 13, fontWeight: '700' as const, color: '#F59E0B' },
  emptyWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 15, color: Colors.light.textTertiary, fontWeight: '500' as const },
});
