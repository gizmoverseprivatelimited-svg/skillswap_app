import { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  Search,
  Ban,
  ShieldOff,
  ShieldCheck,
  Coins,
  Star,
  MapPin,
  ArrowLeftRight,
  X,
  Crown,
  AlertCircle,
  Filter,
} from 'lucide-react-native';
import { useAdmin, BanStatus } from '../../providers/admin';
import { useAlert } from '@/providers/alert';
import { resolveImageUrl } from '@/lib/resolveImageUrl';
import Colors from '@/constants/colors';

const DEMO_USER_IMAGE = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';

function UserAvatar({ uri, style }: { uri: string | undefined; style: any }) {
  const [imgSrc, setImgSrc] = useState<string>(resolveImageUrl(uri, DEMO_USER_IMAGE) || DEMO_USER_IMAGE);

  return (
    <Image
      source={{ uri: imgSrc }}
      style={style}
      onError={() => {
        if (imgSrc !== DEMO_USER_IMAGE) {
          setImgSrc(DEMO_USER_IMAGE);
        }
      }}
    />
  );
}

type FilterType = 'all' | 'active' | 'banned' | 'suspended';

export default function UserManagement() {
  const { users, banUser, unbanUser, suspendUser, updateUserCredits, isLoading } = useAdmin();
  const { showAlert } = useAlert();
  const [search, setSearch] = useState<string>('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState<boolean>(false);
  const [banReason, setBanReason] = useState<string>('');
  const [creditAmount, setCreditAmount] = useState<string>('');
  const [creditModalVisible, setCreditModalVisible] = useState<boolean>(false);

  const filteredUsers = useMemo(() => {
    let result = users;
    if (filter !== 'all') {
      result = result.filter(u => u.banStatus === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.location?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [users, filter, search]);

  const selectedUser = useMemo(() => {
    return users.find(u => u.id === selectedUserId);
  }, [users, selectedUserId]);

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
    showAlert('Unban User', 'Are you sure you want to unban this user?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unban', onPress: () => unbanUser(userId) },
    ]);
  }, [unbanUser, showAlert]);

  const handleUpdateCredits = useCallback(() => {
    if (!selectedUserId) return;
    const amount = parseInt(creditAmount, 10);
    if (isNaN(amount) || amount < 0) {
      showAlert('Invalid Amount', 'Please enter a valid number.');
      return;
    }
    updateUserCredits(selectedUserId, amount);
    setCreditModalVisible(false);
    setCreditAmount('');
    setSelectedUserId(null);
  }, [selectedUserId, creditAmount, updateUserCredits]);

  const openActionModal = useCallback((userId: string) => {
    
    setSelectedUserId(userId);
    setBanReason('');
    setActionModalVisible(true);
  }, []);

  const openCreditModal = useCallback((userId: string) => {
    const user = users.find(u => u.id === userId);
    setSelectedUserId(userId);
    setCreditAmount(user?.credits?.toString() ?? '0');
    setCreditModalVisible(true);
  }, [users]);

  const getStatusColor = (status: BanStatus) => {
    switch (status) {
      case 'active': return '#10B981';
      case 'banned': return '#EF4444';
      case 'suspended': return '#F59E0B';
    }
  };

  const getStatusBg = (status: BanStatus) => {
    switch (status) {
      case 'active': return '#ECFDF5';
      case 'banned': return '#FEF2F2';
      case 'suspended': return '#FFFBEB';
    }
  };

  const filters: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Banned', value: 'banned' },
    { label: 'Suspended', value: 'suspended' },
  ];

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: 'User Management', headerStyle: { backgroundColor: '#0F172A' }, headerTintColor: '#F8FAFC' }} />

      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Search size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            testID="user-search-input"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
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
        {filteredUsers.map(user => (
          <View key={user.id} style={styles.userCard}>
            <View style={styles.userHeader}>
              <UserAvatar uri={user.avatarUrl} style={styles.avatar} />
              <View style={styles.userInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName} numberOfLines={1}>{user.username ? `@${user.username}` : user.name} ({user.name})</Text>
                  {user.premiumTier !== 'free' && (
                    <Crown size={14} color="#F59E0B" />
                  )}
                </View>
                <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
                <View style={styles.metaRow}>
                  <MapPin size={11} color="#94A3B8" />
                  <Text style={styles.metaText}>{user.location}</Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusBg((user.banStatus || 'active') as BanStatus) }]}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor((user.banStatus || 'active') as BanStatus) }]} />
                <Text style={[styles.statusText, { color: getStatusColor((user.banStatus || 'active') as BanStatus) }]}>{user.banStatus || 'active'}</Text>
              </View>
            </View>

            <View style={styles.userStats}>
              <View style={styles.statItem}>
                <Star size={13} color="#F59E0B" />
                <Text style={styles.statText}>{user.rating.toFixed(1)}</Text>
              </View>
              <View style={styles.statItem}>
                <ArrowLeftRight size={13} color="#8B5CF6" />
                <Text style={styles.statText}>{user.totalSwaps} exchanges</Text>
              </View>
              <View style={styles.statItem}>
                <Coins size={13} color="#10B981" />
                <Text style={styles.statText}>{user.credits} credits</Text>
              </View>
              {!!user.reportCount && user.reportCount > 0 && (
                <View style={styles.statItem}>
                  <AlertCircle size={13} color="#EF4444" />
                  <Text style={[styles.statText, { color: '#EF4444' }]}>{user.reportCount} reports</Text>
                </View>
              )}
            </View>

            {user.banReason && (
              <View style={styles.banReasonWrap}>
                <Text style={styles.banReasonLabel}>Reason:</Text>
                <Text style={styles.banReasonText}>{user.banReason}</Text>
              </View>
            )}

            <View style={styles.actionRow}>
              {user.banStatus === 'active' ? (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnWarning]}
                    onPress={() => openActionModal(user.id)}
                    testID={`ban-user-${user.id}`}
                  >
                    <Ban size={14} color="#EF4444" />
                    <Text style={styles.actionBtnWarningText}>Ban / Suspend</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnNeutral]}
                    onPress={() => openCreditModal(user.id)}
                    testID={`edit-credits-${user.id}`}
                  >
                    <Coins size={14} color="#3B82F6" />
                    <Text style={styles.actionBtnNeutralText}>Credits</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnSuccess]}
                    onPress={() => handleUnban(user.id)}
                    testID={`unban-user-${user.id}`}
                  >
                    <ShieldCheck size={14} color="#10B981" />
                    <Text style={styles.actionBtnSuccessText}>Unban</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnNeutral]}
                    onPress={() => openCreditModal(user.id)}
                  >
                    <Coins size={14} color="#3B82F6" />
                    <Text style={styles.actionBtnNeutralText}>Credits</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ))}

        {filteredUsers.length === 0 && (
          <View style={styles.empty}>
            <Filter size={40} color="#CBD5E1" />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={actionModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Take Action</Text>
             {selectedUser && <Text style={styles.modalSubtitle}>Against {selectedUser.username ? `@${selectedUser.username}` : selectedUser.name}</Text>}
            <TextInput
              style={styles.modalInput}
              placeholder="Enter reason..."
              placeholderTextColor="#94A3B8"
              value={banReason}
              onChangeText={setBanReason}
              multiline
              testID="ban-reason-input"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnDanger]} onPress={handleBan}>
                <Ban size={16} color="#FFFFFF" />
                <Text style={styles.modalBtnDangerText}>Ban</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnWarn]} onPress={handleSuspend}>
                <ShieldOff size={16} color="#FFFFFF" />
                <Text style={styles.modalBtnWarnText}>Suspend</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setActionModalVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={creditModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Credits</Text>
             {selectedUser && <Text style={styles.modalSubtitle}>For {selectedUser.username ? `@${selectedUser.username}` : selectedUser.name}</Text>}
            <TextInput
              style={styles.modalInput}
              placeholder="Credit amount"
              placeholderTextColor="#94A3B8"
              value={creditAmount}
              onChangeText={setCreditAmount}
              keyboardType="numeric"
              testID="credit-amount-input"
            />
            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleUpdateCredits}>
              <Coins size={16} color="#FFFFFF" />
              <Text style={styles.modalBtnPrimaryText}>Update Credits</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setCreditModalVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  searchWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
  },
  filterRow: {
    marginTop: 10,
    marginBottom: 4,
  },
  filterContent: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: '#0F172A',
  },
  filterChipText: {
    fontSize: 13,
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
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  userEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'capitalize' as const,
  },
  userStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#64748B',
  },
  banReasonWrap: {
    marginTop: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 10,
  },
  banReasonLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#B91C1C',
  },
  banReasonText: {
    fontSize: 12,
    color: '#991B1B',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionBtnWarning: {
    backgroundColor: '#FEF2F2',
  },
  actionBtnWarningText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#EF4444',
  },
  actionBtnNeutral: {
    backgroundColor: '#EFF6FF',
  },
  actionBtnNeutralText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#3B82F6',
  },
  actionBtnSuccess: {
    backgroundColor: '#ECFDF5',
  },
  actionBtnSuccessText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#94A3B8',
    fontWeight: '500' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 16,
    minHeight: 48,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalBtnDanger: {
    backgroundColor: '#EF4444',
  },
  modalBtnDangerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  modalBtnWarn: {
    backgroundColor: '#F59E0B',
  },
  modalBtnWarnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  modalBtnPrimary: {
    backgroundColor: '#3B82F6',
    marginBottom: 12,
  },
  modalBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#94A3B8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
});
