import { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  Star,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Filter,
  MessageSquare,
} from 'lucide-react-native';
import { useAdmin } from '../../providers/admin';
import { useAlert } from '@/providers/alert';

type ReviewFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'flagged';

export default function ReviewModeration() {
  const { reviews, approveReview, rejectReview } = useAdmin();
  const { showAlert } = useAlert();
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
    showAlert('Approve Review', 'This review will be visible to all users.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => approveReview(reviewId) },
    ]);
  }, [approveReview, showAlert]);

  const openRejectModal = useCallback((reviewId: string) => {
    setSelectedReviewId(reviewId);
    setRejectNote('');
    setRejectModalVisible(true);
  }, []);

  const handleReject = useCallback(() => {
    if (!selectedReviewId || !rejectNote.trim()) return;
    rejectReview(selectedReviewId, rejectNote.trim());
    setRejectModalVisible(false);
    setRejectNote('');
    setSelectedReviewId(null);
  }, [selectedReviewId, rejectNote, rejectReview]);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} size={13} color={i < rating ? '#F59E0B' : '#E2E8F0'} fill={i < rating ? '#F59E0B' : 'none'} />
    ));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={14} color="#F59E0B" />;
      case 'approved': return <CheckCircle size={14} color="#10B981" />;
      case 'rejected': return <XCircle size={14} color="#EF4444" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return { bg: '#FFFBEB', text: '#92400E' };
      case 'approved': return { bg: '#ECFDF5', text: '#065F46' };
      case 'rejected': return { bg: '#FEF2F2', text: '#991B1B' };
      default: return { bg: '#F1F5F9', text: '#64748B' };
    }
  };

  const filters: { label: string; value: ReviewFilter; count?: number }[] = [
    { label: 'Pending', value: 'pending', count: reviews.filter(r => r.moderationStatus === 'pending').length },
    { label: 'Flagged', value: 'flagged', count: reviews.filter(r => r.flaggedAt).length },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'All', value: 'all' },
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Review Moderation', headerStyle: { backgroundColor: '#0F172A' }, headerTintColor: '#F8FAFC' }} />

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

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {filteredReviews.map(review => {
          const statusStyle = getStatusColor(review.moderationStatus);
          return (
            <View key={review.id} style={styles.reviewCard}>
              {review.flaggedAt && (
                <View style={styles.flagBanner}>
                  <AlertTriangle size={14} color="#B45309" />
                  <Text style={styles.flagText}>Flagged: {review.flagReason ?? 'No reason given'}</Text>
                </View>
              )}

              <View style={styles.reviewHeader}>
                <View style={styles.reviewerInfo}>
                  <Text style={styles.reviewerName}>{review.reviewerName}</Text>
                  <Text style={styles.reviewArrow}>→</Text>
                  <Text style={styles.revieweeName}>{review.revieweeName}</Text>
                </View>
                <View style={[styles.moderationBadge, { backgroundColor: statusStyle.bg }]}>
                  {getStatusIcon(review.moderationStatus)}
                  <Text style={[styles.moderationText, { color: statusStyle.text }]}>{review.moderationStatus}</Text>
                </View>
              </View>

              <View style={styles.starsRow}>{renderStars(review.rating)}</View>

              <View style={styles.commentWrap}>
                <MessageSquare size={14} color="#94A3B8" />
                <Text style={styles.commentText}>{review.comment}</Text>
              </View>

              <Text style={styles.dateText}>
                {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>

              {review.moderationNote && (
                <View style={styles.noteWrap}>
                  <Text style={styles.noteLabel}>Moderation note:</Text>
                  <Text style={styles.noteText}>{review.moderationNote}</Text>
                </View>
              )}

              {review.moderationStatus === 'pending' && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnApprove]}
                    onPress={() => handleApprove(review.id)}
                    testID={`approve-review-${review.id}`}
                  >
                    <CheckCircle size={15} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnReject]}
                    onPress={() => openRejectModal(review.id)}
                    testID={`reject-review-${review.id}`}
                  >
                    <XCircle size={15} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {filteredReviews.length === 0 && (
          <View style={styles.empty}>
            <Filter size={40} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No reviews found</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'pending' ? 'All caught up!' : 'Try a different filter'}
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject Review</Text>
            <Text style={styles.modalSubtitle}>Please provide a reason for rejection</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Reason for rejection..."
              placeholderTextColor="#94A3B8"
              value={rejectNote}
              onChangeText={setRejectNote}
              multiline
              testID="reject-reason-input"
            />
            <TouchableOpacity
              style={[styles.modalBtn, !rejectNote.trim() && styles.modalBtnDisabled]}
              onPress={handleReject}
              disabled={!rejectNote.trim()}
            >
              <Text style={styles.modalBtnText}>Reject Review</Text>
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
  filterRow: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  flagBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  flagText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  reviewArrow: {
    fontSize: 12,
    color: '#94A3B8',
  },
  revieweeName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#3B82F6',
  },
  moderationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  moderationText: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'capitalize' as const,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 10,
  },
  commentWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  commentText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  dateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  noteWrap: {
    marginTop: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 10,
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#64748B',
  },
  noteText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
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
});
