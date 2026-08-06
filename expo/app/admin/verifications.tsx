import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, TextInput, Modal, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { ShieldCheck, ShieldX, Clock, CheckCircle, XCircle, Fingerprint, Mail, Phone, Linkedin, Briefcase, Filter, ExternalLink } from 'lucide-react-native';
import { useAdmin, VerificationRequest } from '@/providers/admin';
import type { VerificationStatus } from '@/types';

type VFilter = 'all' | 'pending' | 'verified' | 'rejected';

export default function VerificationApprovals() {
  const { verificationRequests, approveVerification, rejectVerification } = useAdmin();
  const [filter, setFilter] = useState<VFilter>('pending');
  const [rejectModalVisible, setRejectModalVisible] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const filteredRequests = useMemo(() => {
    if (filter === 'all') return verificationRequests;
    return verificationRequests.filter(vr => vr.status === filter);
  }, [verificationRequests, filter]);

  const pendingCount = useMemo(() => verificationRequests.filter(vr => vr.status === 'pending').length, [verificationRequests]);

  const handleApprove = useCallback((id: string) => {
    Alert.alert('Approve Verification', 'Mark as approved?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => approveVerification(id) },
    ]);
  }, [approveVerification]);

  const handleReject = useCallback(() => {
    if (!selectedId || !rejectReason.trim()) return;
    rejectVerification(selectedId, rejectReason.trim());
    setRejectModalVisible(false);
    setRejectReason('');
    setSelectedId(null);
  }, [selectedId, rejectReason, rejectVerification]);

  const typeIcon = (t: VerificationRequest['type']) => {
    const icons = { identity: Fingerprint, email: Mail, phone: Phone, linkedin: Linkedin, portfolio: Briefcase };
    return icons[t];
  };
  const typeColor = (t: VerificationRequest['type']) => {
    const colors = { identity: '#3B82F6', email: '#10B981', phone: '#8B5CF6', linkedin: '#0077B5', portfolio: '#F59E0B' };
    return colors[t];
  };
  const typeBg = (t: VerificationRequest['type']) => {
    const bgs = { identity: '#EFF6FF', email: '#ECFDF5', phone: '#F5F3FF', linkedin: '#E0F2FE', portfolio: '#FFFBEB' };
    return bgs[t];
  };
  const statusConfig = (st: VerificationStatus) => {
    if (st === 'pending') return { color: '#F59E0B', bg: '#FFFBEB', Icon: Clock };
    if (st === 'verified') return { color: '#10B981', bg: '#ECFDF5', Icon: CheckCircle };
    if (st === 'rejected') return { color: '#EF4444', bg: '#FEF2F2', Icon: XCircle };
    return { color: '#94A3B8', bg: '#F1F5F9', Icon: Clock };
  };

  const filters: { label: string; value: VFilter; count?: number }[] = [
    { label: 'Pending', value: 'pending', count: pendingCount },
    { label: 'Verified', value: 'verified' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'All', value: 'all' },
  ];

  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: 'Verifications', headerStyle: { backgroundColor: '#0F172A' }, headerTintColor: '#F8FAFC' }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap: 8 }}>
        {filters.map(f => (
          <TouchableOpacity key={f.value} style={[s.chip, filter === f.value && s.chipActive]} onPress={() => setFilter(f.value)}>
            <Text style={[s.chipText, filter === f.value && s.chipTextActive]}>{f.label}{f.count !== undefined && f.count > 0 ? ` (${f.count})` : ''}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {filteredRequests.map(vr => {
          const TypeIcon = typeIcon(vr.type);
          const sc = statusConfig(vr.status);
          return (
            <View key={vr.id} style={s.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image source={{ uri: vr.userAvatar }} style={s.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700' as const, color: '#0F172A' }}>{vr.userName}</Text>
                  <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                    {new Date(vr.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                  <sc.Icon size={13} color={sc.color} />
                  <Text style={{ fontSize: 11, fontWeight: '700' as const, color: sc.color, textTransform: 'capitalize' as const }}>{vr.status}</Text>
                </View>
              </View>
              <View style={{ marginTop: 12, marginBottom: 10 }}>
                <View style={[s.typeBadge, { backgroundColor: typeBg(vr.type) }]}>
                  <TypeIcon size={16} color={typeColor(vr.type)} />
                  <Text style={{ fontSize: 13, fontWeight: '700' as const, color: typeColor(vr.type), textTransform: 'capitalize' as const }}>{vr.type}</Text>
                </View>
              </View>
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 4 }}>
                <Text style={{ fontSize: 13, color: '#475569', lineHeight: 19 }}>{vr.details}</Text>
                {vr.documentUrl && (
                  <View style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden', height: 100 }}>
                    <Image source={{ uri: vr.documentUrl }} style={{ width: '100%', height: 100, borderRadius: 10 }} />
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(15,23,42,0.65)', paddingHorizontal: 12, paddingVertical: 6 }}>
                      <ExternalLink size={14} color="#FFF" /><Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600' as const }}>Document</Text>
                    </View>
                  </View>
                )}
              </View>
              {vr.status === 'pending' && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#10B981' }]} onPress={() => handleApprove(vr.id)} testID={`approve-verification-${vr.id}`}>
                    <ShieldCheck size={15} color="#FFF" /><Text style={s.actionText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#EF4444' }]} onPress={() => { setSelectedId(vr.id); setRejectReason(''); setRejectModalVisible(true); }} testID={`reject-verification-${vr.id}`}>
                    <ShieldX size={15} color="#FFF" /><Text style={s.actionText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
        {filteredRequests.length === 0 && <View style={{ alignItems: 'center', paddingTop: 60, gap: 8 }}><Filter size={40} color="#CBD5E1" /><Text style={{ fontSize: 16, fontWeight: '700' as const, color: '#64748B' }}>No requests found</Text></View>}
      </ScrollView>
      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={{ fontSize: 18, fontWeight: '800' as const, color: '#0F172A' }}>Reject Verification</Text>
            <Text style={{ fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 16 }}>Provide a reason</Text>
            <TextInput style={s.modalInput} placeholder="Reason..." placeholderTextColor="#94A3B8" value={rejectReason} onChangeText={setRejectReason} multiline testID="verification-reject-reason" />
            <TouchableOpacity style={[s.rejectBtn, !rejectReason.trim() && { opacity: 0.5 }]} onPress={handleReject} disabled={!rejectReason.trim()}>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' as const }}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 8 }} onPress={() => setRejectModalVisible(false)}>
              <Text style={{ fontSize: 14, fontWeight: '600' as const, color: '#94A3B8' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  filterRow: { backgroundColor: '#FFF', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  chipActive: { backgroundColor: '#0F172A' },
  chipText: { fontSize: 13, fontWeight: '600' as const, color: '#64748B' },
  chipTextActive: { color: '#FFF' },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  avatar: { width: 44, height: 44, borderRadius: 13, marginRight: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, alignSelf: 'flex-start' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  actionText: { color: '#FFF', fontSize: 14, fontWeight: '700' as const },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 },
  modalInput: { backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0F172A', marginBottom: 16, minHeight: 80, textAlignVertical: 'top' as const },
  rejectBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#EF4444', marginBottom: 12 },
});
