import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AlertTriangle, CheckCircle2, Flag, MessageCircle, PlusCircle, Send, Star, X } from "lucide-react-native";
import Colors from "../constants/colors";
import { trpc } from "../lib/trpc";
import { useCurrentUser } from "../providers/current-user";
import type { RatingBucket, ReviewWithAuthor } from "../types";

interface ReviewsSectionProps {
  revieweeId: string;
  skillId?: string;
  headline?: string;
}

const ratingLevels: RatingBucket[] = [5, 4, 3, 2, 1];
const reviewReasons = ["Spam or advertising", "Harassment or hate", "Inaccurate information", "Safety concern", "Other"];

const ReviewsSectionComponent = ({ revieweeId, skillId, headline }: ReviewsSectionProps) => {
  const { currentUser } = useCurrentUser();
  const utils = trpc.useUtils();
  const [isComposerVisible, setIsComposerVisible] = useState<boolean>(false);
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>("");
  const [composerError, setComposerError] = useState<string | null>(null);
  const [reportModalVisible, setReportModalVisible] = useState<boolean>(false);
  const [reportTarget, setReportTarget] = useState<ReviewWithAuthor | null>(null);
  const [reportReason, setReportReason] = useState<string>("");
  const [reportError, setReportError] = useState<string | null>(null);

  const listInput = useMemo(() => ({ revieweeId, skillId }), [revieweeId, skillId]);
  const reviewsQuery = trpc.reviews.list.useQuery(listInput);

  const createMutation = trpc.reviews.create.useMutation({
    onSuccess: async () => { await utils.reviews.list.invalidate(listInput); setIsComposerVisible(false); setReviewText(""); setSelectedRating(5); setComposerError(null); },
    onError: (e) => { setComposerError(e.message); },
  });

  const reportMutation = trpc.reviews.report.useMutation({
    onSuccess: async () => { await utils.reviews.list.invalidate(listInput); setReportModalVisible(false); setReportTarget(null); setReportReason(""); setReportError(null); },
    onError: (e) => { setReportError(e.message); },
  });

  const progressAnim = useRef(new Animated.Value(0)).current;
  const averageRating = reviewsQuery.data?.stats.averageRating ?? 0;
  const totalReviews = reviewsQuery.data?.stats.totalReviews ?? 0;

  const distributionMap = useMemo(() => reviewsQuery.data?.stats.distribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, [reviewsQuery.data?.stats.distribution]);

  useEffect(() => { Animated.timing(progressAnim, { toValue: averageRating, duration: 600, useNativeDriver: false }).start(); }, [averageRating, progressAnim]);

  const progressWidth = useMemo(() => progressAnim.interpolate({ inputRange: [0, 5], outputRange: [0, 200] }), [progressAnim]);

  const handleSubmitReview = useCallback(() => {
    if (createMutation.isPending) return;
    if (reviewText.trim().length < 10) { setComposerError("Share at least 10 characters"); return; }
    createMutation.mutate({ reviewerId: currentUser.id, revieweeId, rating: selectedRating, comment: reviewText, skillId });
  }, [createMutation, currentUser.id, reviewText, revieweeId, selectedRating, skillId]);

  const handleSubmitReport = useCallback(() => {
    if (!reportTarget || reportMutation.isPending) return;
    if (reportReason.trim().length < 6) { setReportError("Select a reason"); return; }
    reportMutation.mutate({ reviewId: reportTarget.id, reporterId: currentUser.id, reason: reportReason });
  }, [currentUser.id, reportMutation, reportReason, reportTarget]);

  const canWriteReview = currentUser.id !== revieweeId;
  const reviews = reviewsQuery.data?.reviews ?? [];
  const isLoading = reviewsQuery.isLoading || reviewsQuery.isRefetching;

  const distributionEntries = useMemo(() => ratingLevels.map((level) => {
    const count = distributionMap[level] ?? 0;
    return { level, count, ratio: totalReviews === 0 ? 0 : count / totalReviews };
  }), [distributionMap, totalReviews]);

  return (
    <View style={styles.sectionContainer} testID="reviews-section">
      <LinearGradient colors={["#0F172A", "#111827"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.sectionTitle}>{headline ?? "Reviews"}</Text>
            <Text style={styles.sectionSubtitle}>{totalReviews === 0 ? "Be the first to share" : `${totalReviews} review${totalReviews === 1 ? "" : "s"}`}</Text>
          </View>
          {canWriteReview && (
            <Pressable style={styles.addButton} onPress={() => { setComposerError(null); setIsComposerVisible(true); }} disabled={createMutation.isPending} testID="open-review-composer">
              <PlusCircle size={18} color={Colors.light.primary} />
              <Text style={styles.addButtonText}>Write review</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.averageColumn}>
            <View style={styles.averageBadge}>
              <Star size={20} color={Colors.light.accent} fill={Colors.light.accent} />
              <Text style={styles.averageValue}>{averageRating.toFixed(1)}</Text>
            </View>
            <Text style={styles.averageHint}>Average score</Text>
          </View>
          <View style={{ flex: 1, gap: 14 }}>
            <View style={styles.progressBar}><Animated.View style={[styles.progressFill, { width: progressWidth }]} /></View>
            <View style={{ gap: 10 }}>
              {distributionEntries.map((e) => (
                <View key={e.level} style={styles.distRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, width: 54 }}>
                    <Text style={styles.distLevel}>{e.level}</Text>
                    <Star size={12} color={Colors.light.accent} fill={Colors.light.accent} />
                  </View>
                  <View style={styles.distMeter}>
                    <View style={[styles.distFill, { flex: e.ratio }]} />
                    <View style={{ flex: 1 - e.ratio, backgroundColor: "transparent" }} />
                  </View>
                  <Text style={styles.distCount}>{e.count}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {reviewsQuery.error && (
          <View style={styles.errorCard}>
            <AlertTriangle size={18} color={Colors.light.accent} />
            <Text style={styles.errorText}>{reviewsQuery.error.message}</Text>
            <Pressable onPress={() => reviewsQuery.refetch()} style={styles.retryButton} testID="retry-reviews">
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {isLoading && (
          <View style={{ gap: 12 }}>
            {[1, 2].map((p) => (
              <View key={p} style={styles.placeholder}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(71,85,105,0.45)" }} />
                  <View style={{ flex: 1, height: 14, borderRadius: 8, backgroundColor: "rgba(71,85,105,0.35)" }} />
                </View>
                <View style={{ height: 48, borderRadius: 12, backgroundColor: "rgba(71,85,105,0.35)" }} />
              </View>
            ))}
          </View>
        )}

        {!isLoading && reviews.length === 0 && (
          <View style={styles.emptyState}>
            <MessageCircle size={22} color={Colors.light.textSecondary} />
            <Text style={styles.emptyTitle}>No stories yet</Text>
            <Text style={styles.emptySubtitle}>Share a review to help others choose confidently.</Text>
          </View>
        )}

        {!isLoading && reviews.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6, gap: 16 }}>
            {reviews.map((review) => {
              const isFlagged = Boolean(review.flaggedAt);
              return (
                <View key={review.id} style={styles.reviewCard} testID={`review-card-${review.id}`}>
                  <View style={styles.reviewHeader}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={styles.avatarCircle}><Text style={styles.avatarInitials}>{review.reviewer.name.slice(0, 2).toUpperCase()}</Text></View>
                      <View style={{ gap: 2 }}>
                        <Text style={styles.reviewerName}>{review.reviewer.name}</Text>
                        <Text style={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString()}</Text>
                      </View>
                    </View>
                    <View style={styles.ratingPill}>
                      <Star size={14} color={Colors.light.accent} fill={Colors.light.accent} />
                      <Text style={styles.ratingPillText}>{review.rating.toFixed(1)}</Text>
                    </View>
                  </View>
                  <Text style={styles.reviewBody}>{review.comment}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    {review.skillId && <View style={styles.skillTag}><Text style={styles.skillTagText}>Skill #{review.skillId}</Text></View>}
                    <View style={{ flex: 1 }} />
                    {isFlagged ? (
                      <View style={styles.flaggedBadge}><AlertTriangle size={14} color={Colors.light.warning} /><Text style={styles.flaggedText}>Flagged</Text></View>
                    ) : canWriteReview && (
                      <Pressable onPress={() => { setReportTarget(review); setReportReason(""); setReportError(null); setReportModalVisible(true); }} style={styles.reportButton} testID={`report-review-${review.id}`}>
                        <Flag size={14} color={Colors.light.textSecondary} /><Text style={styles.reportButtonText}>Report</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </LinearGradient>

      <Modal visible={isComposerVisible} transparent animationType={Platform.select({ ios: "slide", default: "fade" })} onRequestClose={() => { if (!createMutation.isPending) setIsComposerVisible(false); }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share your experience</Text>
              <Pressable onPress={() => { if (!createMutation.isPending) { setIsComposerVisible(false); setComposerError(null); } }} testID="close-review-composer"><X size={18} color={Colors.light.textSecondary} /></Pressable>
            </View>
            <Text style={styles.modalSubtitle}>How would you rate this session?</Text>
            <View style={styles.ratingSelector}>
              {ratingLevels.map((level) => (
                <Pressable key={level} style={[styles.ratingStar, selectedRating >= level && styles.ratingStarActive]} onPress={() => setSelectedRating(level)} testID={`composer-rating-${level}`}>
                  <Star size={24} color={selectedRating >= level ? Colors.light.accent : Colors.light.textSecondary} fill={selectedRating >= level ? Colors.light.accent : "transparent"} />
                </Pressable>
              ))}
            </View>
            <TextInput style={styles.reviewInput} placeholder="What stood out about this swap?" placeholderTextColor={Colors.light.textTertiary} multiline value={reviewText} onChangeText={setReviewText} textAlignVertical="top" numberOfLines={6} testID="review-text-input" />
            {composerError && <Text style={styles.modalError}>{composerError}</Text>}
            <Pressable style={[styles.submitButton, createMutation.isPending && { opacity: 0.6 }]} onPress={handleSubmitReview} disabled={createMutation.isPending} testID="submit-review">
              <Send size={18} color="#FFFFFF" /><Text style={styles.submitButtonText}>{createMutation.isPending ? "Sending" : "Submit review"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={reportModalVisible} transparent animationType={Platform.select({ ios: "slide", default: "fade" })} onRequestClose={() => { if (!reportMutation.isPending) { setReportModalVisible(false); setReportTarget(null); } }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report review</Text>
              <Pressable onPress={() => { if (!reportMutation.isPending) { setReportModalVisible(false); setReportTarget(null); } }} testID="close-report-modal"><X size={18} color={Colors.light.textSecondary} /></Pressable>
            </View>
            <Text style={styles.modalSubtitle}>Why does this review break our guidelines?</Text>
            <View style={{ gap: 12 }}>
              {reviewReasons.map((reason) => {
                const active = reportReason === reason;
                return (
                  <Pressable key={reason} style={[styles.reasonChip, active && styles.reasonChipActive]} onPress={() => setReportReason(reason)} testID={`report-reason-${reason}`}>
                    {active ? <CheckCircle2 size={18} color={Colors.light.primary} /> : <Flag size={18} color={Colors.light.textSecondary} />}
                    <Text style={[styles.reasonText, active && styles.reasonTextActive]}>{reason}</Text>
                  </Pressable>
                );
              })}
            </View>
            {reportError && <Text style={styles.modalError}>{reportError}</Text>}
            <Pressable style={[styles.submitButton, reportMutation.isPending && { opacity: 0.6 }]} onPress={handleSubmitReport} disabled={reportMutation.isPending} testID="submit-report">
              <AlertTriangle size={18} color="#FFFFFF" /><Text style={styles.submitButtonText}>{reportMutation.isPending ? "Sending" : "Send report"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: { marginTop: 24 },
  gradient: { borderRadius: 28, padding: 20, gap: 18 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionTitle: { fontSize: 22, fontWeight: "700" as const, color: "#F8FAFC" },
  sectionSubtitle: { fontSize: 13, color: "rgba(226,232,240,0.75)" },
  addButton: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(15,118,110,0.15)", borderWidth: 1, borderColor: Colors.light.primary },
  addButtonText: { fontSize: 13, fontWeight: "700" as const, color: Colors.light.primary },
  summaryCard: { flexDirection: "row", gap: 16, backgroundColor: "rgba(15,23,42,0.6)", borderRadius: 24, padding: 18, borderWidth: 1, borderColor: "rgba(148,163,184,0.35)" },
  averageColumn: { width: 120, alignItems: "center", justifyContent: "center", gap: 8 },
  averageBadge: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(30,64,175,0.35)", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18 },
  averageValue: { fontSize: 28, fontWeight: "700" as const, color: "#FFFFFF" },
  averageHint: { fontSize: 13, color: "rgba(226,232,240,0.7)" },
  progressBar: { height: 12, width: 200, backgroundColor: "rgba(71,85,105,0.45)", borderRadius: 12, overflow: "hidden", alignSelf: "flex-start" },
  progressFill: { height: "100%", backgroundColor: Colors.light.accent, borderRadius: 12 },
  distRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  distLevel: { fontSize: 14, fontWeight: "600" as const, color: "rgba(226,232,240,0.85)" },
  distMeter: { flex: 1, flexDirection: "row", borderRadius: 12, backgroundColor: "rgba(71,85,105,0.25)", overflow: "hidden" },
  distFill: { backgroundColor: Colors.light.primary },
  distCount: { width: 28, textAlign: "right" as const, fontSize: 13, color: "rgba(148,163,184,0.9)" },
  errorCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(127,29,29,0.3)", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "rgba(248,113,113,0.4)" },
  errorText: { flex: 1, fontSize: 13, color: "#FCA5A5" },
  retryButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: "#FCA5A5" },
  retryText: { fontSize: 12, fontWeight: "600" as const, color: "#FCA5A5" },
  placeholder: { backgroundColor: "rgba(30,41,59,0.5)", borderRadius: 20, padding: 16, gap: 12 },
  emptyState: { alignItems: "center", gap: 10, paddingVertical: 24, backgroundColor: "rgba(15,23,42,0.5)", borderRadius: 20, borderWidth: 1, borderColor: "rgba(59,130,246,0.25)" },
  emptyTitle: { fontSize: 18, fontWeight: "700" as const, color: "#E2E8F0" },
  emptySubtitle: { fontSize: 14, color: "rgba(203,213,225,0.75)", textAlign: "center" as const, paddingHorizontal: 24, lineHeight: 20 },
  reviewCard: { width: 280, backgroundColor: "rgba(15,23,42,0.75)", borderRadius: 20, padding: 18, marginRight: 14, borderWidth: 1, borderColor: "rgba(148,163,184,0.25)", gap: 14 },
  reviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(37,99,235,0.25)" },
  avatarInitials: { fontSize: 16, fontWeight: "700" as const, color: "#BFDBFE" },
  reviewerName: { fontSize: 15, fontWeight: "600" as const, color: "#F8FAFC" },
  reviewDate: { fontSize: 12, color: "rgba(148,163,184,0.75)" },
  ratingPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(234,179,8,0.2)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  ratingPillText: { fontSize: 14, fontWeight: "700" as const, color: Colors.light.accent },
  reviewBody: { fontSize: 14, lineHeight: 20, color: "rgba(226,232,240,0.9)" },
  skillTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: "rgba(59,130,246,0.2)" },
  skillTagText: { fontSize: 12, fontWeight: "600" as const, color: "#BFDBFE" },
  flaggedBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: "rgba(217,119,6,0.2)" },
  flaggedText: { fontSize: 12, fontWeight: "600" as const, color: Colors.light.warning },
  reportButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: "rgba(148,163,184,0.4)" },
  reportButtonText: { fontSize: 12, fontWeight: "600" as const, color: "rgba(226,232,240,0.8)" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.7)", alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  modalContainer: { width: "100%", maxWidth: 420, backgroundColor: Colors.light.background, borderRadius: 24, padding: 20, gap: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.light.text },
  modalSubtitle: { fontSize: 13, color: Colors.light.textSecondary },
  ratingSelector: { flexDirection: "row", alignItems: "center", gap: 12 },
  ratingStar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1, borderColor: Colors.light.borderLight },
  ratingStarActive: { backgroundColor: Colors.light.accentLight, borderColor: Colors.light.accent },
  reviewInput: { minHeight: 120, borderRadius: 18, borderWidth: 1, borderColor: Colors.light.borderLight, padding: 16, fontSize: 14, color: Colors.light.text, backgroundColor: Colors.light.backgroundSecondary },
  modalError: { fontSize: 13, color: Colors.light.error },
  submitButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 18, paddingVertical: 14, backgroundColor: Colors.light.primary },
  submitButtonText: { fontSize: 15, fontWeight: "700" as const, color: "#FFFFFF" },
  reasonChip: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: Colors.light.borderLight, backgroundColor: Colors.light.backgroundSecondary },
  reasonChipActive: { borderColor: Colors.light.primary, backgroundColor: Colors.light.accentLight },
  reasonText: { fontSize: 14, color: Colors.light.textSecondary },
  reasonTextActive: { color: Colors.light.primary, fontWeight: "600" as const },
});

const ReviewsSection = memo(ReviewsSectionComponent);
ReviewsSection.displayName = "ReviewsSection";

export default ReviewsSection;
