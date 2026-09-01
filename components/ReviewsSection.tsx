import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  MessageCircle,
  PlusCircle,
  Send,
  Star,
  X,
} from "lucide-react-native";
import Colors from "../constants/colors";
import { useRouter } from "expo-router";
import { useCurrentUser } from "../providers/current-user";
import type { RatingBucket, ReviewWithAuthor } from "../types";
import url from "@/constants/backurl";
import { useAlert } from "../providers/alert";
import { useSocket } from "@/providers/socket";

interface ReviewsSectionProps {
  revieweeId: string;
  skillId?: string;
  headline?: string;
}

const ratingLevels: RatingBucket[] = [5, 4, 3, 2, 1];
const reviewReasons = [
  "Spam or advertising",
  "Harassment or hate",
  "Inaccurate information",
  "Safety concern",
  "Other",
];

const ReviewsSectionComponent = ({ revieweeId, skillId, headline }: ReviewsSectionProps) => {
  const { currentUser } = useCurrentUser();
  const { showAlert } = useAlert();
  const { socket } = useSocket();
  // console.log("Hii", skillId, revieweeId);
  const [isComposerVisible, setIsComposerVisible] = useState<boolean>(false);
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>("");
  const [composerError, setComposerError] = useState<string | null>(null);
  const [reportModalVisible, setReportModalVisible] = useState<boolean>(false);
  const [reportTarget, setReportTarget] = useState<ReviewWithAuthor | null>(null);
  const [reportReason, setReportReason] = useState<string>("");
  const [reportError, setReportError] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [reviews, setReviews] = useState<ReviewWithAuthor[]>([]);
  const [stats, setStats] = useState({
    averageRating: 0,
    totalReviews: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    try {
      setIsLoading(true);
      setFetchError(null);
      const res = await fetch(
        `${url}/reviews?revieweeId=${revieweeId}&skillId=${skillId ?? ""}`
      );

      if (!res.ok) throw new Error("Failed to fetch reviews");

      const data = await res.json();
      setReviews(data.reviews);
      setStats(data.stats);
    } catch (err) {
      console.error("[Reviews] Fetch error", err);
      setFetchError("Failed to load reviews");
    } finally {
      setIsLoading(false);
    }
  }, [revieweeId, skillId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Real-time socket listener for review moderation and updates
  useEffect(() => {
    if (!socket) return;

    const handleReviewEvent = (data: any) => {
      console.log('[Socket.IO ReviewsSection] Review event received:', data);
      fetchReviews();
    };

    socket.on('review_created', handleReviewEvent);
    socket.on('review_updated', handleReviewEvent);
    socket.on('review_moderated', handleReviewEvent);

    return () => {
      socket.off('review_created', handleReviewEvent);
      socket.off('review_updated', handleReviewEvent);
      socket.off('review_moderated', handleReviewEvent);
    };
  }, [socket, fetchReviews]);

  const handleSubmitReport = useCallback(async () => {
    if (!reportTarget || isSubmittingReport) return;


    if (reportReason.trim().length < 6) {
      setReportError("Select a reason to continue");
      return;
    }

    try {
      setIsSubmittingReport(true);

      const res = await fetch(
        `${url}/reviews/${reportTarget.id}/report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reporterId: currentUser?.id,
            reason: reportReason,
          }),
        }
      );

      if (!res.ok) throw new Error("Report failed");

      await fetchReviews();

      setReportModalVisible(false);
      setReportTarget(null);
      setReportReason("");
      setReportError(null);
    } catch (err) {
      console.error("[Reviews] Report error", err);
      setReportError("Failed to report review");
    } finally {
      setIsSubmittingReport(false);
    }
  }, [reportTarget, reportReason, currentUser?.id, fetchReviews, isSubmittingReport]);


  const averageRating = stats.averageRating;
  const totalReviews = stats.totalReviews;

  const distributionMap = stats.distribution;


  // const reviewsQuery = trpc.reviews.list.useQuery(listInput);

  // const createMutation = trpc.reviews.create.useMutation({
  //   onSuccess: async () => {
  //     await utils.reviews.list.invalidate(listInput);
  //     setIsComposerVisible(false);
  //     setReviewText("");
  //     setSelectedRating(5);
  //     setComposerError(null);
  //   },
  //   onError: (error) => {
  //     setComposerError(error.message);
  //     console.log("[Reviews] Create error", error);
  //   },
  // });

  // const reportMutation = trpc.reviews.report.useMutation({
  //   onSuccess: async () => {
  //     await utils.reviews.list.invalidate(listInput);
  //     setReportModalVisible(false);
  //     setReportTarget(null);
  //     setReportReason("");
  //     setReportError(null);
  //   },
  //   onError: (error) => {
  //     setReportError(error.message);
  //     console.log("[Reviews] Report error", error);
  //   },
  // });

  const progressAnim = useRef(new Animated.Value(0)).current;

  // const averageRating = reviewsQuery.data?.stats.averageRating ?? 0;
  // const totalReviews = reviewsQuery.data?.stats.totalReviews ?? 0;

  // const distributionMap = useMemo(() => {
  //   if (reviewsQuery.data?.stats.distribution) {
  //     return reviewsQuery.data.stats.distribution;
  //   }
  //   return {
  //     1: 0,
  //     2: 0,
  //     3: 0,
  //     4: 0,
  //     5: 0,
  //   };
  // }, [reviewsQuery.data?.stats.distribution]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: averageRating,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [averageRating, progressAnim]);

  const progressWidthAnimated = useMemo(() => {
    return progressAnim.interpolate({
      inputRange: [0, 5],
      outputRange: ["0%", "100%"],
    });
  }, [progressAnim]);

  const router = useRouter();

  const handleOpenComposer = useCallback(() => {
    if (!currentUser || currentUser.id === '1' || (currentUser as any)?.isDemo) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to submit a review.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }
    setComposerError(null);
    setIsComposerVisible(true);
  }, [currentUser, router, showAlert]);

  const handleCloseComposer = useCallback(() => {
    if (isSubmittingReview) {
      return;
    }
    setIsComposerVisible(false);
    setComposerError(null);
  }, [isSubmittingReview]);

  const handleCloseReport = useCallback(() => {
    if (isSubmittingReview) {
      return;
    }
    setReportModalVisible(false);
    setReportTarget(null);
    setReportReason("");
    setReportError(null);
  }, [isSubmittingReview]);

  const handleOpenReport = useCallback((review: ReviewWithAuthor) => {
    if (!currentUser || currentUser.id === '1' || (currentUser as any)?.isDemo) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to report a review.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }
    setReportTarget(review);
    setReportReason("");
    setReportError(null);
    setReportModalVisible(true);
  }, [currentUser, router, showAlert]);

  // const handleSubmitReport = useCallback(() => {
  //   if (!reportTarget) {
  //     return;
  //   }
  //   if (reportMutation.isPending) {
  //     return;
  //   }
  //   if (reportReason.trim().length < 6) {
  //     setReportError("Select a reason to continue");
  //     return;
  //   }
  //   console.log("[Reviews] Reporting review", {
  //     reviewId: reportTarget.id,
  //     reporterId: currentUser?.id,
  //   });
  //   reportMutation.mutate({
  //     reviewId: reportTarget.id,
  //     reporterId: currentUser?.id || "",
  //     reason: reportReason,
  //   });
  // }, [currentUser?.id, reportMutation, reportReason, reportTarget]);

  const canWriteReview = currentUser?.id !== revieweeId;
  // const reviews = reviewsQuery.data?.reviews ?? [];

  const distributionEntries = useMemo(() => {
    return ratingLevels.map((level) => {
      const count = distributionMap[level] ?? 0;
      const ratio = totalReviews === 0 ? 0 : count / totalReviews;
      return {
        level,
        count,
        ratio,
      };
    });
  }, [distributionMap, totalReviews]);

  const averageLabel = useMemo(() => {
    return averageRating.toFixed(1);
  }, [averageRating]);

  // const isLoading = reviewsQuery.isLoading || reviewsQuery.isRefetching;


  // const handleSubmitReview = useCallback(() => {
  //   if (createMutation.isPending) {
  //     return;
  //   }
  //   if (reviewText.trim().length < 10) {
  //     setComposerError("Share at least 10 characters about your session");
  //     return;
  //   }
  //   console.log("[Reviews] Submitting review", {
  //     revieweeId,
  //     reviewerId: currentUser?.id,
  //     rating: selectedRating,
  //   });
  //   createMutation.mutate({
  //     reviewerId: currentUser?.id || "",
  //     revieweeId,
  //     rating: selectedRating,
  //     comment: reviewText,
  //     skillId,
  //   });
  // }, [createMutation, currentUser?.id, reviewText, revieweeId, selectedRating, skillId]);

  


  // console.log(skillId);



  const handleSubmitReview = useCallback(async () => {
    if (isSubmittingReview) return;
    console.log("skill", skillId);


    if (reviewText.trim().length < 10) {
      setComposerError('Share at least 10 characters about your session');
      return;
    }

    setIsSubmittingReview(true);
    setComposerError(null);

    try {
      console.log('[Reviews] Submitting review', {
        reviewerId: currentUser?.id,
        revieweeId,
        rating: selectedRating,
        skillId,
      });

      const response = await fetch(
        `${url}/reviews`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reviewerId: currentUser?.id,
            revieweeId,
            rating: selectedRating,
            comment: reviewText,
            skillId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to submit review');
      }

      // ✅ refresh UI
      await fetchReviews();

      const createdReview = await response.json();

      console.log('[Reviews] Review created', createdReview);

      // ✅ Reset UI
      setReviewText("");
      setSelectedRating(5);
      setIsComposerVisible(false);

      // optional: refetch reviews or append locally
      // onReviewSubmitted?.(createdReview);
    } catch (error) {
      console.error('[Reviews] Submit failed', error);
      setComposerError('Something went wrong. Please try again.');
    } finally {
      setIsSubmittingReview(false);
    }
  }, [
    currentUser?.id,
    revieweeId,
    selectedRating,
    reviewText,
    skillId,
    fetchReviews,
    isSubmittingReview,
  ]);

  return (
    <View style={styles.sectionContainer} testID="reviews-section">
      <LinearGradient
        colors={["#0F172A", "#111827"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientContainer}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerTextGroup}>
            <Text style={styles.sectionTitle}>{headline ?? "Reviews"}</Text>
            <Text style={styles.sectionSubtitle}>
              {totalReviews === 0 ? "Be the first to share your experience" : `${totalReviews} review${totalReviews === 1 ? "" : "s"} from the community`}
            </Text>
          </View>
          {canWriteReview && (
            <Pressable
              style={styles.addButton}
              onPress={handleOpenComposer}
              disabled={isSubmittingReview}
              testID="open-review-composer"
            >
              <PlusCircle size={18} color={Colors.light.primary} />
              <Text style={styles.addButtonText}>Write review</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.averageColumn}>
            <View style={styles.averageBadge}>
              <Star size={20} color={Colors.light.accent} fill={Colors.light.accent} />
              <Text style={styles.averageValue}>{averageLabel}</Text>
            </View>
            <Text style={styles.averageHint}>Average score</Text>
          </View>
          <View style={styles.progressColumn}>
            <View style={styles.progressBar}>
              <Animated.View
                style={[styles.progressFill, { width: progressWidthAnimated }]}
              />
            </View>
            <View style={styles.distributionList}>
              {distributionEntries.map((entry) => (
                <View key={entry.level} style={styles.distributionRow}>
                  <View style={styles.distributionLabelRow}>
                    <Text style={styles.distributionLevel}>{entry.level}</Text>
                    <Star size={12} color={Colors.light.accent} fill={Colors.light.accent} />
                  </View>
                  <View style={styles.distributionMeter}>
                    <View style={[styles.distributionMeterFill, { flex: entry.ratio }]} />
                    <View style={[styles.distributionMeterSpacer, { flex: 1 - entry.ratio }]} />
                  </View>
                  <Text style={styles.distributionCount}>{entry.count}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {fetchError && (
          <View style={styles.errorCard}>
            <AlertTriangle size={18} color={Colors.light.accent} />
            <Text style={styles.errorText}>{fetchError}</Text>
            <Pressable
              onPress={fetchReviews}
              style={styles.retryButton}
              testID="retry-reviews"
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}


        {isLoading && (
          <View style={styles.loadingContainer}>
            {[1, 2].map((placeholder) => (
              <View key={placeholder} style={styles.placeholderCard}>
                <View style={styles.placeholderHeader}>
                  <View style={styles.placeholderAvatar} />
                  <View style={styles.placeholderText} />
                </View>
                <View style={styles.placeholderBody} />
              </View>
            ))}
          </View>
        )}

        {!isLoading && reviews.length === 0 && (
          <View style={styles.emptyState}>
            <MessageCircle size={22} color={Colors.light.textSecondary} />
            <Text style={styles.emptyTitle}>No stories yet</Text>
            <Text style={styles.emptySubtitle}>Wrap up your swap with a quick rating to help others choose confidently.</Text>
          </View>
        )}

        {!isLoading && reviews.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.reviewsScroll}
          >
            {reviews.map((review,i) => {
              // console.log(review);
              const isFlagged = Boolean(review.flaggedAt);
  
              return (
                <View key={i} style={styles.reviewCard} testID={`review-card-${review.id}`}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerRow}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarInitials}>{(review.reviewer?.username || review.reviewer?.name || 'US').slice(0, 2).toUpperCase()}</Text>
                      </View>
                      <View style={styles.reviewerInfo}>
                        <Text style={styles.reviewerName}>{review.reviewer?.username ? (review.reviewer.username.startsWith('@') ? review.reviewer.username : `@${review.reviewer.username}`) : `@${(review.reviewer?.name || 'user').toLowerCase().replace(/\s+/g, '')}`}</Text>
                        <Text style={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString()}</Text>
                      </View>
                    </View>
                    <View style={styles.ratingPill}>
                      <Star size={14} color={Colors.light.accent} fill={Colors.light.accent} />
                      <Text style={styles.ratingPillText}>{review.rating.toFixed(1)}</Text>
                    </View>
                  </View>
                  <Text style={styles.reviewBody}>{review.comment}</Text>
                  <View style={styles.reviewFooter}>
                    {review.skillId && (
                      <View style={styles.skillTag}>
                        <Text style={styles.skillTagText}>Skill #{review?.skillId?.slice(-6,)}</Text>
                      </View>
                    )}
                    <View style={styles.reviewFooterSpacer} />
                    {isFlagged ? (
                      <View style={styles.flaggedBadge}>
                        <AlertTriangle size={14} color={Colors.light.warning} />
                        <Text style={styles.flaggedText}>Flagged</Text>
                      </View>
                    ) : (
                      canWriteReview && (
                        <Pressable
                          onPress={() => handleOpenReport(review)}
                          style={styles.reportButton}
                          testID={`report-review-${review.id}`}
                        >
                          <Flag size={14} color={Colors.light.textSecondary} />
                          <Text style={styles.reportButtonText}>Report</Text>
                        </Pressable>
                      )
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </LinearGradient>

      <Modal
        visible={isComposerVisible}
        transparent
        animationType={Platform.select({ ios: "slide", default: "fade" })}
        onRequestClose={handleCloseComposer}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share your experience</Text>
              <Pressable onPress={handleCloseComposer} testID="close-review-composer">
                <X size={18} color={Colors.light.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>How would you rate this session?</Text>
            <View style={styles.ratingSelector}>
              {ratingLevels.map((level) => (
                <Pressable
                  key={level}
                  style={[styles.ratingStarWrapper, selectedRating >= level && styles.ratingStarActive]}
                  onPress={() => setSelectedRating(level)}
                  testID={`composer-rating-${level}`}
                >
                  <Star
                    size={24}
                    color={selectedRating >= level ? Colors.light.accent : Colors.light.textSecondary}
                    fill={selectedRating >= level ? Colors.light.accent : "transparent"}
                  />
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.reviewInput}
              placeholder="Tell others what stood out, what was learned, and how the swap felt"
              placeholderTextColor={Colors.light.textTertiary}
              multiline
              value={reviewText}
              onChangeText={setReviewText}
              textAlignVertical="top"
              numberOfLines={6}
              testID="review-text-input"
            />
            {composerError && <Text style={styles.modalError}>{composerError}</Text>}
            <Pressable
              style={[styles.submitButton, isSubmittingReview && styles.submitButtonDisabled]}
              onPress={handleSubmitReview}
              disabled={isSubmittingReview}
              testID="submit-review"
            >
              <Send size={18} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>{isSubmittingReview ? "Sending" : "Submit review"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={reportModalVisible}
        transparent
        animationType={Platform.select({ ios: "slide", default: "fade" })}
        onRequestClose={handleCloseReport}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.reportContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report review</Text>
              <Pressable onPress={handleCloseReport} testID="close-report-modal">
                <X size={18} color={Colors.light.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>Why does this review break our guidelines?</Text>
            <View style={styles.reasonsList}>
              {reviewReasons.map((reason) => {
                const isActive = reportReason === reason;
                return (
                  <Pressable
                    key={reason}
                    style={[styles.reasonChip, isActive && styles.reasonChipActive]}
                    onPress={() => setReportReason(reason)}
                    testID={`report-reason-${reason}`}
                  >
                    {isActive ? (
                      <CheckCircle2 size={18} color={Colors.light.primary} />
                    ) : (
                      <Flag size={18} color={Colors.light.textSecondary} />
                    )}
                    <Text style={[styles.reasonText, isActive && styles.reasonTextActive]}>{reason}</Text>
                  </Pressable>
                );
              })}
            </View>
            {reportError && <Text style={styles.modalError}>{reportError}</Text>}
            <Pressable
              style={[styles.submitButton, isSubmittingReport && styles.submitButtonDisabled]}
              onPress={handleSubmitReport}
              disabled={isSubmittingReport}
              testID="submit-report"
            >
              <AlertTriangle size={18} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>{isSubmittingReport ? "Sending" : "Send report"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 24,
  },
  gradientContainer: {
    borderRadius: 28,
    padding: 20,
    gap: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTextGroup: {
    flex: 1,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "rgba(226, 232, 240, 0.75)",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(15, 118, 110, 0.15)",
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.light.primary,
  },
  summaryCard: {
    flexDirection: "row",
    gap: 16,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
  },
  averageColumn: {
    width: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  averageBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(30, 64, 175, 0.35)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  averageValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  averageHint: {
    fontSize: 13,
    color: "rgba(226, 232, 240, 0.7)",
  },
  progressColumn: {
    flex: 1,
    gap: 14,
  },
  progressBar: {
    height: 12,
    width: "100%",
    backgroundColor: "rgba(71, 85, 105, 0.45)",
    borderRadius: 12,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.light.accent,
    borderRadius: 12,
  },
  distributionList: {
    gap: 10,
  },
  distributionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  distributionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    width: 54,
  },
  distributionLevel: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(226, 232, 240, 0.85)",
  },
  distributionMeter: {
    flex: 1,
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(71, 85, 105, 0.25)",
    overflow: "hidden",
  },
  distributionMeterFill: {
    height: "100%",
    backgroundColor: Colors.light.primary,
  },
  distributionMeterSpacer: {
    height: "100%",
    backgroundColor: "transparent",
  },
  distributionCount: {
    width: 28,
    textAlign: "right",
    fontSize: 13,
    color: "rgba(148, 163, 184, 0.9)",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(127, 29, 29, 0.3)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.4)",
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: "#FCA5A5",
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  retryText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FCA5A5",
  },
  loadingContainer: {
    gap: 12,
  },
  placeholderCard: {
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  placeholderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  placeholderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(71, 85, 105, 0.45)",
  },
  placeholderText: {
    flex: 1,
    height: 14,
    borderRadius: 8,
    backgroundColor: "rgba(71, 85, 105, 0.35)",
  },
  placeholderBody: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(71, 85, 105, 0.35)",
  },
  emptyState: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 24,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.25)",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#E2E8F0",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "rgba(203, 213, 225, 0.75)",
    textAlign: "center",
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  reviewsScroll: {
    paddingTop: 6,
    paddingBottom: 6,
    gap: 16,
  },
  reviewCard: {
    width: 280,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderRadius: 20,
    padding: 18,
    marginRight: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    gap: 14,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  reviewerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(37, 99, 235, 0.25)",
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: "700",
    color: "#BFDBFE",
  },
  reviewerInfo: {
    gap: 2,
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#F8FAFC",
  },
  reviewDate: {
    fontSize: 12,
    color: "rgba(148, 163, 184, 0.75)",
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  ratingPillText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.accent,
  },
  reviewBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(226, 232, 240, 0.9)",
  },
  reviewFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  skillTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(59, 130, 246, 0.2)",
  },
  skillTagText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#BFDBFE",
  },
  reviewFooterSpacer: {
    flex: 1,
  },
  flaggedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(217, 119, 6, 0.2)",
  },
  flaggedText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.warning,
  },
  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.4)",
  },
  reportButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(226, 232, 240, 0.8)",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: Colors.light.background,
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  ratingSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ratingStarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  ratingStarActive: {
    backgroundColor: Colors.light.accentLight,
    borderColor: Colors.light.accent,
  },
  reviewInput: {
    minHeight: 120,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    padding: 16,
    fontSize: 14,
    color: Colors.light.text,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  modalError: {
    fontSize: 13,
    color: Colors.light.error,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 18,
    paddingVertical: 14,
    backgroundColor: Colors.light.primary,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  reportContainer: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: Colors.light.background,
    borderRadius: 24,
    padding: 20,
    gap: 18,
  },
  reasonsList: {
    gap: 12,
  },
  reasonChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  reasonChipActive: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.accentLight,
  },
  reasonText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  reasonTextActive: {
    color: Colors.light.primary,
    fontWeight: "600",
  },
});

const ReviewsSection = memo(ReviewsSectionComponent);
ReviewsSection.displayName = "ReviewsSection";

export default ReviewsSection;
