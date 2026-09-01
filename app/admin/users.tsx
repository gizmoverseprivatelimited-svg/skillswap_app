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

  const [actionType, setActionType] = useState<'ban' | 'suspend'>('suspend');
  const [suspendDays, setSuspendDays] = useState<string>('7');

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
    if (!selectedUserId || !banReason.trim()) {
      showAlert('Reason Required', 'Please provide a reason for the permanent ban.');
      return;
    }
    showAlert('Permanent Ban', 'Are you sure you want to permanently ban this user? They will not be able to access the platform until manually unbanned.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Permanently Ban',
        style: 'destructive',
        onPress: () => {
          banUser(selectedUserId, banReason.trim());
          setActionModalVisible(false);
          setBanReason('');
          setSelectedUserId(null);
        },
      },
    ]);
  }, [selectedUserId, banReason, banUser, showAlert]);

  const handleSuspend = useCallback(() => {
    if (!selectedUserId || !banReason.trim()) {
      showAlert('Reason Required', 'Please provide a reason for the suspension.');
      return;
    }
    const days = parseInt(suspendDays, 10);
    if (isNaN(days) || days <= 0) {
      showAlert('Invalid Duration', 'Please enter a valid number of days (at least 1 day).');
      return;
    }
    suspendUser(selectedUserId, banReason.trim(), days);
    setActionModalVisible(false);
    setBanReason('');
    setSuspendDays('7');
    setSelectedUserId(null);
  }, [selectedUserId, banReason, suspendDays, suspendUser, showAlert]);

  const handleUnban = useCallback((userId: string) => {
    showAlert('Unban / Restore User', 'Are you sure you want to restore access for this user?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restore Access', onPress: () => unbanUser(userId) },
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
  }, [selectedUserId, creditAmount, updateUserCredits, showAlert]);

  const openActionModal = useCallback((userId: string, defaultAction: 'ban' | 'suspend' = 'suspend') => {
    setSelectedUserId(userId);
    setActionType(defaultAction);
    setBanReason('');
    setSuspendDays('7');
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

            {user.banStatus === 'suspended' && (
              <View style={styles.suspendDetailWrap}>
                <Text style={styles.suspendDetailLabel}>
                  ⏳ Suspended for {user.daysSuspended || 'specified'} days
                  {user.suspendedUntil ? ` (Until: ${new Date(user.suspendedUntil).toLocaleDateString()})` : ''}
                </Text>
              </View>
            )}

            {user.banReason && (
              <View style={[styles.banReasonWrap, user.banStatus === 'suspended' && styles.suspendReasonWrap]}>
                <Text style={[styles.banReasonLabel, user.banStatus === 'suspended' && styles.suspendReasonLabel]}>
                  {user.banStatus === 'banned' ? 'Permanent Ban Reason:' : 'Suspension Reason:'}
                </Text>
                <Text style={[styles.banReasonText, user.banStatus === 'suspended' && styles.suspendReasonText]}>{user.banReason}</Text>
              </View>
            )}

            <View style={styles.actionRow}>
              {user.banStatus === 'active' ? (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnWarning]}
                    onPress={() => openActionModal(user.id, 'suspend')}
                    testID={`suspend-user-${user.id}`}
                  >
                    <ShieldOff size={14} color="#F59E0B" />
                    <Text style={styles.actionBtnWarningText}>Suspend</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnDanger]}
                    onPress={() => openActionModal(user.id, 'ban')}
                    testID={`ban-user-${user.id}`}
                  >
                    <Ban size={14} color="#EF4444" />
                    <Text style={styles.actionBtnDangerText}>Ban</Text>
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
                    <Text style={styles.actionBtnSuccessText}>Restore Access</Text>
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

      {/* Action Modal (Ban / Suspend) */}
      <Modal visible={actionModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {actionType === 'suspend' ? 'Suspend User' : 'Permanently Ban User'}
            </Text>
            {selectedUser && (
              <Text style={styles.modalSubtitle}>
                Target: {selectedUser.username ? `@${selectedUser.username}` : selectedUser.name} ({selectedUser.email})
              </Text>
            )}

            {/* Switch between Suspend and Ban tabs */}
            <View style={styles.actionTypeTabs}>
              <TouchableOpacity
                style={[styles.actionTypeTab, actionType === 'suspend' && styles.actionTypeTabActiveSuspend]}
                onPress={() => setActionType('suspend')}
              >
                <ShieldOff size={14} color={actionType === 'suspend' ? '#FFFFFF' : '#64748B'} />
                <Text style={[styles.actionTypeTabText, actionType === 'suspend' && styles.actionTypeTabTextActive]}>Suspend (Timed)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionTypeTab, actionType === 'ban' && styles.actionTypeTabActiveBan]}
                onPress={() => setActionType('ban')}
              >
                <Ban size={14} color={actionType === 'ban' ? '#FFFFFF' : '#64748B'} />
                <Text style={[styles.actionTypeTabText, actionType === 'ban' && styles.actionTypeTabTextActive]}>Ban (Permanent)</Text>
              </TouchableOpacity>
            </View>

            {actionType === 'suspend' ? (
              <View style={styles.suspendFieldsWrap}>
                <Text style={styles.fieldLabel}>Suspension Duration (Days):</Text>
                <View style={styles.daysPresetsRow}>
                  {['1', '3', '7', '14', '30'].map(d => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.dayPresetBtn, suspendDays === d && styles.dayPresetBtnActive]}
                      onPress={() => setSuspendDays(d)}
                    >
                      <Text style={[styles.dayPresetBtnText, suspendDays === d && styles.dayPresetBtnTextActive]}>
                        {d}d
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.daysInput}
                  placeholder="Custom number of days..."
                  placeholderTextColor="#94A3B8"
                  value={suspendDays}
                  onChangeText={setSuspendDays}
                  keyboardType="numeric"
                />
                <Text style={styles.fieldHint}>
                  User will be blocked for {suspendDays || '0'} day(s) and automatically restored after.
                </Text>
              </View>
            ) : (
              <View style={styles.banNoticeBox}>
                <Text style={styles.banNoticeTitle}>⚠️ Permanent Ban Notice</Text>
                <Text style={styles.banNoticeDesc}>
                  The user will remain permanently banned until an administrator manually restores their account.
                </Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Reason for {actionType === 'suspend' ? 'Suspension' : 'Ban'}:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter violation reason details..."
              placeholderTextColor="#94A3B8"
              value={banReason}
              onChangeText={setBanReason}
              multiline
              testID="ban-reason-input"
            />

            <View style={styles.modalActions}>
              {actionType === 'suspend' ? (
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnWarn]} onPress={handleSuspend}>
                  <ShieldOff size={16} color="#FFFFFF" />
                  <Text style={styles.modalBtnWarnText}>Confirm Suspension ({suspendDays}d)</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnDanger]} onPress={handleBan}>
                  <Ban size={16} color="#FFFFFF" />
                  <Text style={styles.modalBtnDangerText}>Confirm Permanent Ban</Text>
                </TouchableOpacity>
              )}
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
    backgroundColor: '#FFFBEB',
  },
  actionBtnWarningText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#D97706',
  },
  actionBtnDanger: {
    backgroundColor: '#FEF2F2',
  },
  actionBtnDangerText: {
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
  suspendDetailWrap: {
    marginTop: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  suspendDetailLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#92400E',
  },
  suspendReasonWrap: {
    backgroundColor: '#FFFBEB',
  },
  suspendReasonLabel: {
    color: '#B45309',
  },
  suspendReasonText: {
    color: '#92400E',
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
    maxWidth: 420,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 14,
  },
  actionTypeTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 6,
  },
  actionTypeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  actionTypeTabActiveSuspend: {
    backgroundColor: '#F59E0B',
  },
  actionTypeTabActiveBan: {
    backgroundColor: '#EF4444',
  },
  actionTypeTabText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#64748B',
  },
  actionTypeTabTextActive: {
    color: '#FFFFFF',
  },
  suspendFieldsWrap: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#334155',
    marginBottom: 6,
  },
  daysPresetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  dayPresetBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayPresetBtnActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  dayPresetBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#475569',
  },
  dayPresetBtnTextActive: {
    color: '#B45309',
  },
  daysInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
  },
  fieldHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  banNoticeBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  banNoticeTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#991B1B',
    marginBottom: 2,
  },
  banNoticeDesc: {
    fontSize: 12,
    color: '#B91C1C',
    lineHeight: 16,
  },
  modalInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 16,
    minHeight: 56,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
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
