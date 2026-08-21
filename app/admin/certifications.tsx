import { useCallback, useMemo, useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, TextInput, Modal, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { BadgeCheck, ShieldX, Clock, CheckCircle, XCircle, Award, FileCheck2, Filter, ExternalLink, X, Eye } from 'lucide-react-native';
import { useAdmin, CertificationRequest, CertificationStatus } from '@/providers/admin';
import { resolveImageUrl } from '@/lib/resolveImageUrl';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
const DEFAULT_CERT_IMAGE = 'https://images.unsplash.com/photo-1589330694653-ded6df03f754?w=800';

type CFilter = 'all' | CertificationStatus;

function CertificateDocImage({ uri, onPress }: { uri?: string; onPress: () => void }) {
  const currentUri = uri || DEFAULT_CERT_IMAGE;
  const [imgSrc, setImgSrc] = useState<string>(currentUri);

  useEffect(() => {
    if (uri) {
      setImgSrc(uri);
    }
  }, [uri]);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={s.docPreviewWrap}>
      <Image
        source={{ uri: imgSrc }}
        style={s.docImage}
        resizeMode="contain"
        onError={(err) => {
          console.warn('[Admin] Certificate image load error:', err?.nativeEvent);
          setImgSrc(DEFAULT_CERT_IMAGE);
        }}
      />
      <View style={s.docOverlay}>
        <Eye size={14} color="#FFF" />
        <Text style={s.docOverlayText}>Tap to view full certificate</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function CertificationApprovals() {
  const { certificationRequests, approveCertification, rejectCertification } = useAdmin();
  const [filter, setFilter] = useState<CFilter>('pending');
  const [rejectModalVisible, setRejectModalVisible] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const filteredRequests = useMemo(() => {
    if (filter === 'all') return certificationRequests;
    return certificationRequests.filter(cr => cr.status === filter);
  }, [certificationRequests, filter]);

  const pendingCount = useMemo(
    () => certificationRequests.filter(cr => cr.status === 'pending').length,
    [certificationRequests],
  );

  const handleApprove = useCallback((id: string) => {
    Alert.alert('Approve Certification', 'Mark this skill certificate as verified?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => approveCertification(id) },
    ]);
  }, [approveCertification]);

  const handleReject = useCallback(() => {
    if (!selectedId || !rejectReason.trim()) return;
    rejectCertification(selectedId, rejectReason.trim());
    setRejectModalVisible(false);
    setRejectReason('');
    setSelectedId(null);
  }, [selectedId, rejectReason, rejectCertification]);

  const statusConfig = (st: CertificationStatus) => {
    if (st === 'approved') return { color: '#10B981', bg: '#ECFDF5', Icon: CheckCircle };
    if (st === 'rejected') return { color: '#EF4444', bg: '#FEF2F2', Icon: XCircle };
    return { color: '#F59E0B', bg: '#FFFBEB', Icon: Clock };
  };

  const filters: { label: string; value: CFilter; count?: number }[] = [
    { label: 'Pending', value: 'pending', count: pendingCount },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'All', value: 'all' },
  ];

  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: 'Certifications', headerStyle: { backgroundColor: '#0F172A' }, headerTintColor: '#F8FAFC' }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap: 8 }}>
        {filters.map(f => (
          <TouchableOpacity key={f.value} style={[s.chip, filter === f.value && s.chipActive]} onPress={() => setFilter(f.value)}>
            <Text style={[s.chipText, filter === f.value && s.chipTextActive]}>{f.label}{f.count !== undefined && f.count > 0 ? ` (${f.count})` : ''}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {filteredRequests.map(cr => {
          const sc = statusConfig(cr.status);
          const docUri = cr.documentUri || DEFAULT_CERT_IMAGE;

          return (
            <View key={cr.id} style={s.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image source={{ uri: resolveImageUrl(cr.userAvatar, DEFAULT_AVATAR) || DEFAULT_AVATAR }} style={s.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700' as const, color: '#0F172A' }}>{cr.userName}</Text>
                  <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                    Submitted {new Date(cr.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                  <sc.Icon size={13} color={sc.color} />
                  <Text style={{ fontSize: 11, fontWeight: '700' as const, color: sc.color, textTransform: 'capitalize' as const }}>{cr.status}</Text>
                </View>
              </View>
              <View style={{ marginTop: 12, marginBottom: 10 }}>
                <View style={s.skillBadge}>
                  <Award size={16} color="#0EA5E9" />
                  <Text style={{ fontSize: 13, fontWeight: '700' as const, color: '#0EA5E9', flexShrink: 1 }} numberOfLines={1}>{cr.skillTitle}</Text>
                </View>
              </View>
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <FileCheck2 size={14} color="#64748B" />
                  <Text style={{ fontSize: 13, color: '#475569', fontWeight: '500' as const }}>Skill certificate document</Text>
                </View>
                <CertificateDocImage
                  uri={cr.documentUri}
                  onPress={() => setPreviewUri(docUri)}
                />
              </View>
              {cr.reviewNote && (
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 8, fontStyle: 'italic' as const }}>Review note: {cr.reviewNote}</Text>
              )}
              {cr.status === 'pending' && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#10B981' }]} onPress={() => handleApprove(cr.id)} testID={`approve-certification-${cr.id}`}>
                    <BadgeCheck size={15} color="#FFF" /><Text style={s.actionText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#EF4444' }]} onPress={() => { setSelectedId(cr.id); setRejectReason(''); setRejectModalVisible(true); }} testID={`reject-certification-${cr.id}`}>
                    <ShieldX size={15} color="#FFF" /><Text style={s.actionText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
        {filteredRequests.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 8 }}>
            <Filter size={40} color="#CBD5E1" />
            <Text style={{ fontSize: 16, fontWeight: '700' as const, color: '#64748B' }}>No certification requests</Text>
            <Text style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center' }}>Teachers' uploaded skill certificates will appear here for review</Text>
          </View>
        )}
      </ScrollView>

      {/* Reject Modal */}
      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={{ fontSize: 18, fontWeight: '800' as const, color: '#0F172A' }}>Reject Certification</Text>
            <Text style={{ fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 16 }}>Provide a reason — the teacher will be able to re-upload a valid document.</Text>
            <TextInput style={s.modalInput} placeholder="Reason (e.g. document unreadable)..." placeholderTextColor="#94A3B8" value={rejectReason} onChangeText={setRejectReason} multiline testID="certification-reject-reason" />
            <TouchableOpacity style={[s.rejectBtn, !rejectReason.trim() && { opacity: 0.5 }]} onPress={handleReject} disabled={!rejectReason.trim()}>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' as const }}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 8 }} onPress={() => setRejectModalVisible(false)}>
              <Text style={{ fontSize: 14, fontWeight: '600' as const, color: '#94A3B8' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Full Size Image Preview Modal */}
      <Modal visible={Boolean(previewUri)} transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
        <View style={s.previewModalOverlay}>
          <TouchableOpacity style={s.closePreviewBtn} onPress={() => setPreviewUri(null)}>
            <X size={20} color="#FFF" />
          </TouchableOpacity>
          {previewUri && (
            <Image
              source={{ uri: previewUri }}
              style={s.fullPreviewImage}
              resizeMode="contain"
            />
          )}
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
  avatar: { width: 44, height: 44, borderRadius: 13, marginRight: 12, backgroundColor: '#E2E8F0' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  skillBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, alignSelf: 'flex-start', backgroundColor: '#E0F2FE' },
  docPreviewWrap: { borderRadius: 12, overflow: 'hidden', height: 180, backgroundColor: '#F8FAFC', position: 'relative', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  docImage: { width: '100%', height: 180, borderRadius: 12 },
  docOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(15,23,42,0.7)', paddingHorizontal: 12, paddingVertical: 8 },
  docOverlayText: { color: '#FFF', fontSize: 12, fontWeight: '600' as const },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  actionText: { color: '#FFF', fontSize: 14, fontWeight: '700' as const },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 },
  modalInput: { backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0F172A', marginBottom: 16, minHeight: 80, textAlignVertical: 'top' as const },
  rejectBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#EF4444', marginBottom: 12 },
  previewModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  closePreviewBtn: { position: 'absolute', top: 44, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  fullPreviewImage: { width: '100%', height: '80%' },
});
