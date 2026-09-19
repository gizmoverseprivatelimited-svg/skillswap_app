import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator, Platform, PermissionsAndroid } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Video } from 'lucide-react-native';
import HMSView from '@/components/HMSView';
import { useCurrentUser } from '@/providers/current-user';
import { useAuth } from '@/providers/auth';
import { useSkillSwaps } from '@/providers/skill-swaps';
import { useClasses } from '@/providers/classes';
import { useSocket } from '@/providers/socket';
import url from '@/constants/backurl';

export default function UnifiedCallScreen() {
  const { swapId, classId, id, mode, isJoining, partnerId: queryPartnerId } = useLocalSearchParams<{
    swapId?: string;
    classId?: string;
    id?: string;
    mode?: string;
    isJoining?: string;
    partnerId?: string;
  }>();
  const targetId = (swapId || classId || id || '') as string;
  const router = useRouter();
  const { currentUser, allUsers, isLoading: isUserLoading } = useCurrentUser();
  const { user: authUser } = useAuth();
  const { getSwapById, swaps, allSwaps } = useSkillSwaps();
  const { getClassById, classes } = useClasses();
  const { socket } = useSocket();

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);
  const [isTeacher, setIsTeacher] = useState(false);
  const [isLoadingRoom, setIsLoadingRoom] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(console.warn);
    }
  }, []);

  const currentUserId = currentUser?.id || (currentUser as any)?._id || authUser?.id || (authUser as any)?._id || 'local-user';
  const callMode = mode === 'voice' ? 'voice' : 'video';

  // 1. Check if it's a class call
  const cls = useMemo(() => {
    if (!targetId) return undefined;
    return (
      getClassById(targetId) ||
      classes?.find((c: any) => String(c.id) === String(targetId) || String(c._id) === String(targetId))
    );
  }, [getClassById, classes, targetId]);

  // 2. Check if it's a swap call
  const swap = useMemo(() => {
    if (!targetId || cls) return undefined;
    return (
      getSwapById(targetId) ||
      swaps?.find((s: any) => String(s.id) === String(targetId) || String(s._id) === String(targetId)) ||
      allSwaps?.find((s: any) => String(s.id) === String(targetId) || String(s._id) === String(targetId)) ||
      {
        id: targetId,
        requesterId: currentUserId,
        recipientId: queryPartnerId || 'partner-id',
        status: 'scheduled',
      }
    );
  }, [getSwapById, swaps, allSwaps, targetId, cls, currentUserId, queryPartnerId]);

  const partner = useMemo(() => {
    if (!swap) return undefined;
    const reqId = String((swap.requesterId as any)?._id || (swap.requesterId as any)?.id || swap.requesterId || '');
    const recId = String((swap.recipientId as any)?._id || (swap.recipientId as any)?.id || swap.recipientId || '');
    const resolvedPartnerId = queryPartnerId || (reqId === String(currentUserId) ? recId : reqId);

    const foundUser = allUsers?.find((u: any) => String(u.id || u._id) === String(resolvedPartnerId));

    if (foundUser) return foundUser;

    if (resolvedPartnerId && resolvedPartnerId !== 'partner-id' && resolvedPartnerId !== 'partner' && resolvedPartnerId !== '[object Object]') {
      return {
        id: resolvedPartnerId,
        name: (swap as any).partnerName || (swap as any).otherUserName || 'Partner',
        avatarUrl: (swap as any).partnerAvatar || '',
        bio: '',
        email: '',
        location: '',
        rating: 5,
        reviewsCount: 0,
        credits: 0,
        role: 'learner' as const,
        skillsOffered: [],
        skillsWanted: [],
        completedSwapsCount: 0,
      };
    }
    return undefined;
  }, [allUsers, currentUserId, swap, queryPartnerId]);

  const effectiveUser = useMemo(() => {
    return (
      currentUser || ({
        id: currentUserId,
        name: authUser?.name || 'You',
        avatarUrl: (authUser as any)?.avatarUrl || (authUser as any)?.avatar || '',
        email: '',
        bio: '',
        location: '',
        rating: 5,
        reviewsCount: 0,
        credits: 0,
        role: 'learner' as const,
      } as any)
    );
  }, [currentUser, currentUserId, authUser]);

  const fetchedTargetIdRef = useRef<string | null>(null);

  // Fetch 100ms Room Code from Backend & Database
  useEffect(() => {
    let isCancelled = false;
    async function fetchRoomCode() {
      if (!targetId || isUserLoading) return;
      if (fetchedTargetIdRef.current === targetId && roomCode) return;
      
      setIsLoadingRoom(true);
      setFetchError(null);

      try {
        if (cls) {
          // Group class 100ms room
          const res = await fetch(`${url}/classes/${cls.id}/100ms-room?userId=${encodeURIComponent(currentUserId)}`);
          const data = await res.json();
          if (isCancelled) return;
          if (res.ok && data.roomCode) {
            fetchedTargetIdRef.current = targetId;
            setRoomCode(data.roomCode);
            setAuthToken(data.authToken || undefined);
            setIsTeacher(Boolean(data.isTeacher || cls.teacherId === currentUserId));
            setIsLoadingRoom(false);
            return;
          } else {
            console.warn('[CallScreen] Class 100ms room notice:', data.error);
          }
        } else if (swap) {
          // 1:1 Skill swap 100ms room
          const joinParam = isJoining ? '&isJoining=true' : '';
          const res = await fetch(
            `${url}/swaps/${swap.id}/100ms-room?userId=${encodeURIComponent(currentUserId)}${joinParam}`
          );
          const data = await res.json();
          if (isCancelled) return;
          if (res.ok && data.roomCode) {
            fetchedTargetIdRef.current = targetId;
            setRoomCode(data.roomCode);
            setIsTeacher(Boolean(data.isHost));
            setIsLoadingRoom(false);
            return;
          } else {
            console.warn('[CallScreen] Swap 100ms room notice:', data.message || data.error);
          }
        }

        // Direct fallback: Try classes or swaps endpoint using targetId directly
        if (!roomCode) {
          try {
            const classRes = await fetch(`${url}/classes/${targetId}/100ms-room?userId=${encodeURIComponent(currentUserId)}`);
            if (classRes.ok) {
              const classData = await classRes.json();
              if (isCancelled) return;
              if (classData.roomCode) {
                fetchedTargetIdRef.current = targetId;
                setRoomCode(classData.roomCode);
                setAuthToken(classData.authToken || undefined);
                setIsTeacher(Boolean(classData.isTeacher));
                setIsLoadingRoom(false);
                return;
              }
            }
          } catch (e) {}

          try {
            const swapRes = await fetch(`${url}/swaps/${targetId}/100ms-room?userId=${encodeURIComponent(currentUserId)}`);
            if (swapRes.ok) {
              const swapData = await swapRes.json();
              if (isCancelled) return;
              if (swapData.roomCode) {
                fetchedTargetIdRef.current = targetId;
                setRoomCode(swapData.roomCode);
                setIsTeacher(Boolean(swapData.isHost));
                setIsLoadingRoom(false);
                return;
              }
            }
          } catch (e) {}
        }

        if (!isCancelled) {
          setIsLoadingRoom(false);
          setFetchError('Failed to retrieve 100ms room code. Please check your connection and try again.');
        }
      } catch (err) {
        console.error('[CallScreen] Failed to fetch 100ms room code from backend:', err);
        if (!isCancelled) {
          setIsLoadingRoom(false);
          setFetchError('Unable to connect to room service.');
        }
      }
    }

    void fetchRoomCode();
    return () => {
      isCancelled = true;
    };
  }, [targetId, cls, swap, currentUserId, isUserLoading, isJoining, roomCode]);

  const latestClsRef = useRef(cls);
  const latestIsTeacherRef = useRef(isTeacher);
  const hasEndedCallRef = useRef(false);

  useEffect(() => {
    latestClsRef.current = cls;
    latestIsTeacherRef.current = isTeacher;
  }, [cls, isTeacher]);

  const performEndCallCleanup = useCallback(async () => {
    if (hasEndedCallRef.current) return;
    hasEndedCallRef.current = true;

    const currentCls = latestClsRef.current;
    const currentIsTeacher = latestIsTeacherRef.current;

    if (currentCls && currentIsTeacher) {
      try {
        await fetch(`${url}/classes/${currentCls.id}/end-call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.error('[CallScreen] Error stopping live class stream on leave:', err);
      }
    }
  }, []);

  // Ensure cleanup runs when the component unmounts (e.g., user presses back button)
  useEffect(() => {
    return () => {
      performEndCallCleanup();
    };
  }, [performEndCallCleanup]);

  // Handle Leaving / Ending Call explicitly
  const handleEndCall = useCallback(async () => {
    await performEndCallCleanup();

    if (cls) {
      router.replace(`/class/${cls.id}` as any);
    } else if (swap && swap.id && swap.id !== 'partner-id') {
      router.replace(`/swaps/${swap.id}` as any);
    } else if (targetId && targetId !== 'partner-id') {
      router.replace(`/swaps/${targetId}` as any);
    } else {
      router.replace('/(tabs)/swaps' as any);
    }
  }, [performEndCallCleanup, cls, swap, targetId, router]);

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

  // Send socket broadcast to notify student/partner when entering call room
  const hasAlertedRef = useRef<boolean>(false);
  useEffect(() => {
    if (!roomCode || hasAlertedRef.current || !socket) return;
    hasAlertedRef.current = true;

    if (cls && isTeacher) {
      const rawEnrollments = (cls as any).enrollments || (cls as any).enrolledUserIds || [];
      const studentIds = (Array.isArray(rawEnrollments) ? rawEnrollments : [])
        .map((e: any) => String(typeof e === 'object' && e !== null ? (e.studentId?._id || e.studentId?.id || e.studentId || e._id || e.id) : e))
        .filter((id: string) => id && id !== String(effectiveUser.id) && id !== '[object Object]');

      socket.emit('class_call_started', {
        classId: cls.id,
        classTitle: cls.title,
        callerId: effectiveUser.id,
        callerName: effectiveUser.name || 'Teacher',
        studentIds,
        mode: callMode,
      });
    } else if (swap) {
      const reqId = String((swap?.requesterId as any)?._id || (swap?.requesterId as any)?.id || swap?.requesterId || '');
      const recId = String((swap?.recipientId as any)?._id || (swap?.recipientId as any)?.id || swap?.recipientId || '');
      const resolvedPartnerId = String(partner?.id || (partner as any)?._id || queryPartnerId || (reqId === String(effectiveUser?.id) ? recId : reqId) || '');

      if (resolvedPartnerId && resolvedPartnerId !== 'partner-id' && resolvedPartnerId !== 'partner' && resolvedPartnerId.length > 2) {
        socket.emit('swap_call_started', {
          swapId: targetId,
          callerId: effectiveUser.id,
          callerName: effectiveUser.name || 'Your partner',
          partnerId: resolvedPartnerId,
          recipientId: resolvedPartnerId,
          mode: callMode,
        });
      }
    }
  }, [roomCode, cls, isTeacher, swap, socket, effectiveUser, callMode, partner, queryPartnerId, targetId]);

  const displayName = effectiveUser.name || (isTeacher ? 'Teacher' : 'Participant');

  // Loading Room Code State
  if (isLoadingRoom || !roomCode) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.gradientFill}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color="#FFFFFF" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.loadingContent}>
            {fetchError ? (
              <>
                <Text style={styles.errorTitle}>Unable to Join Call</Text>
                <Text style={styles.errorMessage}>{fetchError}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => router.back()}
                >
                  <Text style={styles.retryButtonText}>Go Back</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.iconCircle}>
                  <Video size={36} color="#6366F1" />
                </View>
                <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 20 }} />
                <Text style={styles.loadingTitle}>Connecting to 100ms Room...</Text>
                <Text style={styles.loadingSubtext}>
                  {cls ? cls.title : 'Preparing your skill swap video session'}
                </Text>
              </>
            )}
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Render 100ms Default Prebuilt UI directly
  return (
    <View style={styles.fullScreen}>
      <HMSView
        roomCode={roomCode}
        userName={cls ? `${displayName} (${isTeacher ? 'Teacher' : 'Student'})` : displayName}
        onLeave={handleEndCall}
        authToken={authToken}
        isTeacher={isTeacher}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  gradientFill: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 18,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 280,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F87171',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
