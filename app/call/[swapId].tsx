import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import CallScreen from '@/components/CallScreen';
import CallPreviewScreen from '@/components/CallPreviewScreen';
import { useCurrentUser } from '@/providers/current-user';
import { useAuth } from '@/providers/auth';
import { useSkillSwaps } from '@/providers/skill-swaps';
import { useClasses } from '@/providers/classes';
import { useSocket } from '@/providers/socket';
import url from '@/constants/backurl';
import { use100msCall } from '@/hooks/use100msCall';
import {
  buildLocalParticipant,
  buildRemoteParticipant,
  type CallParticipant,
  type CallMode,
} from '@/lib/call-engine';

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

  const [hasJoined, setHasJoined] = useState<boolean>(false);
  const [initialMicOn, setInitialMicOn] = useState<boolean>(true);
  const [initialVideoOn, setInitialVideoOn] = useState<boolean>(mode !== 'voice');
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
        await fetch(`${url}/classes/${cls.id}/end-call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.error('[CallScreen] Error stopping live class stream on leave:', err);
      }
    }

    if (cls) {
      router.replace(`/class/${cls.id}` as any);
    } else if (swap && swap.id && swap.id !== 'partner-id') {
      router.replace(`/swaps/${swap.id}` as any);
    } else if (targetId && targetId !== 'partner-id') {
      router.replace(`/swaps/${targetId}` as any);
    } else {
      router.replace('/(tabs)/swaps' as any);
    }
  }, [cls, isTeacher, swap, targetId, router]);

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

  const swapRoleInfo = useMemo(() => {
    if (!swap || cls) return null;
    const reqId = String((swap as any).requesterId?._id || (swap as any).requesterId?.id || (swap as any).requesterId || '');
    const isRequester = reqId === String(currentUserId);
    const swapType = (swap as any).swapType || 'swap';

    const allSkills = [
      ...(currentUser?.skillsOffered || []),
      ...(partner?.skillsOffered || []),
      ...allUsers.flatMap((u: any) => u.skillsOffered || []),
    ];
    const skillsMap = new Map<string, any>();
    allSkills.forEach((s: any) => {
      if (s?.id) skillsMap.set(String(s.id), s);
      if (s?._id) skillsMap.set(String(s._id), s);
    });

    const requesterSkillId = (swap as any).requesterSkillId;
    const recipientSkillId = (swap as any).recipientSkillId;

    const reqSkill = (requesterSkillId ? skillsMap.get(String(requesterSkillId)) : null) || (currentUser?.skillsOffered?.find((s: any) => String(s.id) === String(requesterSkillId) || String(s._id) === String(requesterSkillId))) || null;
    const recSkill = (recipientSkillId ? skillsMap.get(String(recipientSkillId)) : null) || (partner?.skillsOffered?.find((s: any) => String(s.id) === String(recipientSkillId) || String(s._id) === String(recipientSkillId))) || null;

    if (swapType === 'learn') {
      // Recipient is Teacher, Requester is Student
      const skillTaught = recSkill?.title || (swap as any).recipientSkillName || (swap as any).skillTitle || 'Skill';
      return {
        localRole: isRequester ? ('student' as const) : ('teacher' as const),
        localRoleLabel: isRequester ? 'Student' : 'Teacher',
        localSkillTaught: isRequester ? `Learning ${skillTaught}` : `Teaching ${skillTaught}`,
        remoteRole: isRequester ? ('teacher' as const) : ('student' as const),
        remoteRoleLabel: isRequester ? 'Teacher' : 'Student',
        remoteSkillTaught: isRequester ? `Teaching ${skillTaught}` : `Learning ${skillTaught}`,
      };
    }

    if (swapType === 'teach') {
      // Requester is Teacher, Recipient is Student
      const skillTaught = reqSkill?.title || (swap as any).requesterSkillName || (swap as any).skillTitle || 'Skill';
      return {
        localRole: isRequester ? ('teacher' as const) : ('student' as const),
        localRoleLabel: isRequester ? 'Teacher' : 'Student',
        localSkillTaught: isRequester ? `Teaching ${skillTaught}` : `Learning ${skillTaught}`,
        remoteRole: isRequester ? ('student' as const) : ('teacher' as const),
        remoteRoleLabel: isRequester ? 'Student' : 'Teacher',
        remoteSkillTaught: isRequester ? `Learning ${skillTaught}` : `Teaching ${skillTaught}`,
      };
    }

    // Mutual Swap (1:1 Skill Exchange)
    const requesterSkill = reqSkill?.title || (swap as any).requesterSkillName || 'Skill A';
    const recipientSkill = recSkill?.title || (swap as any).recipientSkillName || 'Skill B';
    const localSkill = isRequester ? requesterSkill : recipientSkill;
    const remoteSkill = isRequester ? recipientSkill : requesterSkill;

    return {
      localRole: 'teacher' as const,
      localRoleLabel: 'Exchange Partner',
      localSkillTaught: `Teaching ${localSkill}`,
      remoteRole: 'student' as const,
      remoteRoleLabel: 'Exchange Partner',
      remoteSkillTaught: `Teaching ${remoteSkill}`,
    };
  }, [swap, cls, currentUserId, currentUser, partner, allUsers]);

  const isJoiningCall = isJoining === 'true' || isJoining === '1';

  const initialParticipants: CallParticipant[] = useMemo(() => {
    if (cls) {
      const teacherId = String((cls as any).teacherId?._id || (cls as any).teacherId?.id || cls.teacherId || '');
      const teacherName = (cls as any).teacherName || (cls as any).teacher?.name || 'Teacher';
      const teacherAvatar = (cls as any).teacherAvatar || (cls as any).teacher?.avatarUrl || (cls as any).teacher?.avatar || '';

      const teacher = allUsers.find((u: any) => String(u.id || u._id) === teacherId);
      const isUserTeacher = teacherId === String(effectiveUser.id);
      const localRole = isUserTeacher ? 'teacher' : 'student';
      const local = buildLocalParticipant(
        effectiveUser as any,
        localRole,
        isUserTeacher ? 'Teacher' : 'Student',
        (cls as any).skillTitle || (cls as any).title ? `Class: ${(cls as any).skillTitle || (cls as any).title}` : undefined
      );
      local.isVideoOff = callMode !== 'video';

      const others: CallParticipant[] = [];
      if (!isUserTeacher && teacherId) {
        others.push(
          buildRemoteParticipant(
            { id: teacherId, name: teacher?.name || teacherName, avatarUrl: teacher?.avatarUrl || teacherAvatar },
            'teacher',
            'Teacher',
            (cls as any).skillTitle || (cls as any).title ? `Class: ${(cls as any).skillTitle || (cls as any).title}` : undefined
          )
        );
      }

      // Add real enrolled students from class database
      const rawEnrollments = (cls as any).enrollments || (cls as any).enrolledUserIds || [];
      const enrolledStudents = (Array.isArray(rawEnrollments) ? rawEnrollments : [])
        .map((e: any) => {
          const sId = String(typeof e === 'object' && e !== null ? (e.studentId?._id || e.studentId?.id || e.studentId || e._id || e.id) : e);
          const sName = typeof e === 'object' && e !== null ? (e.studentName || e.student?.name) : '';
          const sAvatar = typeof e === 'object' && e !== null ? (e.studentAvatar || e.student?.avatarUrl) : '';
          const userObj = allUsers.find((u: any) => String(u.id || u._id) === sId);
          return {
            id: sId,
            name: userObj?.name || sName || 'Student',
            avatarUrl: userObj?.avatarUrl || sAvatar || '',
            role: 'student' as const,
          };
        })
        .filter((s) => s.id && s.id !== String(effectiveUser.id) && s.id !== teacherId && s.id !== '[object Object]');

      enrolledStudents.forEach((student) => {
        others.push(
          buildRemoteParticipant(
            { id: student.id, name: student.name, avatarUrl: student.avatarUrl },
            'student',
            'Student'
          )
        );
      });

      return [local, ...others];
    }

    if (partner) {
      const localRole = swapRoleInfo?.localRole || 'guest';
      const localRoleLabel = swapRoleInfo?.localRoleLabel;
      const localSkill = swapRoleInfo?.localSkillTaught;

      const remoteRole = swapRoleInfo?.remoteRole || 'host';
      const remoteRoleLabel = swapRoleInfo?.remoteRoleLabel;
      const remoteSkill = swapRoleInfo?.remoteSkillTaught;

      const local = buildLocalParticipant(effectiveUser as any, localRole, localRoleLabel, localSkill);
      local.isVideoOff = callMode !== 'video';
      const remote = buildRemoteParticipant(
        { id: partner.id, name: partner.name, avatarUrl: partner.avatarUrl },
        remoteRole,
        remoteRoleLabel,
        remoteSkill
      );
      remote.isVideoOff = callMode !== 'video';
      remote.status = isJoiningCall ? 'connected' : 'connecting';
      return [local, remote];
    }

    return [];
  }, [cls, partner, effectiveUser, allUsers, callMode, isJoiningCall, swapRoleInfo]);

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
    roomCode: hasJoined ? roomCode : null,
    authToken: hasJoined ? authToken : undefined,
    userName: effectiveUser.name || (isTeacher ? 'Teacher' : 'Participant'),
    isTeacher,
    initialParticipants,
    mode: callMode,
    onEndCall: handleEndCall,
    roomId: hasJoined ? targetId : undefined,
    currentUserId: effectiveUser.id,
    partnerId: partner?.id,
    socket,
    initialMicOn,
    initialVideoOn,
  });

  const roomTitle = cls ? cls.title : 'Skill Swap Session';
  const isGroupCall = Boolean(cls);

  // Send notification alert to partner once when entering the Call Preview Screen as caller/initiator
  const hasAlertedPartnerRef = useRef<boolean>(false);

  useEffect(() => {
    const reqId = String((swap?.requesterId as any)?._id || (swap?.requesterId as any)?.id || swap?.requesterId || '');
    const recId = String((swap?.recipientId as any)?._id || (swap?.recipientId as any)?.id || swap?.recipientId || '');
    const resolvedPartnerId = String(partner?.id || (partner as any)?._id || queryPartnerId || (reqId === String(effectiveUser?.id) ? recId : reqId) || '');

    const isValidPartnerId = Boolean(
      resolvedPartnerId &&
      resolvedPartnerId !== 'partner-id' &&
      resolvedPartnerId !== 'partner' &&
      resolvedPartnerId !== '[object Object]' &&
      resolvedPartnerId.length > 2
    );

    if (!hasJoined && !isJoiningCall && socket && targetId && effectiveUser?.id && isValidPartnerId && !hasAlertedPartnerRef.current) {
      hasAlertedPartnerRef.current = true;

      console.log('[UnifiedCallScreen] Emitting incoming call alert to partner from Call Preview Screen:', resolvedPartnerId);

      socket.emit('swap_call_started', {
        swapId: targetId,
        callerId: effectiveUser.id,
        callerName: effectiveUser.name || 'Your partner',
        partnerId: resolvedPartnerId,
        recipientId: resolvedPartnerId,
        mode: callMode,
      });
    }
  }, [hasJoined, isJoiningCall, socket, targetId, effectiveUser, partner, swap, queryPartnerId, callMode]);

  const handleExitPreview = useCallback(() => {
    console.log('[UnifiedCallScreen] User exited from call preview screen');

    try {
      leaveCall();
    } catch (e) {}

    handleEndCall();
  }, [leaveCall, handleEndCall]);

  // Show Pre-Call Camera & Mic Preview Screen first before joining
  if (!hasJoined) {
    return (
      <CallPreviewScreen
        roomTitle={roomTitle}
        userName={effectiveUser.name || (isTeacher ? 'Teacher' : 'You')}
        userAvatar={effectiveUser.avatarUrl}
        partnerName={cls ? (isTeacher ? `${(cls as any).enrolledCount || 0} Students enrolled` : (cls as any).teacherName || (cls as any).teacher?.name || 'Teacher') : partner?.name}
        partnerAvatar={partner?.avatarUrl}
        isTeacher={isTeacher}
        isGroupCall={isGroupCall}
        initialMicOn={initialMicOn}
        initialVideoOn={initialVideoOn}
        onJoin={({ isMicOn, isVideoOn }) => {
          setInitialMicOn(isMicOn);
          setInitialVideoOn(isVideoOn);
          setHasJoined(true);

          if (!isJoiningCall && socket && targetId) {
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
            } else if (!hasAlertedPartnerRef.current) {
              hasAlertedPartnerRef.current = true;
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
          }
        }}
        onCancel={handleExitPreview}
      />
    );
  }

  return (
    <CallScreen
      participants={liveParticipants}
      roomTitle={roomTitle}
      mode={callMode}
      isGroupCall={isGroupCall}
      isTeacher={Boolean(isTeacher || (cls && String((cls as any).teacherId?._id || (cls as any).teacherId?.id || cls.teacherId) === String(effectiveUser.id)))}
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
