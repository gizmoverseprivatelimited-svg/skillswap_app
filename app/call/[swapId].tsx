import { useMemo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import CallScreen from '../../components/CallScreen';
import { useCurrentUser } from '../../providers/current-user';
import { useSkillSwaps } from '../../providers/skill-swaps';
import { useClasses } from '../../providers/classes';
import { mockUsers } from '../../mocks/data';
import {
  buildLocalParticipant,
  buildRemoteParticipant,
  buildMockClassParticipants,
  type CallParticipant,
  type CallMode,
} from '../../lib/call-engine';

export default function UnifiedCallScreen() {
  const { swapId, classId, id, mode } = useLocalSearchParams<{
    swapId?: string;
    classId?: string;
    id?: string;
    mode?: string;
  }>();
  const targetId = (swapId || classId || id || '') as string;
  const router = useRouter();
  const { currentUser, allUsers } = useCurrentUser();
  const { getSwapById } = useSkillSwaps();
  const { getClassById } = useClasses();

  const callMode: CallMode = mode === 'voice' ? 'voice' : 'video';

  // 1. Check if it's a class call
  const cls = useMemo(() => {
    if (!targetId) return undefined;
    return getClassById(targetId);
  }, [getClassById, targetId]);

  // 2. Check if it's a swap call
  const swap = useMemo(() => {
    if (!targetId || cls) return undefined;
    return getSwapById(targetId);
  }, [getSwapById, targetId, cls]);

  const partner = useMemo(() => {
    if (!swap || !currentUser) return undefined;
    const partnerId = swap.requesterId === currentUser.id ? swap.recipientId : swap.requesterId;
    return allUsers.find((u) => u.id === partnerId) || mockUsers.find((u) => u.id === partnerId);
  }, [allUsers, currentUser, swap]);

  const participants: CallParticipant[] = useMemo(() => {
    if (!currentUser) return [];

    if (cls) {
      const teacher = allUsers.find((u) => u.id === cls.teacherId) || mockUsers.find((u) => u.id === cls.teacherId);
      const isTeacher = cls.teacherId === currentUser.id;
      const localRole = isTeacher ? 'teacher' : 'student';
      const local = buildLocalParticipant(currentUser, localRole);

      const others: CallParticipant[] = [];
      if (teacher && teacher.id !== currentUser.id) {
        others.push(
          buildRemoteParticipant(
            { id: teacher.id, name: teacher.name, avatarUrl: teacher.avatarUrl },
            'teacher',
          ),
        );
      }

      const enrolledStudents = (cls.enrollments || [])
        .filter((e) => e.studentId !== currentUser.id && e.status === 'enrolled')
        .map((e) => allUsers.find((u) => u.id === e.studentId) || mockUsers.find((u) => u.id === e.studentId))
        .filter((u): u is NonNullable<typeof u> => u !== undefined);

      others.push(...buildMockClassParticipants(Math.max(enrolledStudents.length, 3)));
      return [local, ...others];
    }

    if (swap && partner) {
      return [
        buildLocalParticipant(currentUser, 'guest'),
        buildRemoteParticipant(
          { id: partner.id, name: partner.name, avatarUrl: partner.avatarUrl },
          'host',
        ),
      ];
    }

    return [];
  }, [cls, swap, partner, currentUser, allUsers]);

  const handleEndCall = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (cls) {
      router.replace(`/class/${cls.id}` as any);
    } else if (swap) {
      router.replace(`/swaps/${swap.id}` as any);
    } else {
      router.replace('/(tabs)/home' as any);
    }
  };

  if (!cls && (!swap || !partner)) {
    return (
      <View style={styles.errorContainer}>
        <LinearGradient colors={['#0B1120', '#1E293B']} style={styles.errorGradient}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={20} color="#F8FAFC" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.errorContent}>
            <Text style={styles.errorTitle}>Call not available</Text>
            <Text style={styles.errorMessage}>Unable to load call session details.</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  const roomTitle = cls ? cls.title : `Skill swap with ${partner?.name || 'Partner'}`;
  const isGroupCall = Boolean(cls);

  return (
    <CallScreen
      participants={participants}
      roomTitle={roomTitle}
      mode={callMode}
      isGroupCall={isGroupCall}
      onEndCall={handleEndCall}
    />
  );
}

const styles = StyleSheet.create({
  errorContainer: { flex: 1 },
  errorGradient: { flex: 1, paddingHorizontal: 20, paddingTop: 60 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { fontSize: 14, color: '#F8FAFC', fontWeight: '600' as const },
  errorContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorTitle: { fontSize: 24, fontWeight: '800' as const, color: '#FFFFFF' },
  errorMessage: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' as const },
});
