import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Image, TouchableOpacity, Linking, Platform, useWindowDimensions } from 'react-native';
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
import { logCourseView } from '@/lib/analytics';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
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
      <Text style={s.studentName}>{stu.name.split(' ')[0]}</Text>
    </View>
  );
}

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isSmallScreen = windowWidth < 600;
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

  // 📊 Track course view event in Firebase Analytics
  useEffect(() => {
    if (cls?.id && cls?.title) {
      logCourseView(String(cls.id), cls.title);
    }
  }, [cls?.id, cls?.title]);

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

  const handleDeleteAnnouncement = useCallback((announcementId: string) => {
    if (!cls || !currentUser) return;
    showAlert(
      'Delete Announcement?',
      'Are you sure you want to delete this announcement?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${url}/classes/${cls.id}/announcements/${announcementId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherId: currentUser.id })
              });
              if (res.ok) {
                refreshClasses();
              } else {
                const errorData = await res.json();
                showAlert('Error', errorData.error || 'Failed to delete announcement.');
              }
            } catch (err) {
              console.error(err);
            }
          }
        }
      ]
    );
  }, [cls, currentUser, refreshClasses, showAlert]);

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
      if (Platform.OS === 'web' && file.file) {
        formData.append('file', file.file);
      } else {
        const fallbackName = file.uri.split('/').pop() || 'upload.bin';
        const match = /\.(\w+)$/.exec(fallbackName);
        const fallbackType = match ? (match[1].toLowerCase() === 'pdf' ? 'application/pdf' : `image/${match[1]}`) : 'application/octet-stream';

        formData.append('file', {
          uri: file.uri,
          name: file.name || fallbackName,
          type: file.mimeType || fallbackType,
        } as any);
      }

      let uploadData: any;
      if (Platform.OS === 'web') {
        const uploadRes = await fetch(`${url}/classes/upload-attachment`, {
          method: 'POST',
          body: formData,
          headers: { 'Accept': 'application/json' },
        });
        if (!uploadRes.ok) throw new Error('File upload failed');
        uploadData = await uploadRes.json();
      } else {
        uploadData = await new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${url}/classes/upload-attachment`);
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try { resolve(JSON.parse(xhr.responseText)); }
              catch (e) { reject(new Error('Failed to parse upload response')); }
            } else {
              reject(new Error(`Upload failed with status: ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.send(formData);
        });
      }
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
      } else {
        const errorData = await res.json().catch(() => ({}));
        showAlert('Error', errorData.error || 'Failed to post assignment.');
      }
    } catch (err: any) {
      console.error(err);
      showAlert('Error', err.message || 'An error occurred during upload.');
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
      if (Platform.OS === 'web' && file.file) {
        formData.append('file', file.file);
      } else {
        const fallbackName = file.uri.split('/').pop() || 'upload.bin';
        const match = /\.(\w+)$/.exec(fallbackName);
        const fallbackType = match ? (match[1].toLowerCase() === 'pdf' ? 'application/pdf' : `image/${match[1]}`) : 'application/octet-stream';

        formData.append('file', {
          uri: file.uri,
          name: file.name || fallbackName,
          type: file.mimeType || fallbackType,
        } as any);
      }

      let uploadData: any;
      if (Platform.OS === 'web') {
        const uploadRes = await fetch(`${url}/classes/upload-attachment`, {
          method: 'POST',
          body: formData,
          headers: { 'Accept': 'application/json' },
        });
        if (!uploadRes.ok) throw new Error('File upload failed');
        uploadData = await uploadRes.json();
      } else {
        uploadData = await new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${url}/classes/upload-attachment`);
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try { resolve(JSON.parse(xhr.responseText)); }
              catch (e) { reject(new Error('Failed to parse upload response')); }
            } else {
              reject(new Error(`Upload failed with status: ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.send(formData);
        });
      }
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
    } catch (err: any) {
      console.error(err);
      showAlert('Error', err.message || 'An error occurred during upload.');
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
      <View style={[s.coverWrap, { height: isSmallScreen ? 180 : 240 }]}>
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
          style={[s.backBtn, { top: insets.top + (isSmallScreen ? 4 : 8) }]}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <ArrowLeft size={isSmallScreen ? 18 : 22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={[s.statusBadge, isSmallScreen && s.statusBadgeMobile, isCompleted && s.statusCompleted, isCancelled && s.statusCancelled]}>
          <Text style={[s.statusText, isSmallScreen && s.statusTextMobile]}>{isCompleted ? 'Completed' : isCancelled ? 'Cancelled' : 'Open'}</Text>
        </View>
      </View>

      <View style={[s.body, isSmallScreen && s.bodyMobile]}>
        <Text style={[s.catText, isSmallScreen && s.catTextMobile]}>{cls.category} · {cls.level}</Text>
        <Text style={[s.title, isSmallScreen && s.titleMobile]}>{cls.title}</Text>

        <View style={[s.metaCard, isSmallScreen && s.metaCardMobile]}>
          <View style={s.metaItem}>
            <Calendar size={isSmallScreen ? 14 : 18} color={Colors.light.primary} />
            <Text style={[s.metaLabel, isSmallScreen && s.metaLabelMobile]}>
              {cls.sessionType && cls.sessionType !== 'single'
                ? `${new Date(cls.startISO).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} — ${new Date(cls.endISO).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : formatDateFn(cls.startISO)}
            </Text>
          </View>
          <View style={[s.metaDivider, isSmallScreen && s.metaDividerMobile]} />
          <View style={s.metaItem}>
            <Clock size={isSmallScreen ? 14 : 18} color={Colors.light.primary} />
            <Text style={[s.metaLabel, isSmallScreen && s.metaLabelMobile]}>{formatTimeRange()}</Text>
          </View>
          {cls.sessionType && cls.sessionType !== 'single' && (
            <>
              <View style={[s.metaDivider, isSmallScreen && s.metaDividerMobile]} />
              <View style={s.metaItem}>
                <Repeat size={isSmallScreen ? 14 : 18} color={Colors.light.primary} />
                <Text style={[s.metaLabel, isSmallScreen && s.metaLabelMobile]}>{formatClassSchedule(cls.sessionType, cls.sessionCount, cls.scheduleDays)}</Text>
              </View>
            </>
          )}
        </View>

        {cls.billingCycle && (
          <View style={[s.billingCard, isSmallScreen && s.billingCardMobile]}>
            <View style={s.billingBadge}>
              <CreditCard size={isSmallScreen ? 15 : 18} color={Colors.light.primary} />
              <Text style={[s.billingBadgeText, isSmallScreen && s.billingBadgeTextMobile]}>{formatBillingCycle(cls.billingCycle)} Billing</Text>
            </View>
            <Text style={[s.billingSub, isSmallScreen && s.billingSubMobile]}>
              {cls.billingCycle === 'monthly'
                ? 'Enrolling grants access to all sessions during the monthly billing cycle.'
                : 'One-time payment covers full course access.'}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[s.teacherCard, isSmallScreen && s.teacherCardMobile]}
          onPress={() => router.push(`/profile/${teacherId || cls.teacher.id}` as any)}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: teacherAvatarUrl }}
            style={[s.teacherAvatar, isSmallScreen && s.teacherAvatarMobile]}
            onError={() => setTeacherAvatarUrl(DEFAULT_AVATAR)}
          />
          <View style={s.teacherInfo}>
            <Text style={[s.teacherName, isSmallScreen && s.teacherNameMobile]}>{teacherUser?.name || cls.teacher.name}</Text>
            <View style={s.teacherMeta}>
              <Star size={isSmallScreen ? 10 : 12} fill={Colors.light.accent} color={Colors.light.accent} />
              <Text style={[s.teacherRating, isSmallScreen && s.teacherRatingMobile]}>{teacherRating}</Text>
              <Text style={[s.teacherReviews, isSmallScreen && s.teacherReviewsMobile]}> ({teacherTotalReviews})</Text>
              <Text style={[s.teacherSwaps, isSmallScreen && s.teacherSwapsMobile]}> · {teacherTotalSwaps} swap{teacherTotalSwaps === 1 ? '' : 's'}</Text>
            </View>
          </View>
          <View style={s.teacherAction}>
            <Text style={[s.teacherActionText, isSmallScreen && s.teacherActionTextMobile]}>View →</Text>
          </View>
        </TouchableOpacity>

        <Text style={[s.sectionTitle, isSmallScreen && s.sectionTitleMobile]}>About this class</Text>
        <Text style={[s.description, isSmallScreen && s.descriptionMobile]}>{cls.description}</Text>

        <View style={[s.seatsCard, isSmallScreen && s.seatsCardMobile]}>
          <View style={s.seatsHeader}>
            <Users size={isSmallScreen ? 15 : 18} color={Colors.light.primary} />
            <Text style={[s.seatsTitle, isSmallScreen && s.seatsTitleMobile]}>{cls.enrolledCount} of {cls.maxCapacity} enrolled</Text>
          </View>
          <View style={s.seatsBar}>
            <View style={[s.seatsFill, { width: `${Math.round((cls.enrolledCount / cls.maxCapacity) * 100)}%` }]} />
          </View>
          <Text style={[s.seatsLeft, isSmallScreen && s.seatsLeftMobile]}>{seatsLeft} seat{seatsLeft === 1 ? '' : 's'} left</Text>
        </View>

        {enrolledStudents.length > 0 && (
          <View style={s.studentsSection}>
            <Text style={[s.sectionTitle, isSmallScreen && s.sectionTitleMobile]}>Who's coming</Text>
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
            <View style={[s.cardSection, isSmallScreen && s.cardSectionMobile]}>
              <View style={[s.sectionHeader, isSmallScreen && s.sectionHeaderMobile]}>
                <Megaphone size={isSmallScreen ? 16 : 20} color={Colors.light.primary} />
                <Text style={[s.sectionTitle, isSmallScreen && s.sectionTitleMobile]}>Announcements</Text>
              </View>
              {cls.announcements?.map((ann: any, idx: number) => (
                <View key={idx} style={[s.announcementItem, isSmallScreen && s.announcementItemMobile]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={[s.announcementText, isSmallScreen && s.announcementTextMobile, { flex: 1 }]}>{ann.text}</Text>
                    {isTeacher && (
                      <TouchableOpacity onPress={() => handleDeleteAnnouncement(ann._id)}>
                        <Text style={{ color: 'red', fontSize: isSmallScreen ? 10.5 : 12, marginLeft: 8 }}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[s.announcementDate, isSmallScreen && s.announcementDateMobile]}>{new Date(ann.createdAt).toLocaleDateString()} {new Date(ann.createdAt).toLocaleTimeString()}</Text>
                </View>
              ))}
              {(!cls.announcements || cls.announcements.length === 0) && (
                <Text style={[s.emptyText, isSmallScreen && s.emptyTextMobile]}>No announcements yet.</Text>
              )}
              {isTeacher && (
                <View style={[s.inputContainer, isSmallScreen && s.inputContainerMobile]}>
                  <TextInput
                    style={[s.textInput, isSmallScreen && s.textInputMobile]}
                    placeholder="Write an announcement..."
                    placeholderTextColor={Colors.light.textTertiary}
                    value={announcementText}
                    onChangeText={setAnnouncementText}
                    multiline
                  />
                  <TouchableOpacity style={[s.actionBtn, isSmallScreen && s.actionBtnMobile]} onPress={handleAddAnnouncement} disabled={submitting}>
                    <Text style={[s.actionBtnText, isSmallScreen && s.actionBtnTextMobile]}>Post</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Assignments Section */}
            <View style={[s.cardSection, isSmallScreen && s.cardSectionMobile]}>
              <View style={[s.sectionHeader, isSmallScreen && s.sectionHeaderMobile]}>
                <FileText size={isSmallScreen ? 16 : 20} color={Colors.light.primary} />
                <Text style={[s.sectionTitle, isSmallScreen && s.sectionTitleMobile]}>Assignments</Text>
              </View>
              {cls.assignments?.map((ass: any, idx: number) => (
                <View key={idx} style={[s.assignmentItem, isSmallScreen && s.assignmentItemMobile]}>
                  <Text style={[s.assignmentTitle, isSmallScreen && s.assignmentTitleMobile]}>{ass.title}</Text>
                  {ass.description ? <Text style={[s.assignmentDesc, isSmallScreen && s.assignmentDescMobile]}>{ass.description}</Text> : null}
                  <TouchableOpacity onPress={() => handleDownloadFile(ass.fileUrl)}>
                    <Text style={[s.downloadLink, isSmallScreen && s.downloadLinkMobile]}>Download Attachment</Text>
                  </TouchableOpacity>

                  {isTeacher ? (
                    <View style={[s.submissionsContainer, isSmallScreen && s.submissionsContainerMobile]}>
                      <Text style={[s.submissionsTitle, isSmallScreen && s.submissionsTitleMobile]}>Submissions:</Text>
                      {ass.submissions?.length > 0 ? ass.submissions.map((sub: any, sIdx: number) => {
                        const student = allUsers.find(u => String(u.id || (u as any)._id) === String(sub.studentId));
                        return (
                          <View key={sIdx} style={[s.submissionItem, isSmallScreen && s.submissionItemMobile]}>
                            <Text style={[s.submissionStudent, isSmallScreen && s.submissionStudentMobile]}>{student?.name || 'Unknown'}</Text>
                            <Text style={[s.submissionDate, isSmallScreen && s.submissionDateMobile]}>{new Date(sub.submittedAt).toLocaleString()}</Text>
                            <TouchableOpacity onPress={() => handleDownloadFile(sub.fileUrl)}>
                              <Text style={[s.downloadLink, isSmallScreen && s.downloadLinkMobile]}>View File</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }) : <Text style={[s.emptyText, isSmallScreen && s.emptyTextMobile]}>No submissions yet.</Text>}
                    </View>
                  ) : (enrolled ? (
                    <View style={[s.studentSubmitContainer, isSmallScreen && s.studentSubmitContainerMobile]}>
                      {ass.submissions?.some((sub: any) => String(sub.studentId) === String(currentUser?.id)) ? (
                        <Text style={[s.submittedText, isSmallScreen && s.submittedTextMobile]}>✓ Submitted</Text>
                      ) : (
                        <TouchableOpacity style={[s.uploadBtn, isSmallScreen && s.uploadBtnMobile]} onPress={() => handleSubmitAssignment(ass._id || ass.id)} disabled={submitting}>
                          <UploadCloud size={isSmallScreen ? 13 : 16} color="#FFFFFF" />
                          <Text style={[s.uploadBtnText, isSmallScreen && s.uploadBtnTextMobile]}>Upload Submission</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : null)}
                </View>
              ))}
              {(!cls.assignments || cls.assignments.length === 0) && (
                <Text style={[s.emptyText, isSmallScreen && s.emptyTextMobile]}>No assignments yet.</Text>
              )}
              {isTeacher && (
                <View style={[s.inputContainer, isSmallScreen && s.inputContainerMobile]}>
                  <TextInput
                    style={[s.textInput, isSmallScreen && s.textInputMobile]}
                    placeholder="Assignment Title"
                    placeholderTextColor={Colors.light.textTertiary}
                    value={assignmentTitle}
                    onChangeText={setAssignmentTitle}
                  />
                  <TextInput
                    style={[s.textInput, isSmallScreen && s.textInputMobile]}
                    placeholder="Description (Optional)"
                    placeholderTextColor={Colors.light.textTertiary}
                    value={assignmentDesc}
                    onChangeText={setAssignmentDesc}
                    multiline
                  />
                  <TouchableOpacity style={[s.actionBtn, isSmallScreen && s.actionBtnMobile]} onPress={handleAddAssignment} disabled={submitting}>
                    <Text style={[s.actionBtnText, isSmallScreen && s.actionBtnTextMobile]}>Attach File & Post</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        )}

        {/* Recordings Section */}
        {(isTeacher || enrolled) && cls.recordings && cls.recordings.length > 0 && (
          <View style={[s.cardSection, isSmallScreen && s.cardSectionMobile]}>
            <View style={[s.sectionHeader, isSmallScreen && s.sectionHeaderMobile]}>
              <Video size={isSmallScreen ? 16 : 20} color={Colors.light.primary} />
              <Text style={[s.sectionTitle, isSmallScreen && s.sectionTitleMobile]}>Class Recordings</Text>
            </View>
            {cls.recordings.map((rec: any, idx: number) => (
              <TouchableOpacity key={idx} style={[s.assignmentItem, isSmallScreen && s.assignmentItemMobile]} onPress={() => Linking.openURL(rec.url)}>
                <Text style={[s.assignmentTitle, isSmallScreen && s.assignmentTitleMobile]}>Recording {idx + 1}</Text>
                <Text style={[s.assignmentDesc, isSmallScreen && s.assignmentDescMobile]}>{new Date(rec.recordedAt).toLocaleString()}</Text>
                <Text style={[s.downloadLink, isSmallScreen && s.downloadLinkMobile]}>Watch Recording</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Pricing + Action */}
        <View style={[s.pricingCard, isSmallScreen && s.pricingCardMobile]}>
          <View style={[s.priceRow, isSmallScreen && s.priceRowMobile]}>
            {isFree ? (
              <View style={[s.freeTag, isSmallScreen && s.freeTagMobile]}>
                <Sparkles size={isSmallScreen ? 14 : 18} color="#10B981" />
                <Text style={[s.freePriceText, isSmallScreen && s.freePriceTextMobile]}>Free Class</Text>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <View style={[s.priceTag, isSmallScreen && s.priceTagMobile]}>
                  <Coins size={isSmallScreen ? 15 : 20} color="#F59E0B" />
                  <Text style={[s.priceText, isSmallScreen && s.priceTextMobile]}>
                    {formatCredits(!isTeacher ? getClassEnrollmentCost(cls.seatPriceCredits, currentUser) : cls.seatPriceCredits)}
                  </Text>
                  {!isTeacher && getClassDiscountPercent(currentUser) > 0 && (
                    <Text style={[{ fontSize: 13, textDecorationLine: 'line-through', color: '#94A3B8', marginLeft: 6 }, isSmallScreen && { fontSize: 11, marginLeft: 4 }]}>
                      {cls.seatPriceCredits}
                    </Text>
                  )}
                  <Text style={[s.pricePerText, isSmallScreen && s.pricePerTextMobile]}>per seat · {cls.billingCycle === 'monthly' ? 'monthly' : 'one-time'}</Text>
                </View>
                {!isTeacher && getClassDiscountPercent(currentUser) > 0 && (
                  <View style={[{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }, isSmallScreen && { marginTop: 3, gap: 3 }]}>
                    <Crown size={isSmallScreen ? 11 : 13} color="#6366F1" />
                    <Text style={[{ fontSize: 12, fontWeight: '600', color: '#6366F1' }, isSmallScreen && { fontSize: 10.5 }]}>
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
                    <TouchableOpacity style={[s.scheduledWaitingBtn, isSmallScreen && s.scheduledWaitingBtnMobile]} onPress={handleStartClass} activeOpacity={0.8}>
                      <Clock size={isSmallScreen ? 14 : 18} color="#6366F1" />
                      <Text style={[s.scheduledWaitingBtnText, isSmallScreen && s.scheduledWaitingBtnTextMobile]}>
                        Scheduled for {new Date(cls.startISO).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} at {new Date(cls.startISO).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[s.startClassBtn, isSmallScreen && s.startClassBtnMobile, cls.isLive && { backgroundColor: '#10B981' }]} onPress={handleStartClass} activeOpacity={0.8}>
                      <Video size={isSmallScreen ? 16 : 20} color="#FFFFFF" />
                      <Text style={[s.startClassBtnText, isSmallScreen && s.startClassBtnTextMobile]}>{cls.isLive ? 'Rejoin Class Call' : 'Start Class Call'}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[s.completeBtn, isSmallScreen && s.completeBtnMobile]} onPress={handleCompleteClass} activeOpacity={0.8}>
                    <CheckCircle2 size={isSmallScreen ? 16 : 20} color="#FFFFFF" />
                    <Text style={[s.completeBtnText, isSmallScreen && s.completeBtnTextMobile]}>Mark Complete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.cancelClassBtn, isSmallScreen && s.cancelClassBtnMobile]} onPress={handleCancelClass} activeOpacity={0.8}>
                    <XCircle size={isSmallScreen ? 15 : 18} color={Colors.light.error} />
                    <Text style={[s.cancelClassBtnText, isSmallScreen && s.cancelClassBtnTextMobile]}>Cancel Class</Text>
                  </TouchableOpacity>
                </>
              )}
              {isCompleted && <Text style={[s.completedNote, isSmallScreen && s.completedNoteMobile]}>This class has been completed.</Text>}
              {isCancelled && <Text style={[s.cancelledNote, isSmallScreen && s.cancelledNoteMobile]}>This class was cancelled.</Text>}
            </View>
          ) : (
            <View>
              {enrolled && classOpen ? (
                <>
                  {Boolean(cls.isLive) ? (
                    <TouchableOpacity style={[s.startClassBtn, isSmallScreen && s.startClassBtnMobile, { backgroundColor: '#10B981' }]} onPress={() => router.push(`/call/${cls.id}?mode=video` as any)} activeOpacity={0.8}>
                      <Video size={isSmallScreen ? 16 : 20} color="#FFFFFF" />
                      <Text style={[s.startClassBtnText, isSmallScreen && s.startClassBtnTextMobile]}>Join Class Call (Live Now)</Text>
                    </TouchableOpacity>
                  ) : Boolean(cls.hasStarted || cls.startedAt) ? (
                    <View style={[s.waitingTeacherPill, isSmallScreen && s.waitingTeacherPillMobile]}>
                      <Clock size={isSmallScreen ? 13 : 16} color="#6366F1" />
                      <Text style={[s.waitingTeacherText, isSmallScreen && s.waitingTeacherTextMobile]}>Class in session — Teacher will start call shortly</Text>
                    </View>
                  ) : (
                    <View style={[s.waitingTeacherPill, isSmallScreen && s.waitingTeacherPillMobile]}>
                      <Clock size={isSmallScreen ? 13 : 16} color="#6366F1" />
                      <Text style={[s.waitingTeacherText, isSmallScreen && s.waitingTeacherTextMobile]}>Class not live yet — Teacher has not joined</Text>
                    </View>
                  )}
                  {Boolean(cls.hasStarted || cls.startedAt || cls.isLive) ? (
                    <View style={[s.enrolledLockedPill, isSmallScreen && s.enrolledLockedPillMobile]}>
                      <CheckCircle2 size={isSmallScreen ? 15 : 18} color="#FFFFFF" />
                      <Text style={[s.enrolledLockedText, isSmallScreen && s.enrolledLockedTextMobile]}>Enrolled — Class in progress</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={[s.enrolledBtn, isSmallScreen && s.enrolledBtnMobile]} onPress={handleCancelEnrollment} activeOpacity={0.8}>
                      <CheckCircle2 size={isSmallScreen ? 16 : 18} color="#FFFFFF" />
                      <Text style={[s.enrolledBtnText, isSmallScreen && s.enrolledBtnTextMobile]}>Enrolled — Tap to cancel</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : !enrolled && classOpen && !isFull ? (
                <TouchableOpacity style={[s.enrollBtn, isSmallScreen && s.enrollBtnMobile]} onPress={handleEnroll} activeOpacity={0.8}>
                  <Text style={[s.enrollBtnText, isSmallScreen && s.enrollBtnTextMobile]}>
                    {isFree ? 'Enroll Free' : `Enroll for ${getClassEnrollmentCost(cls.seatPriceCredits, currentUser)} credits ${cls.billingCycle === 'monthly' ? '/month' : ''}`}
                  </Text>
                </TouchableOpacity>
              ) : !enrolled && classOpen && isFull ? (
                <View style={[s.fullBtn, isSmallScreen && s.fullBtnMobile]}>
                  <Text style={[s.fullBtnText, isSmallScreen && s.fullBtnTextMobile]}>Class Full</Text>
                </View>
              ) : isCompleted ? (
                <View style={[s.endedBtn, isSmallScreen && s.endedBtnMobile]}>
                  <CheckCircle2 size={isSmallScreen ? 15 : 18} color={Colors.light.textTertiary} />
                  <Text style={[s.endedBtnText, isSmallScreen && s.endedBtnTextMobile]}>Class completed</Text>
                </View>
              ) : (
                <View style={[s.endedBtn, isSmallScreen && s.endedBtnMobile]}>
                  <XCircle size={isSmallScreen ? 15 : 18} color={Colors.light.textTertiary} />
                  <Text style={[s.endedBtnText, isSmallScreen && s.endedBtnTextMobile]}>Class cancelled</Text>
                </View>
              )}
              {!enrolled && classOpen && !isFree && !isFull && (
                <Text style={[s.balanceNote, isSmallScreen && s.balanceNoteMobile]}>Your balance: {currentUser?.credits ?? 0} credits</Text>
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
  statusBadgeMobile: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    top: 50,
  },
  statusTextMobile: {
    fontSize: 10.5,
  },
  bodyMobile: {
    padding: 14,
    paddingTop: 12,
  },
  catTextMobile: {
    fontSize: 10.5,
    marginBottom: 4,
  },
  titleMobile: {
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 10,
  },
  metaCardMobile: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
  },
  metaLabelMobile: {
    fontSize: 11.5,
  },
  metaDividerMobile: {
    marginVertical: 8,
  },
  billingCardMobile: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  billingBadgeTextMobile: {
    fontSize: 12,
  },
  billingSubMobile: {
    fontSize: 10.5,
    lineHeight: 15,
  },
  teacherCardMobile: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
    gap: 10,
  },
  teacherAvatarMobile: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  teacherNameMobile: {
    fontSize: 13,
    marginBottom: 2,
  },
  teacherRatingMobile: {
    fontSize: 11,
  },
  teacherReviewsMobile: {
    fontSize: 11,
  },
  teacherSwapsMobile: {
    fontSize: 11,
  },
  teacherActionTextMobile: {
    fontSize: 11.5,
  },
  sectionTitleMobile: {
    fontSize: 15,
    marginBottom: 6,
  },
  descriptionMobile: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  seatsCardMobile: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  seatsTitleMobile: {
    fontSize: 12.5,
  },
  seatsLeftMobile: {
    fontSize: 11,
  },
  pricingCardMobile: {
    padding: 12,
    borderRadius: 14,
  },
  enrollBtnMobile: {
    paddingVertical: 10,
    borderRadius: 12,
  },
  enrollBtnTextMobile: {
    fontSize: 12.5,
  },
  enrolledBtnMobile: {
    paddingVertical: 10,
    borderRadius: 12,
  },
  enrolledBtnTextMobile: {
    fontSize: 12,
  },
  startClassBtnMobile: {
    paddingVertical: 10,
    borderRadius: 12,
  },
  startClassBtnTextMobile: {
    fontSize: 12.5,
  },
  completeBtnMobile: {
    paddingVertical: 10,
    borderRadius: 12,
  },
  completeBtnTextMobile: {
    fontSize: 12.5,
  },
  cancelClassBtnMobile: {
    paddingVertical: 8,
    borderRadius: 10,
  },
  cancelClassBtnTextMobile: {
    fontSize: 11.5,
  },
  cardSectionMobile: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  sectionHeaderMobile: {
    gap: 6,
    marginBottom: 8,
  },
  announcementItemMobile: {
    padding: 8,
    borderRadius: 10,
    marginBottom: 6,
  },
  announcementTextMobile: {
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 2,
  },
  announcementDateMobile: {
    fontSize: 10.5,
  },
  emptyTextMobile: {
    fontSize: 11.5,
    marginBottom: 6,
  },
  inputContainerMobile: {
    marginTop: 8,
    gap: 6,
  },
  textInputMobile: {
    padding: 8,
    fontSize: 12.5,
    borderRadius: 10,
    minHeight: 36,
  },
  actionBtnMobile: {
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionBtnTextMobile: {
    fontSize: 12.5,
  },
  assignmentItemMobile: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  assignmentTitleMobile: {
    fontSize: 13.5,
    marginBottom: 2,
  },
  assignmentDescMobile: {
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 4,
  },
  downloadLinkMobile: {
    fontSize: 11.5,
    marginBottom: 6,
  },
  submissionsContainerMobile: {
    marginTop: 8,
    paddingTop: 8,
  },
  submissionsTitleMobile: {
    fontSize: 11.5,
    marginBottom: 4,
  },
  submissionItemMobile: {
    padding: 6,
    borderRadius: 6,
    marginBottom: 4,
  },
  submissionStudentMobile: {
    fontSize: 11.5,
  },
  submissionDateMobile: {
    fontSize: 10,
  },
  studentSubmitContainerMobile: {
    marginTop: 8,
  },
  uploadBtnMobile: {
    paddingVertical: 7,
    borderRadius: 9,
    gap: 6,
  },
  uploadBtnTextMobile: {
    fontSize: 11.5,
  },
  submittedTextMobile: {
    fontSize: 12,
  },
  priceRowMobile: {
    marginBottom: 10,
  },
  priceTagMobile: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  priceTextMobile: {
    fontSize: 16,
  },
  pricePerTextMobile: {
    fontSize: 11,
  },
  freeTagMobile: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 5,
  },
  freePriceTextMobile: {
    fontSize: 14,
  },
  waitingTeacherPillMobile: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 6,
    gap: 6,
  },
  waitingTeacherTextMobile: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  enrolledLockedPillMobile: {
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
  },
  enrolledLockedTextMobile: {
    fontSize: 12.5,
  },
  scheduledWaitingBtnMobile: {
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 4,
  },
  scheduledWaitingBtnTextMobile: {
    fontSize: 11.5,
  },
  fullBtnMobile: {
    paddingVertical: 10,
    borderRadius: 12,
  },
  fullBtnTextMobile: {
    fontSize: 12.5,
  },
  endedBtnMobile: {
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  endedBtnTextMobile: {
    fontSize: 12,
  },
  balanceNoteMobile: {
    fontSize: 11,
    marginTop: 6,
  },
  completedNoteMobile: {
    fontSize: 11.5,
    paddingVertical: 6,
  },
  cancelledNoteMobile: {
    fontSize: 11.5,
    paddingVertical: 6,
  },
});
