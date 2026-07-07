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
  ShieldCheck,
  ShieldX,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Fingerprint,
  Mail,
  Phone,
  Linkedin,
  Briefcase,
  Filter,
  ExternalLink,
} from 'lucide-react-native';
import { useAdmin, VerificationRequest } from '@/providers/admin';
import { useAlert } from '@/providers/alert';
import type { VerificationStatus } from '@/types';
import url from '@/constants/backurl';
import Colors from '@/constants/colors';

type VFilter = 'all' | 'pending' | 'verified' | 'rejected';

export default function VerificationApprovals() {
  const { verificationRequests, approveVerification, rejectVerification, isLoading } = useAdmin();
  const { showAlert } = useAlert();
  const [filter, setFilter] = useState<VFilter>('pending');
  const [rejectModalVisible, setRejectModalVisible] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const filteredRequests = useMemo(() => {
    if (filter === 'all') return verificationRequests;
    return verificationRequests.filter(vr => vr.status === filter);
  }, [verificationRequests, filter]);

  const pendingCount = useMemo(() =>
    verificationRequests.filter(vr => vr.status === 'pending').length
    , [verificationRequests]);

  const handleApprove = useCallback((id: string) => {
    showAlert('Approve Verification', 'This will mark the verification as approved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => approveVerification(id) },
    ]);
  }, [approveVerification, showAlert]);

  const openRejectModal = useCallback((id: string) => {
    setSelectedId(id);
    setRejectReason('');
    setRejectModalVisible(true);
  }, []);

  const handleReject = useCallback(() => {
    if (!selectedId || !rejectReason.trim()) return;
    rejectVerification(selectedId, rejectReason.trim());
    setRejectModalVisible(false);
    setRejectReason('');
    setSelectedId(null);
  }, [selectedId, rejectReason, rejectVerification]);

  const getTypeIcon = (type: VerificationRequest['type']) => {
    switch (type) {
      case 'identity': return Fingerprint;
      case 'email': return Mail;
      case 'phone': return Phone;
      case 'linkedin': return Linkedin;
      case 'portfolio': return Briefcase;
    }
  };

  const getTypeColor = (type: VerificationRequest['type']) => {
    switch (type) {
      case 'identity': return '#3B82F6';
      case 'email': return '#10B981';
      case 'phone': return '#8B5CF6';
      case 'linkedin': return '#0077B5';
      case 'portfolio': return '#F59E0B';
    }
  };

  const getTypeBg = (type: VerificationRequest['type']) => {
    switch (type) {
      case 'identity': return '#EFF6FF';
      case 'email': return '#ECFDF5';
      case 'phone': return '#F5F3FF';
      case 'linkedin': return '#E0F2FE';
      case 'portfolio': return '#FFFBEB';
    }
  };

  const getStatusConfig = (status: VerificationStatus) => {
    switch (status) {
      case 'pending': return { color: '#F59E0B', bg: '#FFFBEB', icon: Clock };
      case 'verified': return { color: '#10B981', bg: '#ECFDF5', icon: CheckCircle };
      case 'rejected': return { color: '#EF4444', bg: '#FEF2F2', icon: XCircle };
      default: return { color: '#94A3B8', bg: '#F1F5F9', icon: Clock };
    }
  };

  const filters: { label: string; value: VFilter; count?: number }[] = [
    { label: 'Pending', value: 'pending', count: pendingCount },
    { label: 'Verified', value: 'verified' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'All', value: 'all' },
  ];

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Verifications', headerStyle: { backgroundColor: '#0F172A' }, headerTintColor: '#F8FAFC' }} />

      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
          {filters.map(f => (
            <TouchableOpacity
              key={f.value}
              style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
              onPress={() => setFilter(f.value)}
            >
              <Text style={[styles.filterChipText, filter === f.value && styles.filterChipTextActive]}>
                {f.label}{f.count !== undefined && f.count > 0 ? ` (${f.count})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {filteredRequests.map(vr => {
          const TypeIcon = getTypeIcon(vr.type);
          const typeColor = getTypeColor(vr.type);
          const typeBg = getTypeBg(vr.type);
          const statusConfig = getStatusConfig(vr.status);
          const StatusIcon = statusConfig.icon;

          return (
            <View key={vr.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Image source={{ uri: vr.userAvatar ? (vr.userAvatar.startsWith('/uploads') ? `${url}${vr.userAvatar}` : vr.userAvatar) : 'https://i.pravatar.cc/150?img=5' }} style={styles.avatar} />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{vr.userName}</Text>
                  <Text style={styles.cardDate}>
                    Submitted {new Date(vr.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                  <StatusIcon size={13} color={statusConfig.color} />
                  <Text style={[styles.statusText, { color: statusConfig.color }]}>{vr.status}</Text>
                </View>
              </View>

              <View style={styles.typeRow}>
                <View style={[styles.typeBadge, { backgroundColor: typeBg }]}>
                  <TypeIcon size={16} color={typeColor} />
                  <Text style={[styles.typeText, { color: typeColor }]}>{vr.type}</Text>
                </View>
              </View>

              <View style={styles.detailsWrap}>
                <Text style={styles.detailsText}>{vr.details}</Text>
                {vr.documentUrl && (
                  <View style={styles.docPreview}>
                    <Image source={{ uri: vr.documentUrl }} style={styles.docImage} />
                    <View style={styles.docOverlay}>
                      <ExternalLink size={16} color="#FFFFFF" />
                      <Text style={styles.docOverlayText}>Document</Text>
                    </View>
                  </View>
                )}
              </View>

              {vr.status === 'pending' && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnApprove]}
                    onPress={() => handleApprove(vr.id)}
                    testID={`approve-verification-${vr.id}`}
                  >
                    <ShieldCheck size={15} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnReject]}
                    onPress={() => openRejectModal(vr.id)}
                    testID={`reject-verification-${vr.id}`}
                  >
                    <ShieldX size={15} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {filteredRequests.length === 0 && (
          <View style={styles.empty}>
            <Filter size={40} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No requests found</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'pending' ? 'All verifications handled!' : 'Try a different filter'}
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject Verification</Text>
            <Text style={styles.modalSubtitle}>Provide a reason for the user</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Reason for rejection..."
              placeholderTextColor="#94A3B8"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              testID="verification-reject-reason"
            />
            <TouchableOpacity
              style={[styles.modalBtn, !rejectReason.trim() && styles.modalBtnDisabled]}
              onPress={handleReject}
              disabled={!rejectReason.trim()}
            >
              <Text style={styles.modalBtnText}>Reject Verification</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setRejectModalVisible(false)}>
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
  filterWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterRow: {
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 13,
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  cardDate: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'capitalize' as const,
  },
  typeRow: {
    marginTop: 12,
    marginBottom: 10,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  typeText: {
    fontSize: 13,
    fontWeight: '700' as const,
    textTransform: 'capitalize' as const,
  },
  detailsWrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },
  detailsText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  docPreview: {
    marginTop: 10,
    borderRadius: 10,
    overflow: 'hidden',
    height: 120,
  },
  docImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
  },
  docOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  docOverlayText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionBtnApprove: {
    backgroundColor: '#10B981',
  },
  actionBtnReject: {
    backgroundColor: '#EF4444',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#64748B',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
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
    minHeight: 80,
    textAlignVertical: 'top' as const,
  },
  modalBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    marginBottom: 12,
  },
  modalBtnDisabled: {
    opacity: 0.5,
  },
  modalBtnText: {
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
