import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar, Clock, Users, Coins, Plus, CheckCircle2, XCircle, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useClasses } from '@/providers/classes';
import { useCurrentUser } from '@/providers/current-user';
import type { ClassWithTeacher } from '@/types';
import { formatCredits } from '@/lib/payments';

type Segment = 'teaching' | 'enrolled';

export default function MyClassesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getMyTeachingClasses, getMyEnrolledClasses } = useClasses();
  const { currentUser } = useCurrentUser();
  const [segment, setSegment] = useState<Segment>('teaching');

  const teachingClasses = useMemo(() => getMyTeachingClasses(), [getMyTeachingClasses]);
  const enrolledClasses = useMemo(() => getMyEnrolledClasses(), [getMyEnrolledClasses]);
  const displayClasses = segment === 'teaching' ? teachingClasses : enrolledClasses;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };
  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const renderClassCard = useCallback(({ item }: { item: ClassWithTeacher }) => {
    const isFree = item.seatPriceCredits === 0;
    const seatsLeft = item.maxCapacity - item.enrolledCount;
    const isTeacher = item.teacherId === currentUser.id;
    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => router.push(`/class/${item.id}` as any)}
        activeOpacity={0.85}
      >
        <Image source={{ uri: item.coverImageUrl }} style={s.cover} />
        <View style={s.cardBody}>
          <View style={s.cardHeader}>
            <Text style={s.catBadge}>{item.category}</Text>
            <View style={[s.statusPill, item.status === 'completed' && s.statusCompleted, item.status === 'cancelled' && s.statusCancelled, item.status === 'open' && s.statusOpen]}>
              <Text style={s.statusPillText}>{item.status === 'completed' ? 'Completed' : item.status === 'cancelled' ? 'Cancelled' : 'Upcoming'}</Text>
            </View>
          </View>
          <Text style={s.title} numberOfLines={2}>{item.title}</Text>
          <View style={s.metaRow}>
            <Calendar size={13} color={Colors.light.textTertiary} />
            <Text style={s.metaText}>{formatDate(item.startISO)}</Text>
            <Clock size={13} color={Colors.light.textTertiary} />
            <Text style={s.metaText}>{formatTime(item.startISO)}</Text>
          </View>
          {isTeacher ? (
            <View style={s.seatRow}>
              <Users size={14} color={Colors.light.primary} />
              <Text style={s.seatText}>{item.enrolledCount}/{item.maxCapacity} enrolled</Text>
            </View>
          ) : (
            <View style={s.seatRow}>
              {isFree ? <Sparkles size={14} color="#10B981" /> : <Coins size={14} color="#F59E0B" />}
              <Text style={s.seatText}>{isFree ? 'Free class' : formatCredits(item.seatPriceCredits)}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [router, currentUser.id]);

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
          onPress={() => router.push('/class/create' as any)}
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
              <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/class/create' as any)}>
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
  listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  card: { backgroundColor: Colors.light.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: Colors.light.borderLight, shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  cover: { width: '100%', height: 160, backgroundColor: Colors.light.backgroundTertiary },
  cardBody: { padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  catBadge: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.secondary, textTransform: 'uppercase' as const, letterSpacing: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusOpen: { backgroundColor: 'rgba(99,102,241,0.15)' },
  statusCompleted: { backgroundColor: 'rgba(139,92,246,0.15)' },
  statusCancelled: { backgroundColor: 'rgba(239,68,68,0.15)' },
  statusPillText: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.textSecondary },
  title: { fontSize: 17, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 10, lineHeight: 23 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  metaText: { fontSize: 13, color: Colors.light.textTertiary, fontWeight: '500' as const, marginRight: 8 },
  seatRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  seatText: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.primary },
  emptyWrap: { paddingVertical: 60, alignItems: 'center', gap: 16 },
  emptyText: { fontSize: 15, color: Colors.light.textTertiary, fontWeight: '500' as const, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.light.primary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText: { fontSize: 14, fontWeight: '700' as const, color: '#FFFFFF' },
});
