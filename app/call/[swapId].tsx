import { useMemo, useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import HMSView from '@/components/HMSView';
import CallScreen from '@/components/CallScreen';
import { useCurrentUser } from '@/providers/current-user';
import { useAuth } from '@/providers/auth';
import { useSkillSwaps } from '@/providers/skill-swaps';
import { useClasses } from '@/providers/classes';
import { useSocket } from '@/providers/socket';
import { mockUsers } from '@/mocks/data';
import url from '@/constants/backurl';
import {
  buildLocalParticipant,
  buildRemoteParticipant,
  buildMockClassParticipants,
  type CallParticipant,
  type CallMode,
} from '@/lib/call-engine';

export default function UnifiedCallScreen() {
  const { swapId, classId, id, mode, isJoining } = useLocalSearchParams<{
    swapId?: string;
    classId?: string;
    id?: string;
    mode?: string;
    isJoining?: string;
  }>();
  const targetId = (swapId || classId || id || '') as string;
  const router = useRouter();
  const { currentUser, allUsers, isLoading: isUserLoading } = useCurrentUser();
  const { user: authUser } = useAuth();
  const { getSwapById } = useSkillSwaps();
  const { getClassById } = useClasses();
  const { socket } = useSocket();

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);
  const [loadingCode, setLoadingCode] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);

  const currentUserId = currentUser?.id || (currentUser as any)?._id || authUser?.id || (authUser as any)?._id || '';
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

  // Fetch 100ms Room Code from Backend & Database
  useEffect(() => {
    async function fetchRoomCode() {
      if (!targetId || isUserLoading) return;
      try {
        setLoadingCode(true);
        setErrorMsg(null);

        if (cls) {
          // Group class 100ms room
          const res = await fetch(`${url}/classes/${cls.id}/100ms-room?userId=${encodeURIComponent(currentUserId)}`);
          const data = await res.json();
          if (res.ok && data.roomCode) {
            setRoomCode(data.roomCode);
            setAuthToken(data.authToken || undefined);
            setIsTeacher(Boolean(data.isTeacher || cls.teacherId === currentUserId));
          } else {
            console.warn('[CallScreen] Class 100ms room notice:', data.error);
            // Fallback to simulated UI if room is not yet started or failed
            setErrorMsg(data.error || null);
          }
        } else if (swap) {
          // 1:1 Skill swap 100ms room
          const joinParam = isJoining ? '&isJoining=true' : '';
          const res = await fetch(`${url}/swaps/${swap.id}/100ms-room?userId=${encodeURIComponent(currentUserId)}${joinParam}`);
          const data = await res.json();
          if (res.ok && data.roomCode) {
            setRoomCode(data.roomCode);
            setIsTeacher(Boolean(data.isHost));
          } else {
            console.warn('[CallScreen] Swap 100ms room notice:', data.message || data.error);
          }
        }
      } catch (err) {
        console.error('[CallScreen] Failed to fetch 100ms room code from backend:', err);
      } finally {
        setLoadingCode(false);
      }
    }

    void fetchRoomCode();
  }, [targetId, cls, swap, currentUserId, isUserLoading, isJoining]);

  // Handle Leaving / Ending Call
  const handleEndCall = useCallback(async () => {
    if (cls && isTeacher) {
      try {
        await fetch(`${url}/classes/${cls.id}/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.error('[CallScreen] Error ending class session on leave:', err);
      }
    }

    if (router.canGoBack()) {
      router.back();
    } else if (cls) {
      router.replace(`/class/${cls.id}` as any);
    } else if (swap) {
      router.replace(`/swaps/${swap.id}` as any);
    } else {
      router.replace('/(tabs)/home' as any);
    }
  }, [cls, isTeacher, swap, router]);

  // Real-time socket listener: if teacher ends class, automatically exit students
  useEffect(() => {
    if (!socket || !cls) return;

    const handleClassEnded = (data: { classId: string }) => {
      if (data && String(data.classId) === String(cls.id)) {
        console.log('[CallScreen] Class ended by teacher, exiting room');
        handleEndCall();
      }
    };

    socket.on('class_ended', handleClassEnded);
    return () => {
      socket.off('class_ended', handleClassEnded);
    };
  }, [socket, cls, handleEndCall]);

  const participants: CallParticipant[] = useMemo(() => {
    if (!currentUser) return [];

    if (cls) {
      const teacher = allUsers.find((u) => u.id === cls.teacherId) || mockUsers.find((u) => u.id === cls.teacherId);
      const localRole = cls.teacherId === currentUser.id ? 'teacher' : 'student';
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

  // If loading 100ms room code from backend
  if (loadingCode) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#0B1120', '#1E293B', '#0F172A']} style={styles.loadingGradient}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingTitle}>Connecting to 100ms Video Room...</Text>
          <Text style={styles.loadingSub}>Setting up secure real-time WebRTC media</Text>
        </LinearGradient>
      </View>
    );
  }

  // If 100ms Room Code is available, render real live 100ms WebRTC Video Room
  if (roomCode) {
    const userName = currentUser?.name
      ? `${currentUser.name}${cls ? ` (${isTeacher ? 'Teacher' : 'Student'})` : ''}`
      : isTeacher
      ? 'Teacher'
      : 'Guest';

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
        <HMSView
          roomCode={roomCode}
          authToken={authToken}
          userName={userName}
          onLeave={handleEndCall}
          isTeacher={isTeacher}
        />
      </SafeAreaView>
    );
  }

  // Fallback to custom interactive CallScreen
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
  loadingContainer: { flex: 1, backgroundColor: '#0B1120' },
  loadingGradient: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 20 },
  loadingTitle: { fontSize: 18, fontWeight: '700' as const, color: '#F8FAFC', textAlign: 'center' },
  loadingSub: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
});
