import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, Clock, Users, Coins, MapPin, Star, Sparkles, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { mockUsers } from '@/mocks/data';
import { useClasses } from '@/providers/classes';
import { useCurrentUser } from '@/providers/current-user';
import { formatCredits, getClassEnrollmentCost } from '@/lib/payments';

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getClassById, enrollInClass, cancelEnrollment, completeClass, cancelClass, isEnrolled } = useClasses();
  const { currentUser } = useCurrentUser();

  const cls = useMemo(() => getClassById(id), [getClassById, id]);
  const [enrolled, setEnrolled] = useState(() => id ? isEnrolled(id, currentUser.id) : false);

  const enrolledStudents = useMemo(() => {
    if (!cls) return [];
    return cls.enrollments
      .map(e => mockUsers.find(u => u.id === e.studentId))
      .filter((u): u is NonNullable<typeof u> => u !== undefined);
  }, [cls]);

  const handleEnroll = useCallback(() => {
    if (!cls) return;
    const cost = getClassEnrollmentCost(cls.seatPriceCredits);
    const balanceAfter = currentUser.credits - cost;

    if (cost > 0 && balanceAfter < 0) {
      Alert.alert('Not enough credits', `You need ${cost} credits but have ${currentUser.credits}. Top up in the Store to enroll.`);
      return;
    }

    Alert.alert(
      'Confirm Enrollment',
      cost > 0
        ? `Pay ${cost} credits to enroll?\n\nCurrent balance: ${currentUser.credits}\nAfter enrollment: ${balanceAfter}`
        : 'Enroll in this free class?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enroll',
          onPress: () => {
            const result = enrollInClass(cls.id);
            if (result.success) {
              setEnrolled(true);
              Alert.alert('Enrolled!', `You're signed up for "${cls.title}".`);
            } else {
              Alert.alert('Cannot enroll', result.error ?? 'Something went wrong.');
            }
          },
        },
      ],
    );
  }, [cls, currentUser.credits, enrollInClass]);

  const handleCancelEnrollment = useCallback(() => {
    if (!cls) return;
    Alert.alert(
      'Cancel enrollment?',
      `You'll be refunded ${getClassEnrollmentCost(cls.seatPriceCredits)} credits.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Enrollment',
          style: 'destructive',
          onPress: () => {
            cancelEnrollment(cls.id);
            setEnrolled(false);
          },
        },
      ],
    );
  }, [cls, cancelEnrollment]);

  const handleCompleteClass = useCallback(() => {
    if (!cls) return;
    Alert.alert(
      'Mark class complete?',
      `${cls.enrolledCount} student${cls.enrolledCount === 1 ? '' : 's'} will be marked as attended. You'll earn credits for each seat.`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Complete',
          onPress: () => {
            completeClass(cls.id);
            Alert.alert('Class completed!', `Earnings have been credited to your account.`);
          },
        },
      ],
    );
  }, [cls, completeClass]);

  const handleCancelClass = useCallback(() => {
    if (!cls) return;
    Alert.alert(
      'Cancel this class?',
      'All enrolled students will be refunded their credits. This cannot be undone.',
      [
        { text: 'Keep class', style: 'cancel' },
        {
          text: 'Cancel Class',
          style: 'destructive',
          onPress: () => {
            cancelClass(cls.id);
            Alert.alert('Class cancelled', 'All students have been refunded.');
          },
        },
      ],
    );
  }, [cls, cancelClass]);

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

  const isTeacher = cls.teacherId === currentUser.id;
  const isFree = cls.seatPriceCredits === 0;
  const seatsLeft = cls.maxCapacity - cls.enrolledCount;
  const isFull = seatsLeft <= 0;
  const isCompleted = cls.status === 'completed';
  const isCancelled = cls.status === 'cancelled';
  const classOpen = cls.status === 'open';

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };
  const formatTimeRange = () => {
    const start = new Date(cls.startISO).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const end = new Date(cls.endISO).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return `${start} — ${end}`;
  };

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <View style={[s.coverWrap, { height: 240 }]}>
        <Image source={{ uri: cls.coverImageUrl }} style={s.cover} />
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
            <Text style={s.metaLabel}>{formatDate(cls.startISO)}</Text>
          </View>
          <View style={s.metaDivider} />
          <View style={s.metaItem}>
            <Clock size={18} color={Colors.light.primary} />
            <Text style={s.metaLabel}>{formatTimeRange()}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={s.teacherCard}
          onPress={() => router.push(`/profile/${cls.teacher.id}` as any)}
          activeOpacity={0.7}
        >
          <Image source={{ uri: cls.teacher.avatarUrl }} style={s.teacherAvatar} />
          <View style={s.teacherInfo}>
            <Text style={s.teacherName}>{cls.teacher.name}</Text>
            <View style={s.teacherMeta}>
              <Star size={12} fill={Colors.light.accent} color={Colors.light.accent} />
              <Text style={s.teacherRating}>{cls.teacher.rating}</Text>
              <Text style={s.teacherSwaps}>· {cls.teacher.totalSwaps} swaps</Text>
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
                <View key={stu.id} style={s.studentChip}>
                  <Image source={{ uri: stu.avatarUrl }} style={s.studentAvatar} />
                  <Text style={s.studentName} numberOfLines={1}>{stu.name.split(' ')[0]}</Text>
                </View>
              ))}
            </ScrollView>
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
              <View style={s.priceTag}>
                <Coins size={20} color="#F59E0B" />
                <Text style={s.priceText}>{formatCredits(cls.seatPriceCredits)}</Text>
                <Text style={s.pricePerText}>per seat</Text>
              </View>
            )}
          </View>

          {isTeacher ? (
            <View style={s.teacherActions}>
              {classOpen && (
                <>
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
                <TouchableOpacity style={s.enrolledBtn} onPress={handleCancelEnrollment} activeOpacity={0.8}>
                  <CheckCircle2 size={20} color="#FFFFFF" />
                  <Text style={s.enrolledBtnText}>Enrolled — Tap to cancel</Text>
                </TouchableOpacity>
              ) : !enrolled && classOpen && !isFull ? (
                <TouchableOpacity style={s.enrollBtn} onPress={handleEnroll} activeOpacity={0.8}>
                  <Text style={s.enrollBtnText}>{isFree ? 'Enroll Free' : `Enroll for ${cls.seatPriceCredits} credits`}</Text>
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
                <Text style={s.balanceNote}>Your balance: {currentUser.credits} credits</Text>
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
  metaCard: { backgroundColor: Colors.light.backgroundTertiary, borderRadius: 16, padding: 16, marginBottom: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaLabel: { fontSize: 15, fontWeight: '600' as const, color: Colors.light.text },
  metaDivider: { height: 1, backgroundColor: Colors.light.border, marginVertical: 12 },
  teacherCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.light.card, borderRadius: 16, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: Colors.light.borderLight },
  teacherAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: Colors.light.border },
  teacherInfo: { flex: 1 },
  teacherName: { fontSize: 16, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 4 },
  teacherMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teacherRating: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.text },
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
  fullBtn: { backgroundColor: Colors.light.backgroundTertiary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  fullBtnText: { fontSize: 16, fontWeight: '700' as const, color: Colors.light.textTertiary },
  endedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.light.backgroundTertiary, borderRadius: 16, paddingVertical: 16 },
  endedBtnText: { fontSize: 15, fontWeight: '600' as const, color: Colors.light.textTertiary },
  balanceNote: { textAlign: 'center', fontSize: 13, color: Colors.light.textTertiary, marginTop: 10 },
  teacherActions: { gap: 10 },
  completeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#10B981', borderRadius: 16, paddingVertical: 16 },
  completeBtnText: { fontSize: 16, fontWeight: '700' as const, color: '#FFFFFF' },
  cancelClassBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 16, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  cancelClassBtnText: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.error },
  completedNote: { textAlign: 'center', fontSize: 14, color: Colors.light.textTertiary, fontStyle: 'italic' as const, paddingVertical: 12 },
  cancelledNote: { textAlign: 'center', fontSize: 14, color: Colors.light.error, fontStyle: 'italic' as const, paddingVertical: 12 },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  notFoundText: { fontSize: 18, fontWeight: '600' as const, color: Colors.light.textSecondary },
  backBtnText: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.primary },
});
