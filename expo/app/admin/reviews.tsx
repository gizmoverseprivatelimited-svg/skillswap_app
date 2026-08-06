import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Star, CheckCircle, XCircle, AlertTriangle, Clock, Filter, MessageSquare } from 'lucide-react-native';
import { useAdmin } from '@/providers/admin';

type ReviewFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'flagged';

export default function ReviewModeration() {
  const { reviews, approveReview, rejectReview } = useAdmin();
  const [filter, setFilter] = useState<ReviewFilter>('pending');
  const [rejectModalVisible, setRejectModalVisible] = useState<boolean>(false);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<string>('');

  const filteredReviews = useMemo(() => {
    if (filter === 'all') return reviews;
    if (filter === 'flagged') return reviews.filter(r => r.flaggedAt);
    return reviews.filter(r => r.moderationStatus === filter);
  }, [reviews, filter]);

  const handleApprove = useCallback((reviewId: string) => {
    Alert.alert('Approve Review', 'This review will be visible to all users.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => approveReview(reviewId) },
    ]);
  }, [approveReview]);

  const handleReject = useCallback(() => {
    if (!selectedReviewId || !rejectNote.trim()) return;
    rejectReview(selectedReviewId, rejectNote.trim());
    setRejectModalVisible(false);
    setRejectNote('');
    setSelectedReviewId(null);
  }, [selectedReviewId, rejectNote, rejectReview]);

  const renderStars = (rating: number) => Array.from({ length: 5 }, (_, i) => (
    <Star key={i} size={13} color={i < rating ? '#F59E0B' : '#E2E8F0'} fill={i < rating ? '#F59E0B' : 'none'} />
  ));

  const statusIcon = (st: string) => st === 'pending' ? <Clock size={14} color="#F59E0B" /> : st === 'approved' ? <CheckCircle size={14} color="#10B981" /> : <XCircle size={14} color="#EF4444" />;
  const statusStyle = (st: string) => st === 'pending' ? { bg: '#FFFBEB', text: '#92400E' } : st === 'approved' ? { bg: '#ECFDF5', text: '#065F46' } : { bg: '#FEF2F2', text: '#991B1B' };

  const filters: { label: string; value: ReviewFilter; count?: number }[] = [
    { label: 'Pending', value: 'pending', count: reviews.filter(r => r.moderationStatus === 'pending').length },
    { label: 'Flagged', value: 'flagged', count: reviews.filter(r => r.flaggedAt).length },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'All', value: 'all' },
  ];

  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: 'Review Moderation', headerStyle: { backgroundColor: '#0F172A' }, headerTintColor: '#F8FAFC' }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap: 8 }}>
        {filters.map(f => (
          <TouchableOpacity key={f.value} style={[s.chip, filter === f.value && s.chipActive]} onPress={() => setFilter(f.value)}>
            <Text style={[s.chipText, filter === f.value && s.chipTextActive]}>{f.label}{f.count !== undefined && f.count > 0 ? ` (${f.count})` : ''}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {filteredReviews.map(review => {
          const ss = statusStyle(review.moderationStatus);
          return (
            <View key={review.id} style={s.card}>
              {review.flaggedAt && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 10, padding: 10, marginBottom: 12 }}>
                  <AlertTriangle size={14} color="#B45309" /><Text style={{ flex: 1, fontSize: 12, fontWeight: '600' as const, color: '#92400E' }}>Flagged: {review.flagReason ?? 'No reason given'}</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700' as const, color: '#0F172A' }}>{review.reviewerName}</Text>
                  <Text style={{ fontSize: 12, color: '#94A3B8' }}>→</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600' as const, color: '#3B82F6' }}>{review.revieweeName}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: ss.bg }]}>
                  {statusIcon(review.moderationStatus)}
                  <Text style={{ fontSize: 11, fontWeight: '700' as const, color: ss.text, textTransform: 'capitalize' as const }}>{review.moderationStatus}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 2, marginBottom: 10 }}>{renderStars(review.rating)}</View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                <MessageSquare size={14} color="#94A3B8" /><Text style={{ flex: 1, fontSize: 13, color: '#334155', lineHeight: 19 }}>{review.comment}</Text>
              </View>
              <Text style={{ fontSize: 11, color: '#94A3B8' }}>{new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              {review.moderationNote && <View style={{ marginTop: 8, backgroundColor: '#F1F5F9', borderRadius: 10, padding: 10 }}><Text style={{ fontSize: 11, fontWeight: '700' as const, color: '#64748B' }}>Note:</Text><Text style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{review.moderationNote}</Text></View>}
              {review.moderationStatus === 'pending' && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#10B981' }]} onPress={() => handleApprove(review.id)} testID={`approve-review-${review.id}`}>
                    <CheckCircle size={15} color="#FFF" /><Text style={s.actionText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#EF4444' }]} onPress={() => { setSelectedReviewId(review.id); setRejectNote(''); setRejectModalVisible(true); }} testID={`reject-review-${review.id}`}>
                    <XCircle size={15} color="#FFF" /><Text style={s.actionText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
        {filteredReviews.length === 0 && <View style={{ alignItems: 'center', paddingTop: 60, gap: 8 }}><Filter size={40} color="#CBD5E1" /><Text style={{ fontSize: 16, fontWeight: '700' as const, color: '#64748B' }}>No reviews found</Text></View>}
      </ScrollView>
      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Reject Review</Text>
            <Text style={{ fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 16 }}>Please provide a reason</Text>
            <TextInput style={s.modalInput} placeholder="Reason for rejection..." placeholderTextColor="#94A3B8" value={rejectNote} onChangeText={setRejectNote} multiline testID="reject-reason-input" />
            <TouchableOpacity style={[s.rejectBtn, !rejectNote.trim() && { opacity: 0.5 }]} onPress={handleReject} disabled={!rejectNote.trim()}>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' as const }}>Reject Review</Text>
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
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  actionText: { color: '#FFF', fontSize: 14, fontWeight: '700' as const },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: '800' as const, color: '#0F172A' },
  modalInput: { backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0F172A', marginBottom: 16, minHeight: 80, textAlignVertical: 'top' as const },
  rejectBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#EF4444', marginBottom: 12 },
});
