import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, TextInput, Alert, Modal } from 'react-native';
import { Stack } from 'expo-router';
import { Search, Ban, ShieldCheck, Coins, Star, MapPin, ArrowLeftRight, X, Crown, AlertCircle } from 'lucide-react-native';
import { useAdmin, BanStatus } from '@/providers/admin';

type FilterType = 'all' | 'active' | 'banned' | 'suspended';

export default function UserManagement() {
  const { users, banUser, unbanUser, suspendUser, updateUserCredits } = useAdmin();
  const [search, setSearch] = useState<string>('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState<boolean>(false);
  const [banReason, setBanReason] = useState<string>('');
  const [creditAmount, setCreditAmount] = useState<string>('');
  const [creditModalVisible, setCreditModalVisible] = useState<boolean>(false);

  const filteredUsers = useMemo(() => {
    let result = users;
    if (filter !== 'all') result = result.filter(u => u.banStatus === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return result;
  }, [users, filter, search]);

  const selectedUser = useMemo(() => users.find(u => u.id === selectedUserId), [users, selectedUserId]);

  const handleBan = useCallback(() => {
    if (!selectedUserId || !banReason.trim()) return;
    banUser(selectedUserId, banReason.trim());
    setActionModalVisible(false);
    setBanReason('');
    setSelectedUserId(null);
  }, [selectedUserId, banReason, banUser]);

  const handleSuspend = useCallback(() => {
    if (!selectedUserId || !banReason.trim()) return;
    suspendUser(selectedUserId, banReason.trim());
    setActionModalVisible(false);
    setBanReason('');
    setSelectedUserId(null);
  }, [selectedUserId, banReason, suspendUser]);

  const handleUnban = useCallback((userId: string) => {
    Alert.alert('Unban User', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unban', onPress: () => unbanUser(userId) },
    ]);
  }, [unbanUser]);

  const handleUpdateCredits = useCallback(() => {
    if (!selectedUserId) return;
    const amount = parseInt(creditAmount, 10);
    if (isNaN(amount) || amount < 0) { Alert.alert('Invalid Amount'); return; }
    updateUserCredits(selectedUserId, amount);
    setCreditModalVisible(false);
    setCreditAmount('');
    setSelectedUserId(null);
  }, [selectedUserId, creditAmount, updateUserCredits]);

  const statusColor = (s: BanStatus) => s === 'active' ? '#10B981' : s === 'banned' ? '#EF4444' : '#F59E0B';
  const statusBg = (s: BanStatus) => s === 'active' ? '#ECFDF5' : s === 'banned' ? '#FEF2F2' : '#FFFBEB';

  const filters: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' }, { label: 'Active', value: 'active' },
    { label: 'Banned', value: 'banned' }, { label: 'Suspended', value: 'suspended' },
  ];

  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: 'User Management', headerStyle: { backgroundColor: '#0F172A' }, headerTintColor: '#F8FAFC' }} />
      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Search size={18} color="#94A3B8" />
          <TextInput style={s.searchInput} placeholder="Search users..." placeholderTextColor="#94A3B8" value={search} onChangeText={setSearch} testID="user-search-input" />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><X size={16} color="#94A3B8" /></TouchableOpacity>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8 }}>
          {filters.map(f => (
            <TouchableOpacity key={f.value} style={[s.chip, filter === f.value && s.chipActive]} onPress={() => setFilter(f.value)}>
              <Text style={[s.chipText, filter === f.value && s.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {filteredUsers.map(user => (
          <View key={user.id} style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image source={{ uri: user.avatarUrl }} style={s.avatar} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.name} numberOfLines={1}>{user.name}</Text>
                  {user.premiumTier !== 'free' && <Crown size={14} color="#F59E0B" />}
                </View>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 1 }} numberOfLines={1}>{user.email}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <MapPin size={11} color="#94A3B8" /><Text style={{ fontSize: 11, color: '#94A3B8' }}>{user.location}</Text>
                </View>
              </View>
              <View style={[s.badge, { backgroundColor: statusBg(user.banStatus) }]}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statusColor(user.banStatus) }} />
                <Text style={{ fontSize: 11, fontWeight: '700' as const, color: statusColor(user.banStatus), textTransform: 'capitalize' as const }}>{user.banStatus}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Star size={13} color="#F59E0B" /><Text style={s.statText}>{user.rating.toFixed(1)}</Text></View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><ArrowLeftRight size={13} color="#8B5CF6" /><Text style={s.statText}>{user.totalSwaps} swaps</Text></View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Coins size={13} color="#10B981" /><Text style={s.statText}>{user.credits} credits</Text></View>
              {user.reportCount > 0 && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><AlertCircle size={13} color="#EF4444" /><Text style={[s.statText, { color: '#EF4444' }]}>{user.reportCount} reports</Text></View>}
            </View>
            {user.banReason && <View style={{ marginTop: 10, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10 }}><Text style={{ fontSize: 11, fontWeight: '700' as const, color: '#B91C1C' }}>Reason:</Text><Text style={{ fontSize: 12, color: '#991B1B', marginTop: 2 }}>{user.banReason}</Text></View>}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {user.banStatus === 'active' ? (
                <>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#FEF2F2' }]} onPress={() => { setSelectedUserId(user.id); setBanReason(''); setActionModalVisible(true); }} testID={`ban-user-${user.id}`}>
                    <Ban size={14} color="#EF4444" /><Text style={{ fontSize: 13, fontWeight: '600' as const, color: '#EF4444' }}>Ban / Suspend</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#EFF6FF' }]} onPress={() => { setSelectedUserId(user.id); setCreditAmount(user.credits?.toString() ?? '0'); setCreditModalVisible(true); }} testID={`edit-credits-${user.id}`}>
                    <Coins size={14} color="#3B82F6" /><Text style={{ fontSize: 13, fontWeight: '600' as const, color: '#3B82F6' }}>Credits</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#ECFDF5' }]} onPress={() => handleUnban(user.id)} testID={`unban-user-${user.id}`}>
                    <ShieldCheck size={14} color="#10B981" /><Text style={{ fontSize: 13, fontWeight: '600' as const, color: '#10B981' }}>Unban</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#EFF6FF' }]} onPress={() => { setSelectedUserId(user.id); setCreditAmount(user.credits?.toString() ?? '0'); setCreditModalVisible(true); }}>
                    <Coins size={14} color="#3B82F6" /><Text style={{ fontSize: 13, fontWeight: '600' as const, color: '#3B82F6' }}>Credits</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ))}
        {filteredUsers.length === 0 && <View style={{ alignItems: 'center', paddingTop: 60 }}><Text style={{ fontSize: 15, color: '#94A3B8' }}>No users found</Text></View>}
      </ScrollView>
      <Modal visible={actionModalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Take Action</Text>
            {selectedUser && <Text style={{ fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 16 }}>Against {selectedUser.name}</Text>}
            <TextInput style={s.modalInput} placeholder="Enter reason..." placeholderTextColor="#94A3B8" value={banReason} onChangeText={setBanReason} multiline testID="ban-reason-input" />
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#EF4444' }]} onPress={handleBan}><Ban size={16} color="#FFF" /><Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' as const }}>Ban</Text></TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#F59E0B' }]} onPress={handleSuspend}><Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' as const }}>Suspend</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 8 }} onPress={() => setActionModalVisible(false)}><Text style={{ fontSize: 14, fontWeight: '600' as const, color: '#94A3B8' }}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={creditModalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Edit Credits</Text>
            {selectedUser && <Text style={{ fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 16 }}>For {selectedUser.name}</Text>}
            <TextInput style={s.modalInput} placeholder="Credit amount" placeholderTextColor="#94A3B8" value={creditAmount} onChangeText={setCreditAmount} keyboardType="numeric" testID="credit-amount-input" />
            <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#3B82F6', marginBottom: 12 }]} onPress={handleUpdateCredits}><Coins size={16} color="#FFF" /><Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' as const }}>Update</Text></TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 8 }} onPress={() => setCreditModalVisible(false)}><Text style={{ fontSize: 14, fontWeight: '600' as const, color: '#94A3B8' }}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  searchWrap: { backgroundColor: '#FFF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 14, height: 44, gap: 10 },
  searchInput: { flex: 1, fontSize: 15, color: '#0F172A' },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  chipActive: { backgroundColor: '#0F172A' },
  chipText: { fontSize: 13, fontWeight: '600' as const, color: '#64748B' },
  chipTextActive: { color: '#FFF' },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  avatar: { width: 48, height: 48, borderRadius: 14, marginRight: 12 },
  name: { fontSize: 15, fontWeight: '700' as const, color: '#0F172A' },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 5 },
  statText: { fontSize: 12, fontWeight: '600' as const, color: '#64748B' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: '800' as const, color: '#0F172A' },
  modalInput: { backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0F172A', marginBottom: 16, minHeight: 48 },
  modalBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12 },
});
