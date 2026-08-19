import { useMemo, useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import CallScreen from '@/components/CallScreen';
import { useCurrentUser } from '@/providers/current-user';
import { useAuth } from '@/providers/auth';
import { useSkillSwaps } from '@/providers/skill-swaps';
import { useClasses } from '@/providers/classes';
import { useSocket } from '@/providers/socket';
import { mockUsers } from '@/mocks/data';
import url from '@/constants/backurl';
import { use100msCall } from '@/hooks/use100msCall';
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
  const { getSwapById, swaps, allSwaps } = useSkillSwaps();
  const { getClassById, classes } = useClasses();
  const { socket } = useSocket();

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);
  const [isTeacher, setIsTeacher] = useState(false);

  const currentUserId = currentUser?.id || (currentUser as any)?._id || authUser?.id || (authUser as any)?._id || 'local-user';
  const callMode: CallMode = mode === 'voice' ? 'voice' : 'video';

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
        recipientId: 'partner-id',
        status: 'scheduled',
      }
    );
  }, [getSwapById, swaps, allSwaps, targetId, cls, currentUserId]);

  const partner = useMemo(() => {
    if (!swap) return undefined;
    const partnerId =
      String(swap.requesterId) === String(currentUserId) ? swap.recipientId : swap.requesterId;
    return (
      allUsers?.find((u: any) => String(u.id) === String(partnerId) || String(u._id) === String(partnerId)) ||
      mockUsers.find((u: any) => String(u.id) === String(partnerId) || String(u._id) === String(partnerId)) || {
        id: partnerId || 'partner',
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
      }
    );
  }, [allUsers, currentUserId, swap]);

  // Fetch 100ms Room Code from Backend & Database
  useEffect(() => {
    async function fetchRoomCode() {
      if (!targetId || isUserLoading) return;
      try {
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
          }
        } else if (swap) {
          // 1:1 Skill swap 100ms room
          const joinParam = isJoining ? '&isJoining=true' : '';
          const res = await fetch(
            `${url}/swaps/${swap.id}/100ms-room?userId=${encodeURIComponent(currentUserId)}${joinParam}`
          );
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
        skillsOffered: [],
        skillsWanted: [],
        completedSwapsCount: 0,
        totalSwaps: 0,
        joinedDate: new Date().toISOString(),
        premiumTier: 'free',
      } as any)
    );
  }, [currentUser, currentUserId, authUser]);

  const initialParticipants: CallParticipant[] = useMemo(() => {
    if (cls) {
      const teacher =
        allUsers.find((u: any) => String(u.id) === String(cls.teacherId)) ||
        mockUsers.find((u: any) => String(u.id) === String(cls.teacherId));
      const localRole = cls.teacherId === effectiveUser.id ? 'teacher' : 'student';
      const local = buildLocalParticipant(effectiveUser as any, localRole);

      const others: CallParticipant[] = [];
      if (teacher && teacher.id !== effectiveUser.id) {
        others.push(
          buildRemoteParticipant(
            { id: teacher.id, name: teacher.name, avatarUrl: teacher.avatarUrl },
            'teacher'
          )
        );
      }

      const enrolledStudents = (((cls as any).enrollments || (cls as any).enrolledUserIds || []) as any[])
        .filter((e: any) => (e.studentId || e) !== effectiveUser.id && (e.status === 'enrolled' || typeof e === 'string'))
        .map((e: any) => {
          const sId = typeof e === 'string' ? e : e.studentId;
          return allUsers.find((u: any) => u.id === sId) || mockUsers.find((u: any) => u.id === sId);
        })
        .filter((u: any): u is NonNullable<typeof u> => u !== undefined);

      others.push(...buildMockClassParticipants(Math.max(enrolledStudents.length, 3)));
      return [local, ...others];
    }

    if (partner) {
      const local = buildLocalParticipant(effectiveUser as any, 'guest');
      local.isVideoOff = callMode !== 'video';
      const remote = buildRemoteParticipant(
        { id: partner.id, name: partner.name, avatarUrl: partner.avatarUrl },
        'host'
      );
      remote.isVideoOff = callMode !== 'video';
      remote.status = 'connected';
      return [local, remote];
    }

    return [];
  }, [cls, partner, effectiveUser, allUsers, callMode]);

  // Live 100ms / WebRTC real-time connection hook
  const {
    participants: liveParticipants,
    messages: liveMessages,
    reactions: liveReactions,
    isScreenSharing,
    selectedAudioDevice,
    availableAudioDevices,
    toggleMute,
    toggleVideo,
    switchCamera,
    toggleScreenShare,
    switchAudioOutput,
    toggleHand,
    sendReaction,
    muteParticipant,
    removeParticipant,
    sendMessage,
    leaveCall,
  } = use100msCall({
    roomCode,
    authToken,
    userName: effectiveUser.name || (isTeacher ? 'Teacher' : 'Participant'),
    isTeacher,
    initialParticipants,
    mode: callMode,
    onEndCall: handleEndCall,
    roomId: targetId,
    currentUserId: effectiveUser.id,
    partnerId: partner?.id,
    socket,
  });

  const roomTitle = cls ? cls.title : `Skill swap with ${partner?.name || 'Partner'}`;
  const isGroupCall = Boolean(cls);

  return (
    <CallScreen
      participants={liveParticipants}
      roomTitle={roomTitle}
      mode={callMode}
      isGroupCall={isGroupCall}
      isTeacher={isTeacher}
      onEndCall={leaveCall}
      onToggleMute={toggleMute}
      onToggleVideo={toggleVideo}
      onSwitchCamera={switchCamera}
      onToggleScreenShare={toggleScreenShare}
      isScreenSharing={isScreenSharing}
      onSwitchAudioOutput={switchAudioOutput}
      selectedAudioDevice={selectedAudioDevice}
      availableAudioDevices={availableAudioDevices}
      onToggleHand={toggleHand}
      onSendReaction={sendReaction}
      reactions={liveReactions}
      onMuteParticipant={muteParticipant}
      onRemoveParticipant={removeParticipant}
      onSendMessage={(text) => sendMessage(text, effectiveUser.id, effectiveUser.name)}
      externalMessages={liveMessages}
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
