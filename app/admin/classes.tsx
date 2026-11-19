import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Image, TextInput, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Users, Calendar, Coins, XCircle, ArrowLeft, Search, Sparkles, Repeat, CreditCard } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeTopInset } from '@/lib/safeArea';
import Colors from '@/constants/colors';
import { useClasses } from '@/providers/classes';
import { useAdmin } from '@/providers/admin';
import { useAlert } from '@/providers/alert';
import type { ClassWithTeacher } from '@/types';
import { formatClassSchedule, formatBillingCycle } from '@/lib/payments';
import { resolveImageUrl } from '@/lib/resolveImageUrl';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800';
const DEFAULT_AVATAR = 'https://i.pravatar.cc/150?img=1';

function AdminClassCardItem({ item, handleCancelClass, s }: { item: ClassWithTeacher; handleCancelClass: (cls: ClassWithTeacher) => void; s: any }) {
  const [coverUrl, setCoverUrl] = useState(() => resolveImageUrl(item.coverImageUrl, DEFAULT_COVER) || DEFAULT_COVER);
  const [avatarUrl, setAvatarUrl] = useState(() => resolveImageUrl(item.teacher.avatarUrl, DEFAULT_AVATAR) || DEFAULT_AVATAR);
  const isRecurring = item.sessionType && item.sessionType !== 'single';

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <View style={s.card}>
      <Image
        source={{ uri: coverUrl }}
        style={s.cover}
        onError={() => setCoverUrl(DEFAULT_COVER)}
      />
      <View style={s.cardBody}>
        <View style={s.cardHeader}>
          <Text style={s.catBadge}>{item.category}</Text>
          <View style={[s.statusPill, item.status === 'completed' && s.statusCompleted, item.status === 'cancelled' && s.statusCancelled]}>
            <Text style={s.statusText}>{item.status}</Text>
          </View>
        </View>
        <Text style={s.title}>{item.title}</Text>
        <View style={s.teacherRow}>
          <Image
            source={{ uri: avatarUrl }}
            style={s.teacherAvatar}
            onError={() => setAvatarUrl(DEFAULT_AVATAR)}
          />
          <Text style={s.teacherName}>{item.teacher.name}</Text>
        </View>
        <View style={s.metaRow}>
          <View style={s.metaItem}>
            <Calendar size={13} color={Colors.light.textTertiary} />
            <Text style={s.metaText}>
              {isRecurring
                ? `${formatDate(item.startISO)} — ${formatDate(item.endISO)}`
                : formatDate(item.startISO)}
            </Text>
          </View>
          <View style={s.metaItem}>
            <Users size={13} color={Colors.light.primary} />
            <Text style={s.metaText}>{item.enrolledCount}/{item.maxCapacity}</Text>
          </View>
          <View style={s.metaItem}>
            {item.seatPriceCredits === 0 ? <Sparkles size={13} color="#10B981" /> : <Coins size={13} color="#F59E0B" />}
            <Text style={s.metaText}>{item.seatPriceCredits === 0 ? 'Free' : `${item.seatPriceCredits}cr`}</Text>
          </View>
        </View>
        <View style={s.metaRow}>
          <View style={s.metaItem}>
            <Repeat size={13} color={Colors.light.primary} />
            <Text style={[s.metaText, { color: Colors.light.primary }]}>{formatClassSchedule(item.sessionType, item.sessionCount, item.scheduleDays)}</Text>
          </View>
          <View style={s.metaItem}>
            <CreditCard size={13} color={Colors.light.secondary} />
            <Text style={[s.metaText, { color: Colors.light.secondary }]}>{formatBillingCycle(item.billingCycle)}</Text>
          </View>
        </View>
        {item.status === 'open' && (
          <TouchableOpacity style={s.cancelBtn} onPress={() => handleCancelClass(item)} activeOpacity={0.8}>
            <XCircle size={16} color={Colors.light.error} />
            <Text style={s.cancelBtnText}>Cancel Class</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function AdminClassesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isSmallScreen = windowWidth < 600;
  const safeTop = useSafeTopInset(isSmallScreen ? 8 : 14);
  const s = useMemo(() => createStyles(isSmallScreen), [isSmallScreen]);
  const { isAdminAuthenticated } = useAdmin();
  const { getClassesWithTeachers, cancelClass } = useClasses();
  const { showAlert } = useAlert();
  const [search, setSearch] = useState('');

  const allClasses = useMemo(() => getClassesWithTeachers(), [getClassesWithTeachers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length === 0) return allClasses;
    return allClasses.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.teacher.name.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  }, [allClasses, search]);

  const handleCancelClass = useCallback((cls: ClassWithTeacher) => {
    showAlert(
      'Cancel this class?',
      `"${cls.title}" by ${cls.teacher.name}. ${cls.enrolledCount} student${cls.enrolledCount === 1 ? '' : 's'} will be refunded.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Class',
          style: 'destructive',
          onPress: () => {
            cancelClass(cls.id);
            showAlert('Done', 'Class cancelled and students refunded.');
          },
        },
      ],
    );
  }, [cancelClass, showAlert]);

  const renderItem = useCallback(({ item }: { item: ClassWithTeacher }) => (
    <AdminClassCardItem item={item} handleCancelClass={handleCancelClass} s={s} />
  ), [handleCancelClass, s]);

  if (!isAdminAuthenticated) {
    return (
      <View style={s.denied}>
        <Text style={s.deniedText}>Admin access required</Text>
        <TouchableOpacity style={s.deniedBtn} onPress={() => router.replace('/admin/login' as any)}>
          <Text style={s.deniedBtnText}>Go to login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: safeTop }]}>
        <View style={s.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <ArrowLeft size={22} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Class Management</Text>
        </View>
        <View style={s.searchBar}>
          <Search size={18} color={Colors.light.textTertiary} />
          <TextInput
            style={s.searchInput}
            placeholder="Search classes..."
            placeholderTextColor={Colors.light.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyText}>No classes found.</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (isSmallScreen: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.backgroundSecondary },
  header: { backgroundColor: Colors.light.background, borderBottomWidth: 1, borderBottomColor: Colors.light.borderLight, paddingHorizontal: isSmallScreen ? 14 : 20, paddingBottom: isSmallScreen ? 10 : 14 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: isSmallScreen ? 10 : 14 },
  backBtn: { width: isSmallScreen ? 34 : 40, height: isSmallScreen ? 34 : 40, borderRadius: isSmallScreen ? 17 : 20, backgroundColor: Colors.light.backgroundTertiary, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: isSmallScreen ? 17 : 20, fontWeight: '800' as const, color: Colors.light.text },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.light.backgroundTertiary, borderRadius: 14, paddingHorizontal: isSmallScreen ? 12 : 16, paddingVertical: isSmallScreen ? 8 : 12, borderWidth: 1, borderColor: Colors.light.border },
  searchInput: { flex: 1, fontSize: isSmallScreen ? 13 : 15, color: Colors.light.text },
  listContent: { padding: isSmallScreen ? 12 : 20, paddingBottom: isSmallScreen ? 24 : 40 },
  card: { backgroundColor: Colors.light.card, borderRadius: isSmallScreen ? 14 : 20, overflow: 'hidden', borderWidth: 1, borderColor: Colors.light.borderLight, shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  cover: { width: '100%', height: isSmallScreen ? 120 : 150, backgroundColor: Colors.light.backgroundTertiary },
  cardBody: { padding: isSmallScreen ? 12 : 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: isSmallScreen ? 6 : 10 },
  catBadge: { fontSize: isSmallScreen ? 10 : 11, fontWeight: '700' as const, color: Colors.light.secondary, textTransform: 'uppercase' as const, letterSpacing: 1 },
  statusPill: { paddingHorizontal: isSmallScreen ? 8 : 10, paddingVertical: isSmallScreen ? 3 : 5, borderRadius: 8, backgroundColor: 'rgba(99,102,241,0.15)' },
  statusCompleted: { backgroundColor: 'rgba(139,92,246,0.15)' },
  statusCancelled: { backgroundColor: 'rgba(239,68,68,0.15)' },
  statusText: { fontSize: isSmallScreen ? 10 : 11, fontWeight: '700' as const, color: Colors.light.textSecondary, textTransform: 'capitalize' as const },
  title: { fontSize: isSmallScreen ? 14 : 16, fontWeight: '700' as const, color: Colors.light.text, marginBottom: isSmallScreen ? 6 : 10, lineHeight: isSmallScreen ? 19 : 22 },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: isSmallScreen ? 6 : 10 },
  teacherAvatar: { width: isSmallScreen ? 22 : 26, height: isSmallScreen ? 22 : 26, borderRadius: isSmallScreen ? 11 : 13, borderWidth: 1.5, borderColor: Colors.light.border },
  teacherName: { fontSize: isSmallScreen ? 12 : 13, fontWeight: '600' as const, color: Colors.light.textSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: isSmallScreen ? 8 : 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: isSmallScreen ? 11.5 : 13, color: Colors.light.textTertiary, fontWeight: '500' as const },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, paddingVertical: isSmallScreen ? 8 : 11, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  cancelBtnText: { fontSize: isSmallScreen ? 12 : 13, fontWeight: '700' as const, color: Colors.light.error },
  denied: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  deniedText: { fontSize: isSmallScreen ? 16 : 18, fontWeight: '600' as const, color: Colors.light.textSecondary },
  deniedBtn: { backgroundColor: Colors.light.primary, paddingHorizontal: isSmallScreen ? 16 : 20, paddingVertical: isSmallScreen ? 10 : 12, borderRadius: 14 },
  deniedBtnText: { fontSize: isSmallScreen ? 13.5 : 15, fontWeight: '700' as const, color: '#FFFFFF' },
  emptyWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: isSmallScreen ? 13 : 15, color: Colors.light.textTertiary, fontWeight: '500' as const },
});
