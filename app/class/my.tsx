import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar, Clock, Users, Coins, Plus, CheckCircle2, XCircle, Sparkles, Repeat, CreditCard, Video } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useClasses } from '@/providers/classes';
import { useCurrentUser } from '@/providers/current-user';
import { useAlert } from '@/providers/alert';
import type { ClassWithTeacher } from '@/types';
import { formatCredits, formatClassSchedule, formatBillingCycle } from '@/lib/payments';
import { resolveImageUrl } from '@/lib/resolveImageUrl';

type Segment = 'teaching' | 'enrolled';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800';

function MyClassCardItem({ item, currentUserId, router }: { item: ClassWithTeacher; currentUserId?: string; router: any }) {
  const isFree = item.seatPriceCredits === 0;
  const isTeacher = item.teacherId === currentUserId;
  const isRecurring = item.sessionType && item.sessionType !== 'single';
  const [coverUrl, setCoverUrl] = useState(() => resolveImageUrl(item.coverImageUrl, DEFAULT_COVER) || DEFAULT_COVER);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };
  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };
  const formatShortDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => router.push(`/class/${item.id}` as any)}
      activeOpacity={0.85}
    >
      <Image
        source={{ uri: coverUrl }}
        style={s.cover}
        onError={() => setCoverUrl(DEFAULT_COVER)}
      />
      <View style={s.cardBody}>
        <View style={s.cardHeader}>
          <View style={s.catBadgeWrap}>
            <Text style={s.catBadge} numberOfLines={1} ellipsizeMode="tail">{item.category}</Text>
          </View>
          <View style={[s.statusPill, item.status === 'completed' && s.statusCompleted, item.status === 'cancelled' && s.statusCancelled, item.status === 'open' && s.statusOpen]}>
            <Text style={s.statusPillText}>{item.status === 'completed' ? 'Completed' : item.status === 'cancelled' ? 'Cancelled' : 'Upcoming'}</Text>
          </View>
        </View>
        <Text style={s.title} numberOfLines={2}>{item.title}</Text>
        <View style={s.metaRow}>
          <View style={s.metaChunk}>
            <Calendar size={12} color={Colors.light.textTertiary} />
            <Text style={s.metaText} numberOfLines={1}>
              {isRecurring
                ? `${formatShortDate(item.startISO)} — ${formatShortDate(item.endISO)}`
                : formatDate(item.startISO)}
            </Text>
          </View>
          <View style={s.metaChunk}>
            <Clock size={12} color={Colors.light.textTertiary} />
            <Text style={s.metaText} numberOfLines={1}>{formatTime(item.startISO)}</Text>
          </View>
        </View>
        {isRecurring && (
          <View style={s.scheduleRow}>
            <Repeat size={11} color={Colors.light.primary} />
            <Text style={s.scheduleText} numberOfLines={1} ellipsizeMode="tail">
              {formatClassSchedule(item.sessionType, item.sessionCount, item.scheduleDays)}
            </Text>
          </View>
        )}
        <View style={s.bottomRow}>
          {isTeacher ? (
            <View style={s.seatInfo}>
              <Users size={13} color={Colors.light.primary} />
              <Text style={s.seatText} numberOfLines={1}>{item.enrolledCount}/{item.maxCapacity} enrolled</Text>
            </View>
          ) : (
            <View style={s.priceInfo}>
              {isFree ? <Sparkles size={13} color="#10B981" /> : <Coins size={13} color="#F59E0B" />}
              <Text style={s.seatText} numberOfLines={1}>{isFree ? 'Free class' : formatCredits(item.seatPriceCredits)}</Text>
            </View>
          )}
          {Boolean(item.billingCycle) && (
            <View style={s.billingPill}>
              <Text style={s.billingPillText} numberOfLines={1}>{formatBillingCycle(item.billingCycle)}</Text>
            </View>
          )}
          {Boolean(item.isLive) && item.status !== 'completed' && item.status !== 'cancelled' && (
            <TouchableOpacity
              style={s.joinLiveCardBtn}
              onPress={() => router.push(`/call/${item.id}?mode=video` as any)}
              activeOpacity={0.8}
            >
              <Video size={12} color="#FFFFFF" />
              <Text style={s.joinLiveCardBtnText}>Join Live</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MyClassesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getMyTeachingClasses, getMyEnrolledClasses } = useClasses();
  const { currentUser } = useCurrentUser();
  const { showAlert } = useAlert();
  const [segment, setSegment] = useState<Segment>('teaching');

  const isDemoUser = !currentUser || currentUser.id === '1' || (currentUser as any)?.isDemo;

  const handleCreateClassPress = () => {
    if (isDemoUser) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to create group classes.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }
    router.push('/class/create' as any);
  };

  const teachingClasses = useMemo(() => getMyTeachingClasses(), [getMyTeachingClasses]);
  const enrolledClasses = useMemo(() => getMyEnrolledClasses(), [getMyEnrolledClasses]);
  const displayClasses = segment === 'teaching' ? teachingClasses : enrolledClasses;

  const renderClassCard = useCallback(({ item }: { item: ClassWithTeacher }) => (
    <MyClassCardItem item={item} currentUserId={currentUser?.id} router={router} />
  ), [router, currentUser?.id]);

  return (
    <View style={s.container}>
      <LinearGradient
        colors={[Colors.light.primary, Colors.light.primaryLight]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top + 16 }]}
      >
        <Text style={s.headerTitle}>My Classes</Text>
        <Text style={s.headerSub}>Manage your teaching and enrolled classes</Text>
        <TouchableOpacity
          style={s.createBtn}
          onPress={handleCreateClassPress}
          activeOpacity={0.8}
        >
          <Plus size={18} color="#FFFFFF" />
          <Text style={s.createBtnText}>Create Class</Text>
        </TouchableOpacity>
      </LinearGradient>

      <View style={s.segmentRow}>
        <TouchableOpacity
          style={[s.segment, segment === 'teaching' && s.segmentActive]}
          onPress={() => setSegment('teaching')}
          activeOpacity={0.7}
        >
          <Text style={[s.segmentText, segment === 'teaching' && s.segmentTextActive]}>Teaching ({teachingClasses.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.segment, segment === 'enrolled' && s.segmentActive]}
          onPress={() => setSegment('enrolled')}
          activeOpacity={0.7}
        >
          <Text style={[s.segmentText, segment === 'enrolled' && s.segmentTextActive]}>Enrolled ({enrolledClasses.length})</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayClasses}
        keyExtractor={item => item.id}
        renderItem={renderClassCard}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyText}>
              {segment === 'teaching'
                ? "You haven't created any classes yet."
                : "You haven't enrolled in any classes yet."}
            </Text>
            {segment === 'teaching' && (
              <TouchableOpacity style={s.emptyBtn} onPress={handleCreateClassPress}>
                <Plus size={16} color="#FFFFFF" />
                <Text style={s.emptyBtnText}>Create your first class</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.backgroundSecondary },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '800' as const, color: '#FFFFFF' },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4, marginBottom: 16 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, alignSelf: 'flex-start' },
  createBtnText: { fontSize: 14, fontWeight: '700' as const, color: '#FFFFFF' },
  segmentRow: { flexDirection: 'row', backgroundColor: Colors.light.background, paddingHorizontal: 20, paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.light.borderLight },
  segment: { flex: 1, paddingVertical: 11, borderRadius: 14, backgroundColor: Colors.light.backgroundTertiary, borderWidth: 1, borderColor: Colors.light.border, alignItems: 'center' },
  segmentActive: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  segmentText: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.textSecondary },
  segmentTextActive: { color: '#FFFFFF' },
  listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, maxWidth: 800, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: Colors.light.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: Colors.light.borderLight, shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, width: '100%' },
  cover: { width: '100%', height: 160, backgroundColor: Colors.light.backgroundTertiary },
  cardBody: { padding: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 },
  catBadgeWrap: { flex: 1, minWidth: 0 },
  catBadge: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.secondary, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexShrink: 0 },
  statusOpen: { backgroundColor: 'rgba(99,102,241,0.15)' },
  statusCompleted: { backgroundColor: 'rgba(139,92,246,0.15)' },
  statusCancelled: { backgroundColor: 'rgba(239,68,68,0.15)' },
  statusPillText: { fontSize: 10, fontWeight: '700' as const, color: Colors.light.textSecondary },
  title: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 8, lineHeight: 21 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  metaChunk: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, minWidth: 0 },
  metaText: { fontSize: 11, color: Colors.light.textTertiary, fontWeight: '500' as const },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8, backgroundColor: 'rgba(99,102,241,0.06)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', maxWidth: '100%' },
  scheduleText: { fontSize: 11, color: Colors.light.primary, fontWeight: '600' as const, flexShrink: 1 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  seatInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, minWidth: 0 },
  priceInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, minWidth: 0 },
  seatText: { fontSize: 12, fontWeight: '600' as const, color: Colors.light.primary },
  billingPill: { backgroundColor: Colors.light.backgroundTertiary, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  billingPillText: { fontSize: 10, fontWeight: '600' as const, color: Colors.light.secondary },
  joinLiveCardBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, flexShrink: 0 },
  joinLiveCardBtnText: { fontSize: 11, fontWeight: '700' as const, color: '#FFFFFF' },
  emptyWrap: { paddingVertical: 60, alignItems: 'center', gap: 16 },
  emptyText: { fontSize: 15, color: Colors.light.textTertiary, fontWeight: '500' as const, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.light.primary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText: { fontSize: 14, fontWeight: '700' as const, color: '#FFFFFF' },
});
