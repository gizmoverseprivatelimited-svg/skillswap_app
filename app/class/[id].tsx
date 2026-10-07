import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Image, TouchableOpacity, Linking, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, Clock, Users, Coins, Star, Sparkles, CheckCircle2, XCircle, ArrowLeft, Video, Repeat, CreditCard, Crown, Megaphone, FileText, UploadCloud } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useClasses } from '@/providers/classes';
import { useCurrentUser } from '@/providers/current-user';
import { useAlert } from '@/providers/alert';
import { formatCredits, getClassEnrollmentCost, getClassDiscountPercent, formatClassSchedule, formatBillingCycle } from '@/lib/payments';
import { resolveImageUrl } from '@/lib/resolveImageUrl';
import { useSkillSwaps } from '@/providers/skill-swaps';
import { useSocket } from '@/providers/socket';
import { useSafety } from '@/providers/safety';
import url from '@/constants/backurl';
import * as DocumentPicker from 'expo-document-picker';
import { TextInput } from 'react-native-gesture-handler';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800';
const DEFAULT_AVATAR = 'https://i.pravatar.cc/150?img=1';

function StudentAvatarItem({ stu }: { stu: any }) {
  const [avatarUrl, setAvatarUrl] = useState(() => resolveImageUrl(stu.avatarUrl, DEFAULT_AVATAR) || DEFAULT_AVATAR);
  return (
    <View style={s.studentChip}>
      <Image
        source={{ uri: avatarUrl }}
        style={s.studentAvatar}
        onError={() => setAvatarUrl(DEFAULT_AVATAR)}
      />
      <Text style={s.studentName} numberOfLines={1}>{stu.name.split(' ')[0]}</Text>
    </View>
  );
}

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getClassById, enrollInClass, cancelEnrollment, completeClass, cancelClass, isEnrolled, refreshClasses } = useClasses();
  const { currentUser, allUsers } = useCurrentUser();
  const { isBlocked, checkBlockStatus } = useSafety();
  const { showAlert } = useAlert();
  const { allSwaps } = useSkillSwaps();
  const { socket } = useSocket();
  const [isBlockedRelation, setIsBlockedRelation] = useState(false);

  const [announcementText, setAnnouncementText] = useState('');
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentDesc, setAssignmentDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (refreshClasses) {
      void refreshClasses();
    }
  }, [refreshClasses]);

  const cls = useMemo(() => getClassById(id), [getClassById, id]);

  useEffect(() => {
    let isMounted = true;
    if (cls?.teacherId && currentUser?.id) {
      if (isBlocked(cls.teacherId)) {
        setIsBlockedRelation(true);
      } else {
        checkBlockStatus(cls.teacherId).then((res) => {
          if (isMounted) {
            setIsBlockedRelation(res.isBlocked);
          }
        });
      }
    } else {
      setIsBlockedRelation(false);
    }
    return () => {
      isMounted = false;
    };
  }, [cls?.teacherId, currentUser?.id, isBlocked, checkBlockStatus]);

  const isCurrentlyEnrolled = useMemo(() => {
    return (id && currentUser) ? isEnrolled(id, currentUser.id) : false;
  }, [id, currentUser, isEnrolled]);

  const [enrolled, setEnrolled] = useState(isCurrentlyEnrolled);

  useEffect(() => {
    setEnrolled(isCurrentlyEnrolled);
  }, [isCurrentlyEnrolled]);

  const enrolledStudents = useMemo(() => {
    if (!cls || !cls.enrollments) return [];
    return cls.enrollments
      .map(e => allUsers.find(u => String(u.id || (u as any)._id) === String(e.studentId || (e as any)._id || (e as any).student?._id)) || (e as any).student)
      .filter((u): u is NonNullable<typeof u> => u !== undefined);
  }, [cls, allUsers]);

  const teacherUser = useMemo(() => {
    if (!cls) return undefined;
    return allUsers.find(u => String(u.id) === String(cls.teacherId) || String((u as any)._id) === String(cls.teacherId)) ?? cls.teacher;
  }, [cls, allUsers]);

  const [coverUrl, setCoverUrl] = useState(() => resolveImageUrl(cls?.coverImageUrl, DEFAULT_COVER) || DEFAULT_COVER);
  const [teacherAvatarUrl, setTeacherAvatarUrl] = useState(() => resolveImageUrl(teacherUser?.avatarUrl || cls?.teacher?.avatarUrl, DEFAULT_AVATAR) || DEFAULT_AVATAR);

  useEffect(() => {
    if (cls?.coverImageUrl) {
      setCoverUrl(resolveImageUrl(cls.coverImageUrl, DEFAULT_COVER) || DEFAULT_COVER);
    }
  }, [cls?.coverImageUrl]);

  useEffect(() => {
    const avatar = teacherUser?.avatarUrl || cls?.teacher?.avatarUrl;
    if (avatar) {
      setTeacherAvatarUrl(resolveImageUrl(avatar, DEFAULT_AVATAR) || DEFAULT_AVATAR);
    }
  }, [teacherUser?.avatarUrl, cls?.teacher?.avatarUrl]);

  const handleEnroll = useCallback(() => {
    if (!cls) return;
    if (!currentUser || currentUser.id === '1' || (currentUser as any).isDemo) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to enroll in group classes.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }
    if ((cls.teacherId && isBlocked(cls.teacherId)) || isBlockedRelation) {
      showAlert('Action Blocked', 'You cannot enroll in classes hosted by this user due to block settings.');
      return;
    }
    const cost = getClassEnrollmentCost(cls.seatPriceCredits, currentUser);
    const balanceAfter = currentUser.credits - cost;
    const discountPercent = getClassDiscountPercent(currentUser);

    if (cost > 0 && balanceAfter < 0) {
      showAlert('Not enough credits', `You need ${cost} credits but have ${currentUser.credits}. Top up in the Store to enroll.`);
      return;
    }

    const pricePrompt = discountPercent > 0
      ? `Pay ${cost} credits to enroll? (${discountPercent}% Premium Member Discount Applied)\n\nCurrent balance: ${currentUser.credits}\nAfter enrollment: ${balanceAfter}`
      : `Pay ${cost} credits to enroll?\n\nCurrent balance: ${currentUser.credits}\nAfter enrollment: ${balanceAfter}`;

    showAlert(
      'Confirm Enrollment',
      cost > 0
        ? pricePrompt
        : 'Enroll in this free class?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enroll',
          onPress: () => {
            const result = enrollInClass(cls.id);
            if (result.success) {
              setEnrolled(true);
              showAlert('Enrolled!', `You're signed up for "${cls.title}".`);
            } else {
              showAlert('Cannot enroll', result.error ?? 'Something went wrong.');
            }
          },
        },
      ],
    );
  }, [cls, currentUser, isBlocked, isBlockedRelation, enrollInClass, showAlert]);

  const handleCancelEnrollment = useCallback(() => {
    if (!cls) return;
    const classHasStarted = Boolean(cls.hasStarted || cls.startedAt || cls.isLive);
    if (classHasStarted) {
      showAlert('Cannot Cancel Enrollment', 'This class has already started, so enrollment cannot be cancelled.');
      return;
    }
    showAlert(
      'Cancel enrollment?',
      `You'll be refunded ${getClassEnrollmentCost(cls.seatPriceCredits, currentUser)} credits.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Enrollment',
          style: 'destructive',
          onPress: () => {
            const res = cancelEnrollment(cls.id);
            if (res && res.error) {
              showAlert('Cannot Cancel', res.error);
            } else {
              setEnrolled(false);
            }
          },
        },
      ],
    );
  }, [cls, cancelEnrollment, showAlert]);

  const handleCompleteClass = useCallback(() => {
    if (!cls) return;
    showAlert(
      'Mark class complete?',
      `${cls.enrolledCount} student${cls.enrolledCount === 1 ? '' : 's'} will be marked as attended. You'll earn credits for each seat.`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Complete',
          onPress: () => {
            completeClass(cls.id);
            showAlert('Class completed!', `Earnings have been credited to your account.`);
          },
        },
      ],
    );
  }, [cls, completeClass, showAlert]);

  const handleCancelClass = useCallback(() => {
    if (!cls) return;
    showAlert(
      'Cancel this class?',
      'All enrolled students will be refunded their credits. This cannot be undone.',
      [
        { text: 'Keep class', style: 'cancel' },
        {
          text: 'Cancel Class',
          style: 'destructive',
          onPress: () => {
            cancelClass(cls.id);
            showAlert('Class cancelled', 'All students have been refunded.');
          },
        },
      ],
    );
  }, [cls, cancelClass, showAlert]);

  const handleStartClass = useCallback(async () => {
    if (!cls) return;
    const isBeforeSchedule = !cls.hasStarted && !cls.isLive && cls.startISO && Date.now() < new Date(cls.startISO).getTime();
    if (isBeforeSchedule) {
      const formattedTime = new Date(cls.startISO).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const formattedDate = new Date(cls.startISO).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
      showAlert(
        'Class Not Started Yet ⏰',
        `You cannot start this class call before the scheduled date and time (${formattedDate} at ${formattedTime}).`
      );
      return;
    }
    try {
      fetch(`${url}/classes/${cls.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch((e) => console.log('[handleStartClass] background notify error:', e));
      router.push(`/call/${cls.id}?mode=video` as any);
    } catch (err) {
      console.error('[handleStartClass] Error:', err);
      router.push(`/call/${cls.id}?mode=video` as any);
    }
  }, [cls, router, showAlert]);

  const handleAddAnnouncement = useCallback(async () => {
    if (!cls || !currentUser || !announcementText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${url}/classes/${cls.id}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: announcementText, teacherId: currentUser.id })
      });
      if (res.ok) {
        setAnnouncementText('');
        refreshClasses();
        showAlert('Success', 'Announcement posted.');
      } else {
        const errorData = await res.json();
        showAlert('Error', errorData.error || 'Failed to post announcement.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }, [cls, currentUser, announcementText, refreshClasses, showAlert]);

  const handleAddAssignment = useCallback(async () => {
    if (!cls || !currentUser || !assignmentTitle.trim()) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      
      setSubmitting(true);
      const file = result.assets[0];
      const formData = new FormData();
      if (file.file) {
        formData.append('file', file.file);
      } else {
        formData.append('file', {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        } as any);
      }

      const uploadRes = await fetch(`${url}/classes/upload-attachment`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!uploadRes.ok) {
        throw new Error('File upload failed');
      }

      const uploadData = await uploadRes.json();
      const fileUrl = uploadData.fileUrl;

      const res = await fetch(`${url}/classes/${cls.id}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: assignmentTitle, description: assignmentDesc, fileUrl, teacherId: currentUser.id })
      });
      if (res.ok) {
        setAssignmentTitle('');
        setAssignmentDesc('');
        refreshClasses();
        showAlert('Success', 'Assignment posted.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }, [cls, currentUser, assignmentTitle, assignmentDesc, refreshClasses, showAlert]);

  const handleSubmitAssignment = useCallback(async (assignmentId: string) => {
    if (!cls || !currentUser) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      
      setSubmitting(true);
      const file = result.assets[0];
      const formData = new FormData();
      if (file.file) {
        formData.append('file', file.file);
      } else {
        formData.append('file', {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        } as any);
      }

      const uploadRes = await fetch(`${url}/classes/upload-attachment`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!uploadRes.ok) {
        throw new Error('File upload failed');
      }

      const uploadData = await uploadRes.json();
      const fileUrl = uploadData.fileUrl;

      const res = await fetch(`${url}/classes/${cls.id}/assignments/${assignmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: currentUser.id, fileUrl })
      });
      if (res.ok) {
        refreshClasses();
        showAlert('Success', 'Assignment submitted.');
      } else {
        const errorData = await res.json();
        showAlert('Error', errorData.error || 'Failed to submit assignment.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }, [cls, currentUser, refreshClasses, showAlert]);

  const handleDownloadFile = useCallback(async (fileUrl: string) => {
    const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${url}${fileUrl}`;
    if (Platform.OS === 'web') {
      try {
        const response = await fetch(fullUrl);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        
        const filename = fullUrl.substring(fullUrl.lastIndexOf('/') + 1) || 'download';
        link.setAttribute('download', filename);
        
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } catch (err) {
        console.error('Download error:', err);
        showAlert('Error', 'Failed to download file');
      }
    } else {
      Linking.openURL(fullUrl).catch(e => showAlert('Error', 'Could not open file URL'));
    }
  }, [showAlert]);

  const isTeacher = String(cls?.teacherId) === String(currentUser?.id);
  const isFree = cls?.seatPriceCredits === 0;
  const seatsLeft = (cls?.maxCapacity || 0) - (cls?.enrolledCount || 0);
  const isFull = seatsLeft <= 0;
  const isCompleted = cls?.status === 'completed';
  const isCancelled = cls?.status === 'cancelled';
  const classOpen = cls?.status === 'open';

  const isBeforeScheduledStart = useMemo(() => {
    if (!cls?.startISO) return false;
    const startTime = new Date(cls.startISO).getTime();
    if (isNaN(startTime)) return false;
    return Date.now() < startTime;
  }, [cls?.startISO]);

  const formatDateFn = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };
  const formatTimeRange = () => {
    if (!cls?.startISO || !cls?.endISO) return '';
    const start = new Date(cls.startISO).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const end = new Date(cls.endISO).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return `${start} — ${end}`;
  };

  const teacherId = teacherUser?.id || (teacherUser as any)?._id || cls?.teacherId || cls?.teacher?.id;

  const [reviewsStats, setReviewsStats] = useState<{ averageRating: number; totalReviews: number } | null>(null);

  const fetchTeacherReviews = useCallback(async () => {
    if (!teacherId) return;
    try {
      const res = await fetch(`${url}/reviews?revieweeId=${teacherId}`);
      if (!res.ok) throw new Error('Failed to fetch reviews');
      const data = await res.json();
      if (data?.stats) {
        setReviewsStats({
          averageRating: data.stats.averageRating || 0,
          totalReviews: data.stats.totalReviews || 0,
        });
      }
    } catch (err) {
      console.error('[ClassDetail] Failed to fetch review stats:', err);
    }
  }, [teacherId]);

  useEffect(() => {
    fetchTeacherReviews();
    if (socket) {
      const handleReviewCreated = () => fetchTeacherReviews();
      const handleClassEvent = () => refreshClasses();
      socket.on('review_created', handleReviewCreated);
      socket.on('class_started', handleClassEvent);
      socket.on('class_call_started', handleClassEvent);
      socket.on('class_updated', handleClassEvent);
      socket.on('class_ended', handleClassEvent);
      return () => {
        socket.off('review_created', handleReviewCreated);
        socket.off('class_started', handleClassEvent);
        socket.off('class_call_started', handleClassEvent);
        socket.off('class_updated', handleClassEvent);
        socket.off('class_ended', handleClassEvent);
      };
    }
  }, [fetchTeacherReviews, refreshClasses, socket]);

  const teacherRating = useMemo(() => {
    const raw = reviewsStats?.averageRating ?? teacherUser?.rating ?? cls?.teacher?.rating ?? 0;
    return (typeof raw === 'number' && !isNaN(raw)) ? raw.toFixed(1) : '0.0';
  }, [reviewsStats, teacherUser, cls]);

  const teacherTotalReviews = useMemo(() => {
    return reviewsStats?.totalReviews ?? 0;
  }, [reviewsStats]);

  const teacherTotalSwaps = useMemo(() => {
    if (!teacherId) return 0;
    const swapCount = (allSwaps || []).filter(
      (s: any) => String(s.requesterId) === String(teacherId) || String(s.recipientId) === String(teacherId)
    ).length;
    const baseSwaps = teacherUser?.totalSwaps ?? cls?.teacher?.totalSwaps ?? 0;
    return Math.max(baseSwaps, swapCount);
  }, [allSwaps, teacherId, teacherUser, cls]);

  if (!cls) {
    return (
      <View style={s.notFound}>
        <Text style={s.notFoundText}>Class not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <View style={[s.coverWrap, { height: 240 }]}>
        <Image
          source={{ uri: coverUrl }}
          style={s.cover}
          onError={() => setCoverUrl(DEFAULT_COVER)}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.3)']}
          style={s.coverGradient}
        />
        <TouchableOpacity
          style={[s.backBtn, { top: insets.top + 8 }]}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={[s.statusBadge, isCompleted && s.statusCompleted, isCancelled && s.statusCancelled]}>
          <Text style={s.statusText}>{isCompleted ? 'Completed' : isCancelled ? 'Cancelled' : 'Open'}</Text>
        </View>
      </View>

      <View style={s.body}>
        <Text style={s.catText}>{cls.category} · {cls.level}</Text>
        <Text style={s.title}>{cls.title}</Text>

        <View style={s.metaCard}>
          <View style={s.metaItem}>
            <Calendar size={18} color={Colors.light.primary} />
            <Text style={s.metaLabel}>
              {cls.sessionType && cls.sessionType !== 'single'
                ? `${new Date(cls.startISO).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} — ${new Date(cls.endISO).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : formatDateFn(cls.startISO)}
            </Text>
          </View>
          <View style={s.metaDivider} />
          <View style={s.metaItem}>
            <Clock size={18} color={Colors.light.primary} />
            <Text style={s.metaLabel}>{formatTimeRange()}</Text>
          </View>
          {cls.sessionType && cls.sessionType !== 'single' && (
            <>
              <View style={s.metaDivider} />
              <View style={s.metaItem}>
                <Repeat size={18} color={Colors.light.primary} />
                <Text style={s.metaLabel}>{formatClassSchedule(cls.sessionType, cls.sessionCount, cls.scheduleDays)}</Text>
              </View>
            </>
          )}
        </View>

        {cls.billingCycle && (
          <View style={s.billingCard}>
            <View style={s.billingBadge}>
              <CreditCard size={18} color={Colors.light.primary} />
              <Text style={s.billingBadgeText}>{formatBillingCycle(cls.billingCycle)} Billing</Text>
            </View>
            <Text style={s.billingSub}>
              {cls.billingCycle === 'monthly'
                ? 'Enrolling grants access to all sessions during the monthly billing cycle.'
                : 'One-time payment covers full course access.'}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={s.teacherCard}
          onPress={() => router.push(`/profile/${teacherId || cls.teacher.id}` as any)}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: teacherAvatarUrl }}
            style={s.teacherAvatar}
            onError={() => setTeacherAvatarUrl(DEFAULT_AVATAR)}
          />
          <View style={s.teacherInfo}>
            <Text style={s.teacherName}>{teacherUser?.name || cls.teacher.name}</Text>
            <View style={s.teacherMeta}>
              <Star size={12} fill={Colors.light.accent} color={Colors.light.accent} />
              <Text style={s.teacherRating}>{teacherRating}</Text>
              <Text style={s.teacherReviews}> ({teacherTotalReviews})</Text>
              <Text style={s.teacherSwaps}> · {teacherTotalSwaps} swap{teacherTotalSwaps === 1 ? '' : 's'}</Text>
            </View>
          </View>
          <View style={s.teacherAction}>
            <Text style={s.teacherActionText}>View →</Text>
          </View>
        </TouchableOpacity>

        <Text style={s.sectionTitle}>About this class</Text>
        <Text style={s.description}>{cls.description}</Text>

        <View style={s.seatsCard}>
          <View style={s.seatsHeader}>
            <Users size={18} color={Colors.light.primary} />
            <Text style={s.seatsTitle}>{cls.enrolledCount} of {cls.maxCapacity} enrolled</Text>
          </View>
          <View style={s.seatsBar}>
            <View style={[s.seatsFill, { width: `${Math.round((cls.enrolledCount / cls.maxCapacity) * 100)}%` }]} />
          </View>
          <Text style={s.seatsLeft}>{seatsLeft} seat{seatsLeft === 1 ? '' : 's'} left</Text>
        </View>

        {enrolledStudents.length > 0 && (
          <View style={s.studentsSection}>
            <Text style={s.sectionTitle}>Who's coming</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.studentScroll}>
              {enrolledStudents.map(stu => (
                <StudentAvatarItem key={stu.id} stu={stu} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Announcements Section */}
        {(enrolled || isTeacher) && (
          <>
            <View style={s.cardSection}>
              <View style={s.sectionHeader}>
                <Megaphone size={20} color={Colors.light.primary} />
                <Text style={s.sectionTitle}>Announcements</Text>
              </View>
              {cls.announcements?.map((ann: any, idx: number) => (
                <View key={idx} style={s.announcementItem}>
                  <Text style={s.announcementText}>{ann.text}</Text>
                  <Text style={s.announcementDate}>{new Date(ann.createdAt).toLocaleDateString()} {new Date(ann.createdAt).toLocaleTimeString()}</Text>
                </View>
              ))}
              {(!cls.announcements || cls.announcements.length === 0) && (
                <Text style={s.emptyText}>No announcements yet.</Text>
              )}
              {isTeacher && (
                <View style={s.inputContainer}>
                  <TextInput
                    style={s.textInput}
                    placeholder="Write an announcement..."
                    value={announcementText}
                    onChangeText={setAnnouncementText}
                    multiline
                  />
                  <TouchableOpacity style={s.actionBtn} onPress={handleAddAnnouncement} disabled={submitting}>
                    <Text style={s.actionBtnText}>Post</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Assignments Section */}
            <View style={s.cardSection}>
              <View style={s.sectionHeader}>
                <FileText size={20} color={Colors.light.primary} />
                <Text style={s.sectionTitle}>Assignments</Text>
              </View>
              {cls.assignments?.map((ass: any, idx: number) => (
                <View key={idx} style={s.assignmentItem}>
                  <Text style={s.assignmentTitle}>{ass.title}</Text>
                  {ass.description ? <Text style={s.assignmentDesc}>{ass.description}</Text> : null}
                  <TouchableOpacity onPress={() => handleDownloadFile(ass.fileUrl)}>
                    <Text style={s.downloadLink}>Download Attachment</Text>
                  </TouchableOpacity>
                  
                  {isTeacher ? (
                    <View style={s.submissionsContainer}>
                      <Text style={s.submissionsTitle}>Submissions:</Text>
                      {ass.submissions?.length > 0 ? ass.submissions.map((sub: any, sIdx: number) => {
                        const student = allUsers.find(u => String(u.id || (u as any)._id) === String(sub.studentId));
                        return (
                          <View key={sIdx} style={s.submissionItem}>
                            <Text style={s.submissionStudent}>{student?.name || 'Unknown'}</Text>
                            <Text style={s.submissionDate}>{new Date(sub.submittedAt).toLocaleString()}</Text>
                            <TouchableOpacity onPress={() => handleDownloadFile(sub.fileUrl)}>
                              <Text style={s.downloadLink}>View File</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }) : <Text style={s.emptyText}>No submissions yet.</Text>}
                    </View>
                  ) : (enrolled ? (
                    <View style={s.studentSubmitContainer}>
                      {ass.submissions?.some((sub: any) => String(sub.studentId) === String(currentUser?.id)) ? (
                        <Text style={s.submittedText}>✓ Submitted</Text>
                      ) : (
                        <TouchableOpacity style={s.uploadBtn} onPress={() => handleSubmitAssignment(ass._id || ass.id)} disabled={submitting}>
                          <UploadCloud size={16} color="#FFFFFF" />
                          <Text style={s.uploadBtnText}>Upload Submission</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : null)}
                </View>
              ))}
              {(!cls.assignments || cls.assignments.length === 0) && (
                <Text style={s.emptyText}>No assignments yet.</Text>
              )}
              {isTeacher && (
                <View style={s.inputContainer}>
                  <TextInput
                    style={s.textInput}
                    placeholder="Assignment Title"
                    value={assignmentTitle}
                    onChangeText={setAssignmentTitle}
                  />
                  <TextInput
                    style={s.textInput}
                    placeholder="Description (Optional)"
                    value={assignmentDesc}
                    onChangeText={setAssignmentDesc}
                    multiline
                  />
                  <TouchableOpacity style={s.actionBtn} onPress={handleAddAssignment} disabled={submitting}>
                    <Text style={s.actionBtnText}>Attach File & Post</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        )}

        {/* Recordings Section */}
        {cls.recordings && cls.recordings.length > 0 && (
          <View style={s.cardSection}>
            <View style={s.sectionHeader}>
              <Video size={20} color={Colors.light.primary} />
              <Text style={s.sectionTitle}>Class Recordings</Text>
            </View>
            {cls.recordings.map((rec: any, idx: number) => (
              <TouchableOpacity key={idx} style={s.assignmentItem} onPress={() => Linking.openURL(rec.url)}>
                <Text style={s.assignmentTitle}>Recording {idx + 1}</Text>
                <Text style={s.assignmentDesc}>{new Date(rec.recordedAt).toLocaleString()}</Text>
                <Text style={s.downloadLink}>Watch Recording</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Pricing + Action */}
        <View style={s.pricingCard}>
          <View style={s.priceRow}>
            {isFree ? (
              <View style={s.freeTag}>
                <Sparkles size={18} color="#10B981" />
                <Text style={s.freePriceText}>Free Class</Text>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <View style={s.priceTag}>
                  <Coins size={20} color="#F59E0B" />
                  <Text style={s.priceText}>{formatCredits(getClassEnrollmentCost(cls.seatPriceCredits, currentUser))}</Text>
                  {getClassDiscountPercent(currentUser) > 0 && (
                    <Text style={{ fontSize: 13, textDecorationLine: 'line-through', color: '#94A3B8', marginLeft: 6 }}>
                      {cls.seatPriceCredits}
                    </Text>
                  )}
                  <Text style={s.pricePerText}>per seat · {cls.billingCycle === 'monthly' ? 'monthly' : 'one-time'}</Text>
                </View>
                {getClassDiscountPercent(currentUser) > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                    <Crown size={13} color="#6366F1" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#6366F1' }}>
                      {getClassDiscountPercent(currentUser)}% Premium Member Discount Applied!
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {isTeacher ? (
            <View style={s.teacherActions}>
              {classOpen && (
                <>
                  {!cls.hasStarted && !cls.isLive && isBeforeScheduledStart ? (
                    <TouchableOpacity style={s.scheduledWaitingBtn} onPress={handleStartClass} activeOpacity={0.8}>
                      <Clock size={18} color="#6366F1" />
                      <Text style={s.scheduledWaitingBtnText}>
                        Scheduled for {new Date(cls.startISO).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} at {new Date(cls.startISO).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[s.startClassBtn, cls.isLive && { backgroundColor: '#10B981' }]} onPress={handleStartClass} activeOpacity={0.8}>
                      <Video size={20} color="#FFFFFF" />
                      <Text style={s.startClassBtnText}>{cls.isLive ? 'Rejoin Class Call' : 'Start Class Call'}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={s.completeBtn} onPress={handleCompleteClass} activeOpacity={0.8}>
                    <CheckCircle2 size={20} color="#FFFFFF" />
                    <Text style={s.completeBtnText}>Mark Complete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.cancelClassBtn} onPress={handleCancelClass} activeOpacity={0.8}>
                    <XCircle size={18} color={Colors.light.error} />
                    <Text style={s.cancelClassBtnText}>Cancel Class</Text>
                  </TouchableOpacity>
                </>
              )}
              {isCompleted && <Text style={s.completedNote}>This class has been completed.</Text>}
              {isCancelled && <Text style={s.cancelledNote}>This class was cancelled.</Text>}
            </View>
          ) : (
            <View>
              {enrolled && classOpen ? (
                <>
                  {Boolean(cls.isLive) ? (
                    <TouchableOpacity style={[s.startClassBtn, { backgroundColor: '#10B981' }]} onPress={() => router.push(`/call/${cls.id}?mode=video` as any)} activeOpacity={0.8}>
                      <Video size={20} color="#FFFFFF" />
                      <Text style={s.startClassBtnText}>Join Class Call (Live Now)</Text>
                    </TouchableOpacity>
                  ) : Boolean(cls.hasStarted || cls.startedAt) ? (
                    <View style={s.waitingTeacherPill}>
                      <Clock size={16} color="#6366F1" />
                      <Text style={s.waitingTeacherText}>Class in session — Teacher will start call shortly</Text>
                    </View>
                  ) : (
                    <View style={s.waitingTeacherPill}>
                      <Clock size={16} color="#6366F1" />
                      <Text style={s.waitingTeacherText}>Class not live yet — Teacher has not joined</Text>
                    </View>
                  )}
                  {Boolean(cls.hasStarted || cls.startedAt || cls.isLive) ? (
                    <View style={s.enrolledLockedPill}>
                      <CheckCircle2 size={18} color="#FFFFFF" />
                      <Text style={s.enrolledLockedText}>Enrolled — Class in progress</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={s.enrolledBtn} onPress={handleCancelEnrollment} activeOpacity={0.8}>
                      <CheckCircle2 size={18} color="#FFFFFF" />
                      <Text style={s.enrolledBtnText}>Enrolled — Tap to cancel</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : !enrolled && classOpen && !isFull ? (
                <TouchableOpacity style={s.enrollBtn} onPress={handleEnroll} activeOpacity={0.8}>
                  <Text style={s.enrollBtnText}>
                    {isFree ? 'Enroll Free' : `Enroll for ${getClassEnrollmentCost(cls.seatPriceCredits, currentUser)} credits ${cls.billingCycle === 'monthly' ? '/month' : ''}`}
                  </Text>
                </TouchableOpacity>
              ) : !enrolled && classOpen && isFull ? (
                <View style={s.fullBtn}>
                  <Text style={s.fullBtnText}>Class Full</Text>
                </View>
              ) : isCompleted ? (
                <View style={s.endedBtn}>
                  <CheckCircle2 size={18} color={Colors.light.textTertiary} />
                  <Text style={s.endedBtnText}>Class completed</Text>
                </View>
              ) : (
                <View style={s.endedBtn}>
                  <XCircle size={18} color={Colors.light.textTertiary} />
                  <Text style={s.endedBtnText}>Class cancelled</Text>
                </View>
              )}
              {!enrolled && classOpen && !isFree && !isFull && (
                <Text style={s.balanceNote}>Your balance: {currentUser?.credits ?? 0} credits</Text>
              )}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  coverWrap: { position: 'relative' },
  cover: { width: '100%', height: '100%' },
  coverGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  backBtn: { position: 'absolute', left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  statusBadge: { position: 'absolute', top: 60, right: 16, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(99,102,241,0.9)' },
  statusCompleted: { backgroundColor: 'rgba(139,92,246,0.9)' },
  statusCancelled: { backgroundColor: 'rgba(239,68,68,0.9)' },
  statusText: { fontSize: 12, fontWeight: '700' as const, color: '#FFFFFF' },
  body: { padding: 20, paddingTop: 16 },
  catText: { fontSize: 12, fontWeight: '700' as const, color: Colors.light.secondary, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800' as const, color: Colors.light.text, marginBottom: 16, lineHeight: 30 },
  metaCard: { backgroundColor: Colors.light.backgroundTertiary, borderRadius: 16, padding: 16, marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaLabel: { fontSize: 15, fontWeight: '600' as const, color: Colors.light.text },
  metaDivider: { height: 1, backgroundColor: Colors.light.border, marginVertical: 12 },
  billingCard: { backgroundColor: Colors.light.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.light.borderLight },
  billingBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  billingBadgeText: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.primary },
  billingSub: { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 18 },
  teacherCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.light.card, borderRadius: 16, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: Colors.light.borderLight },
  teacherAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: Colors.light.border },
  teacherInfo: { flex: 1 },
  teacherName: { fontSize: 16, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 4 },
  teacherMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teacherRating: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.text },
  teacherReviews: { fontSize: 13, color: Colors.light.textTertiary },
  teacherSwaps: { fontSize: 13, color: Colors.light.textTertiary },
  teacherAction: { paddingHorizontal: 8 },
  teacherActionText: { fontSize: 14, fontWeight: '600' as const, color: Colors.light.primary },
  sectionTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 10 },
  description: { fontSize: 15, lineHeight: 22, color: Colors.light.textSecondary, marginBottom: 20 },
  seatsCard: { backgroundColor: Colors.light.backgroundTertiary, borderRadius: 16, padding: 16, marginBottom: 20 },
  seatsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  seatsTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.text },
  seatsBar: { height: 8, backgroundColor: Colors.light.border, borderRadius: 4, marginBottom: 8 },
  seatsFill: { height: '100%', backgroundColor: Colors.light.primary, borderRadius: 4 },
  seatsLeft: { fontSize: 13, color: Colors.light.textTertiary, fontWeight: '500' as const },
  studentsSection: { marginBottom: 20 },
  studentScroll: { gap: 12, paddingRight: 20 },
  studentChip: { alignItems: 'center', gap: 6, width: 60 },
  studentAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: Colors.light.border },
  studentName: { fontSize: 12, fontWeight: '600' as const, color: Colors.light.textSecondary },
  pricingCard: { backgroundColor: Colors.light.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: Colors.light.borderLight, shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  freeTag: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(16,185,129,0.12)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  freePriceText: { fontSize: 18, fontWeight: '800' as const, color: '#10B981' },
  priceTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  priceText: { fontSize: 22, fontWeight: '800' as const, color: '#F59E0B' },
  pricePerText: { fontSize: 14, color: Colors.light.textTertiary, fontWeight: '500' as const },
  enrollBtn: { backgroundColor: Colors.light.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  enrollBtnText: { fontSize: 16, fontWeight: '700' as const, color: '#FFFFFF' },
  enrolledBtn: { backgroundColor: '#10B981', borderRadius: 16, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  enrolledBtnText: { fontSize: 15, fontWeight: '700' as const, color: '#FFFFFF' },
  enrolledLockedPill: { backgroundColor: '#059669', borderRadius: 16, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  enrolledLockedText: { fontSize: 15, fontWeight: '700' as const, color: '#FFFFFF' },
  fullBtn: { backgroundColor: Colors.light.backgroundTertiary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  fullBtnText: { fontSize: 16, fontWeight: '700' as const, color: Colors.light.textTertiary },
  endedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.light.backgroundTertiary, borderRadius: 16, paddingVertical: 16 },
  endedBtnText: { fontSize: 15, fontWeight: '600' as const, color: Colors.light.textTertiary },
  balanceNote: { textAlign: 'center', fontSize: 13, color: Colors.light.textTertiary, marginTop: 10 },
  teacherActions: { gap: 10 },
  startClassBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6366F1', borderRadius: 16, paddingVertical: 16, marginBottom: 4 },
  startClassBtnText: { fontSize: 16, fontWeight: '700' as const, color: '#FFFFFF' },
  scheduledWaitingBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: 16, paddingVertical: 16, marginBottom: 4, borderWidth: 1.5, borderColor: 'rgba(99,102,241,0.3)', borderStyle: 'dashed' },
  scheduledWaitingBtnText: { fontSize: 14, fontWeight: '700' as const, color: '#6366F1', textAlign: 'center' },
  waitingTeacherPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)' },
  waitingTeacherText: { fontSize: 14, fontWeight: '600' as const, color: '#6366F1', textAlign: 'center' },
  joinLiveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#10B981', borderRadius: 16, paddingVertical: 16, marginBottom: 8 },
  joinLiveBtnText: { fontSize: 16, fontWeight: '700' as const, color: '#FFFFFF' },
  completeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#10B981', borderRadius: 16, paddingVertical: 16 },
  completeBtnText: { fontSize: 16, fontWeight: '700' as const, color: '#FFFFFF' },
  cancelClassBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 16, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  cancelClassBtnText: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.error },
  completedNote: { textAlign: 'center', fontSize: 14, color: Colors.light.textTertiary, fontStyle: 'italic' as const, paddingVertical: 12 },
  cancelledNote: { textAlign: 'center', fontSize: 14, color: Colors.light.error, fontStyle: 'italic' as const, paddingVertical: 12 },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  notFoundText: { fontSize: 18, fontWeight: '600' as const, color: Colors.light.textSecondary },
  backBtnText: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.primary },
  cardSection: { backgroundColor: Colors.light.backgroundTertiary, borderRadius: 16, padding: 16, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  announcementItem: { backgroundColor: Colors.light.card, padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.light.borderLight },
  announcementText: { fontSize: 15, color: Colors.light.text, marginBottom: 4 },
  announcementDate: { fontSize: 12, color: Colors.light.textTertiary },
  emptyText: { fontSize: 14, color: Colors.light.textTertiary, fontStyle: 'italic', marginBottom: 8 },
  inputContainer: { marginTop: 12, gap: 8 },
  textInput: { backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 12, padding: 12, fontSize: 15, color: Colors.light.text, minHeight: 44 },
  actionBtn: { backgroundColor: Colors.light.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  actionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  assignmentItem: { backgroundColor: Colors.light.card, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.light.borderLight },
  assignmentTitle: { fontSize: 16, fontWeight: '700', color: Colors.light.text, marginBottom: 4 },
  assignmentDesc: { fontSize: 14, color: Colors.light.textSecondary, marginBottom: 8 },
  downloadLink: { fontSize: 14, color: Colors.light.primary, fontWeight: '600', marginBottom: 12 },
  submissionsContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.light.borderLight },
  submissionsTitle: { fontSize: 14, fontWeight: '600', color: Colors.light.text, marginBottom: 8 },
  submissionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.light.backgroundTertiary, padding: 10, borderRadius: 8, marginBottom: 6 },
  submissionStudent: { fontSize: 14, fontWeight: '600', color: Colors.light.text },
  submissionDate: { fontSize: 12, color: Colors.light.textTertiary },
  studentSubmitContainer: { marginTop: 12 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.light.primary, paddingVertical: 10, borderRadius: 12 },
  uploadBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  submittedText: { color: '#10B981', fontSize: 15, fontWeight: '600' },
});
