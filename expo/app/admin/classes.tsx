import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View, FlatList, TouchableOpacity, Image, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Users, Calendar, Coins, XCircle, ArrowLeft, Search, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { mockUsers } from '@/mocks/data';
import { useClasses } from '@/providers/classes';
import { useAdmin } from '@/providers/admin';
import type { ClassWithTeacher } from '@/types';

export default function AdminClassesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAdminAuthenticated } = useAdmin();
  const { getClassesWithTeachers, cancelClass } = useClasses();
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
    Alert.alert(
      'Cancel this class?',
      `"${cls.title}" by ${cls.teacher.name}. ${cls.enrolledCount} student${cls.enrolledCount === 1 ? '' : 's'} will be refunded.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Class',
          style: 'destructive',
          onPress: () => {
            cancelClass(cls.id);
            Alert.alert('Done', 'Class cancelled and students refunded.');
          },
        },
      ],
    );
  }, [cancelClass]);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const renderItem = useCallback(({ item }: { item: ClassWithTeacher }) => (
    <View style={s.card}>
      <Image source={{ uri: item.coverImageUrl }} style={s.cover} />
      <View style={s.cardBody}>
        <View style={s.cardHeader}>
          <Text style={s.catBadge}>{item.category}</Text>
          <View style={[s.statusPill, item.status === 'completed' && s.statusCompleted, item.status === 'cancelled' && s.statusCancelled]}>
            <Text style={s.statusText}>{item.status}</Text>
          </View>
        </View>
        <Text style={s.title} numberOfLines={2}>{item.title}</Text>
        <View style={s.teacherRow}>
          <Image source={{ uri: item.teacher.avatarUrl }} style={s.teacherAvatar} />
          <Text style={s.teacherName}>{item.teacher.name}</Text>
        </View>
        <View style={s.metaRow}>
          <View style={s.metaItem}>
            <Calendar size={13} color={Colors.light.textTertiary} />
            <Text style={s.metaText}>{formatDate(item.startISO)}</Text>
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
        {item.status === 'open' && (
          <TouchableOpacity style={s.cancelBtn} onPress={() => handleCancelClass(item)} activeOpacity={0.8}>
            <XCircle size={16} color={Colors.light.error} />
            <Text style={s.cancelBtnText}>Cancel Class</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  ), [handleCancelClass]);

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
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.backgroundSecondary },
  header: { backgroundColor: Colors.light.background, borderBottomWidth: 1, borderBottomColor: Colors.light.borderLight, paddingHorizontal: 20, paddingBottom: 14 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.light.backgroundTertiary, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' as const, color: Colors.light.text },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.light.backgroundTertiary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: Colors.light.border },
  searchInput: { flex: 1, fontSize: 15, color: Colors.light.text },
  listContent: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: Colors.light.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: Colors.light.borderLight, shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  cover: { width: '100%', height: 150, backgroundColor: Colors.light.backgroundTertiary },
  cardBody: { padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  catBadge: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.secondary, textTransform: 'uppercase' as const, letterSpacing: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(99,102,241,0.15)' },
  statusCompleted: { backgroundColor: 'rgba(139,92,246,0.15)' },
  statusCancelled: { backgroundColor: 'rgba(239,68,68,0.15)' },
  statusText: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.textSecondary, textTransform: 'capitalize' as const },
  title: { fontSize: 16, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 10, lineHeight: 22 },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  teacherAvatar: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: Colors.light.border },
  teacherName: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.textSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: Colors.light.textTertiary, fontWeight: '500' as const },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, paddingVertical: 11, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  cancelBtnText: { fontSize: 13, fontWeight: '700' as const, color: Colors.light.error },
  denied: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  deniedText: { fontSize: 18, fontWeight: '600' as const, color: Colors.light.textSecondary },
  deniedBtn: { backgroundColor: Colors.light.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  deniedBtnText: { fontSize: 15, fontWeight: '700' as const, color: '#FFFFFF' },
  emptyWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 15, color: Colors.light.textTertiary, fontWeight: '500' as const },
});
