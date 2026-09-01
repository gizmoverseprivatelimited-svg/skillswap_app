import { useState, useEffect, useRef, useCallback } from 'react';
import {
  type CallParticipant,
  type CallMessage,
  type CallMode,
  type CallReaction,
  type AudioDevice,
  generateCallMessageId,
  generateReactionId,
} from '../lib/call-engine';

interface Use100msCallProps {
  roomCode?: string | null;
  authToken?: string | null;
  userName: string;
  isTeacher?: boolean;
  initialParticipants: CallParticipant[];
  mode: CallMode;
  onEndCall: () => void;
  roomId?: string;
  currentUserId?: string;
  partnerId?: string;
  socket?: any;
  initialMicOn?: boolean;
  initialVideoOn?: boolean;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

export function use100msCall({
  roomCode,
  authToken,
  userName,
  isTeacher = false,
  initialParticipants,
  mode,
  onEndCall,
  roomId,
  currentUserId,
  partnerId,
  socket,
  initialMicOn = true,
  initialVideoOn = true,
}: Use100msCallProps) {
  const [participants, setParticipants] = useState<CallParticipant[]>(initialParticipants);
  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [reactions, setReactions] = useState<CallReaction[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<AudioDevice>('SPEAKER_PHONE');
  const [availableAudioDevices, setAvailableAudioDevices] = useState<string[]>(['SPEAKER_PHONE', 'EARPIECE']);

  const webStreamRef = useRef<MediaStream | null>(null);
  const webScreenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const meshPeerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const candidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const broadcastChannelRef = useRef<any>(null);

  const onEndCallRef = useRef(onEndCall);
  onEndCallRef.current = onEndCall;

  const socketRef = useRef(socket);
  socketRef.current = socket;

  const userNameRef = useRef(userName);
  userNameRef.current = userName;

  const partnerIdRef = useRef(partnerId);
  partnerIdRef.current = partnerId;

  // Sync initial participants while preserving active media streams, remote peers, and roles
  useEffect(() => {
    if (!initialParticipants || initialParticipants.length === 0) return;
    setParticipants(prev => {
      const activeStream = webStreamRef.current;
      if (prev.length === 0) {
        return initialParticipants.map(p =>
          p.isLocal && activeStream ? { ...p, mediaStream: activeStream } : p
        );
      }

      // 1. Update existing participants in state
      const updatedExisting = prev.map(existing => {
        const matchingInit = initialParticipants.find(
          initP => String(initP.id) === String(existing.id) || (initP.isLocal && existing.isLocal)
        );
        if (!matchingInit) return existing; // Keep dynamically discovered WebRTC mesh peers!
        return {
          ...existing,
          name: existing.name || matchingInit.name,
          role: existing.role || matchingInit.role,
          avatarUrl: existing.avatarUrl || matchingInit.avatarUrl,
          mediaStream: existing.isLocal ? (activeStream || existing.mediaStream) : existing.mediaStream,
          videoTrackId: existing.videoTrackId || matchingInit.videoTrackId,
          status: existing.status === 'connected' ? 'connected' : matchingInit.status,
          isVideoOff: existing.isVideoOff,
          isMuted: existing.isMuted,
        };
      });

      // 2. Add any new initial participants not already in prev
      const newInitials = initialParticipants.filter(
        initP => !prev.some(p => String(p.id) === String(initP.id) || (p.isLocal && initP.isLocal))
      );

      return [...updatedExisting, ...newInitials];
    });
  }, [initialParticipants]);

  // 1. Web Media (Camera & Mic) and WebRTC Peer Connection
  useEffect(() => {
    if (!roomId) return;
    let isCancelled = false;
    const enableVideo = mode === 'video';
    const activeSocket = socketRef.current;
    let presenceHeartbeat: any = null;
    let handleSignalMessage: ((msg: any) => void) | undefined;
    let handlePeerJoined: ((data: any) => Promise<void>) | undefined;
    let handlePeerPresent: ((data: any) => Promise<void>) | undefined;
    let handlePeerLeft: ((data: any) => void) | undefined;
    let handleReactionMessage: ((data: any) => void) | undefined;
    let handleChatMessage: ((data: any) => void) | undefined;
    let handleCallEnded: ((data?: any) => void) | undefined;

    const onCallSignal = (data: any) => { if (typeof handleSignalMessage === 'function') handleSignalMessage(data); };
    const onCallPeerJoined = (data: any) => { if (typeof handlePeerJoined === 'function') void handlePeerJoined(data); };
    const onCallPeerPresent = (data: any) => { if (typeof handlePeerPresent === 'function') void handlePeerPresent(data); };
    const onCallPeerLeft = (data: any) => { if (typeof handlePeerLeft === 'function') handlePeerLeft(data); };
    const onCallReaction = (data: any) => { if (typeof handleReactionMessage === 'function') handleReactionMessage(data); };
    const onCallChatMessage = (data: any) => { if (typeof handleChatMessage === 'function') handleChatMessage(data); };
    const onCallEnded = (data: any) => { if (typeof handleCallEnded === 'function') handleCallEnded(data); };

    if (activeSocket) {
      activeSocket.emit('join_call_room', { room: roomId, userId: currentUserId });
      activeSocket.on('call_signal', onCallSignal);
      activeSocket.on('signal', onCallSignal);
      activeSocket.on('call_peer_joined', onCallPeerJoined);
      activeSocket.on('peer_joined', onCallPeerJoined);
      activeSocket.on('call_peer_present', onCallPeerPresent);
      activeSocket.on('peer_present', onCallPeerPresent);
      activeSocket.on('call_peer_left', onCallPeerLeft);
      activeSocket.on('peer_left', onCallPeerLeft);
      activeSocket.on('call_reaction', onCallReaction);
      activeSocket.on('call_chat_message', onCallChatMessage);
      activeSocket.on('call_ended', onCallEnded);
    }

    // Broadcast channel for instantaneous cross-tab/cross-window signaling
    const channelName = `skillswap_call_${roomId || 'general'}`;
    let bc: any = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(channelName);
        broadcastChannelRef.current = bc;
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }

    async function initWebRTC() {
      setIsConnecting(true);

      // 1a. Acquire local user media stream
      let stream: MediaStream | null = null;
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: enableVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
            audio: true,
          });
        }
      } catch (err: any) {
        console.warn('[use100msCall Web] getUserMedia with full constraints failed, attempting fallback audio/video:', err);
        try {
          if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
            stream = await navigator.mediaDevices.getUserMedia({
              video: enableVideo,
              audio: true,
            });
          }
        } catch (fallbackErr) {
          console.warn('[use100msCall Web] Fallback audio/video failed, trying audio-only:', fallbackErr);
          try {
            if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
              stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }
          } catch (audioErr) {
            console.warn('[use100msCall Web] Audio-only failed:', audioErr);
          }
        }
      }

      if (isCancelled) {
        if (stream) stream.getTracks().forEach(t => t.stop());
        return;
      }

      if (stream) {
        if (initialMicOn === false) {
          stream.getAudioTracks().forEach(t => { t.enabled = false; });
        }
        if (initialVideoOn === false || !enableVideo) {
          stream.getVideoTracks().forEach(t => { t.enabled = false; });
        }
        webStreamRef.current = stream;
      }

      // Update local participant with media stream
      setParticipants(prev =>
        prev.map(p =>
          p.isLocal
            ? {
              ...p,
              mediaStream: stream,
              status: 'connected',
              isVideoOff: initialVideoOn === false || !enableVideo || !stream?.getVideoTracks()?.length,
              isMuted: initialMicOn === false || !stream?.getAudioTracks()?.length,
            }
            : p
        )
      );
      setIsConnected(true);
      setIsConnecting(false);

      // 1b. Multi-Peer WebRTC Mesh Architecture
      if (typeof RTCPeerConnection !== 'undefined' && stream) {
        meshPeerConnectionsRef.current.clear();
        const peerConnections = meshPeerConnectionsRef.current;
        const candidateQueues = new Map<string, RTCIceCandidateInit[]>();

        // Helper to send WebRTC signals across all available communication transports
        const sendSignal = (payload: any) => {
          const signalMsg = {
            ...payload,
            room: roomId,
            senderId: currentUserId,
            targetId: payload.targetId || payload.to,
            timestamp: Date.now(),
          };

          // 1. BroadcastChannel (fast local/cross-tab sync)
          if (bc) {
            try {
              bc.postMessage(signalMsg);
            } catch (e) {}
          }

          // 2. Socket.IO signaling
          const sock = socketRef.current || activeSocket || socket;
          if (sock) {
            try {
              sock.emit('call_signal', signalMsg);
              sock.emit('signal', signalMsg);
            } catch (e) {}
          }
        };

        const drainCandidateQueue = async (targetId: string, pc: RTCPeerConnection) => {
          const queue = candidateQueues.get(targetId) || [];
          while (queue.length > 0) {
            const cand = queue.shift();
            if (cand) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.warn('[WebRTC Mesh] addIceCandidate error:', e);
              }
            }
          }
          candidateQueues.set(targetId, queue);
        };

        const getOrCreatePeerConnection = (targetId: string, role?: string, name?: string, avatarUrl?: string) => {
          if (!targetId || targetId === currentUserId) return null;

          let pc = peerConnections.get(targetId);
          if (pc && pc.signalingState !== 'closed') {
            return pc;
          }

          console.log('[WebRTC Mesh] Creating dedicated RTCPeerConnection for peer:', targetId, name);
          pc = new RTCPeerConnection(ICE_SERVERS);
          peerConnections.set(targetId, pc);

          // Add local stream tracks to this peer connection (use active screenshare track if currently sharing)
          if (stream) {
            const activeScreenTrack = webScreenStreamRef.current?.getVideoTracks()[0];
            const hasActiveScreen = activeScreenTrack && activeScreenTrack.readyState === 'live';

            stream.getTracks().forEach(track => {
              try {
                if (track.kind === 'video' && hasActiveScreen) {
                  // Add the live screen share track directly to the new peer connection
                  pc!.addTrack(activeScreenTrack, stream!);
                } else {
                  pc!.addTrack(track, stream!);
                }
              } catch (e) {
                console.warn('[WebRTC Mesh] addTrack error:', e);
              }
            });
          }

          // Handle incoming remote media tracks exclusively for this specific peer
          pc.ontrack = (event: RTCTrackEvent) => {
            console.log('[WebRTC Mesh] Received remote track from peer:', targetId, event.track?.kind);
            const remoteStream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);

            setParticipants(prev => {
              const existing = prev.find(p => p.id === targetId);
              if (existing) {
                return prev.map(p =>
                  p.id === targetId
                    ? {
                        ...p,
                        mediaStream: remoteStream,
                        screenShareStream: (p.screenShareStream || Boolean(p.screenShareTrackId)) ? remoteStream : p.screenShareStream,
                        status: 'connected' as const,
                        name: name || p.name,
                        avatarUrl: avatarUrl || p.avatarUrl,
                        role: (role as any) || p.role || (existing.role ? existing.role : 'student'),
                      }
                    : p
                );
              }
              return [
                ...prev,
                {
                  id: targetId,
                  name: name || 'Participant',
                  avatarUrl: avatarUrl || '',
                  role: (role as any) || 'student',
                  isLocal: false,
                  mediaStream: remoteStream,
                  status: 'connected' as const,
                  isVideoOff: false,
                  isMuted: false,
                  isHandRaised: false,
                  isSpeaking: false,
                  joinedAt: new Date().toISOString(),
                }
              ];
            });
          };

          // ICE candidate handler for this specific peer
          pc.onicecandidate = (event) => {
            if (event.candidate) {
              sendSignal({
                type: 'candidate',
                candidate: event.candidate,
                targetId,
                to: targetId,
              });
            }
          };

          pc.onconnectionstatechange = () => {
            console.log(`[WebRTC Mesh] Peer ${targetId} Connection State:`, pc!.connectionState);
            if (pc!.connectionState === 'connected') {
              setIsConnected(true);
              setParticipants(prev => prev.map(p => (p.id === targetId ? { ...p, status: 'connected' as const } : p)));
            } else if (pc!.connectionState === 'disconnected' || pc!.connectionState === 'failed') {
              console.log(`[WebRTC Mesh] Disconnected from peer: ${targetId}`);
            }
          };

          return pc;
        };

        // Signaling message dispatcher for mesh WebRTC
        handleSignalMessage = async (msg: any) => {
          if (!msg || msg.senderId === currentUserId) return;
          if (msg.targetId && currentUserId && msg.targetId !== currentUserId) return;

          const senderId = String(msg.senderId);

          try {
            if (msg.type === 'offer') {
              console.log('[WebRTC Mesh] Processing Offer from', senderId);
              const pc = getOrCreatePeerConnection(senderId, msg.role, msg.userName, msg.userAvatar);
              if (!pc) return;

              const isPolite = String(currentUserId) > String(senderId);
              const isCollision = pc.signalingState !== 'stable';

              if (isCollision) {
                if (!isPolite) {
                  console.log('[WebRTC Mesh] Glare collision: Impolite peer ignoring incoming offer from', senderId);
                  return;
                }
                console.log('[WebRTC Mesh] Glare collision: Polite peer rolling back to accept offer from', senderId);
                try {
                  await pc.setLocalDescription({ type: 'rollback' });
                } catch (e) {
                  console.warn('[WebRTC Mesh] Rollback error:', e);
                }
              }

              await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
              await drainCandidateQueue(senderId, pc);

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              if (msg.isScreenSharing) {
                setParticipants(prev =>
                  prev.map(p =>
                    p.id === senderId
                      ? { ...p, screenShareStream: p.mediaStream }
                      : p
                  )
                );
              }

              if (msg.isVideoOff !== undefined) {
                setParticipants(prev =>
                  prev.map(p =>
                    p.id === senderId
                      ? { ...p, isVideoOff: Boolean(msg.isVideoOff), isMuted: msg.isMuted !== undefined ? Boolean(msg.isMuted) : p.isMuted }
                      : p
                  )
                );
              }

              const isCurrentLocalVideoOff = Boolean(
                !webStreamRef.current ||
                initialVideoOn === false ||
                mode !== 'video' ||
                !webStreamRef.current.getVideoTracks().some(t => t.enabled && !t.muted && t.readyState === 'live')
              );
              const isCurrentLocalMuted = Boolean(
                !webStreamRef.current ||
                initialMicOn === false ||
                !webStreamRef.current.getAudioTracks().some(t => t.enabled && !t.muted)
              );

              sendSignal({
                type: 'answer',
                answer,
                targetId: senderId,
                to: senderId,
                role: isTeacher ? 'teacher' : 'student',
                userName: userNameRef.current,
                isScreenSharing: Boolean(webScreenStreamRef.current && webScreenStreamRef.current.active),
                isVideoOff: isCurrentLocalVideoOff,
                isMuted: isCurrentLocalMuted,
              });
            } else if (msg.type === 'answer') {
              console.log('[WebRTC Mesh] Processing Answer from', senderId, 'isVideoOff:', msg.isVideoOff);
              const pc = peerConnections.get(senderId);
              if (pc && pc.signalingState !== 'stable') {
                await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
                await drainCandidateQueue(senderId, pc);
              }
              if (msg.isVideoOff !== undefined) {
                setParticipants(prev =>
                  prev.map(p =>
                    p.id === senderId
                      ? { ...p, isVideoOff: Boolean(msg.isVideoOff), isMuted: msg.isMuted !== undefined ? Boolean(msg.isMuted) : p.isMuted }
                      : p
                  )
                );
              }
              if (msg.isScreenSharing) {
                setParticipants(prev =>
                  prev.map(p =>
                    p.id === senderId
                      ? { ...p, screenShareStream: p.mediaStream }
                      : p
                  )
                );
              }
            } else if (msg.type === 'candidate' && msg.candidate) {
              const pc = peerConnections.get(senderId);
              if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                } catch (e) {
                  console.warn('[WebRTC Mesh] Add candidate error:', e);
                }
              } else {
                const queue = candidateQueues.get(senderId) || [];
                queue.push(msg.candidate);
                candidateQueues.set(senderId, queue);
              }
            } else if (msg.type === 'media_state') {
              setParticipants(prev =>
                prev.map(p =>
                  p.id === senderId
                    ? {
                        ...p,
                        isVideoOff: msg.isVideoOff !== undefined ? msg.isVideoOff : p.isVideoOff,
                        isMuted: msg.isMuted !== undefined ? msg.isMuted : p.isMuted,
                      }
                    : p
                )
              );
            } else if (msg.type === 'screenshare_state') {
              console.log('[WebRTC Mesh] Received screenshare_state from', senderId, msg.isScreenSharing);
              setParticipants(prev =>
                prev.map(p =>
                  p.id === senderId
                    ? {
                        ...p,
                        screenShareStream: msg.isScreenSharing ? (p.mediaStream || prev.find(x => x.id === senderId)?.mediaStream) : undefined,
                      }
                    : p
                )
              );
            } else if (msg.type === 'reaction') {
              if (msg.senderId && currentUserId && msg.senderId === currentUserId) return;
              const raw = msg.reaction || msg;
              const emoji = typeof raw === 'string' ? raw : (raw.emoji || '');
              if (emoji) {
                const reactionObj: CallReaction = {
                  id: (typeof raw === 'object' && raw.id) || generateReactionId(),
                  emoji,
                  senderName: (typeof raw === 'object' && raw.senderName) || msg.senderName || 'Participant',
                  timestamp: (typeof raw === 'object' && raw.timestamp) || Date.now(),
                };
                setReactions(prev => (prev.some(r => r.id === reactionObj.id) ? prev : [...prev.slice(-15), reactionObj]));
              }
            } else if (msg.type === 'chat') {
              if (msg.message) {
                const incoming = typeof msg.message === 'string'
                  ? { id: generateCallMessageId(), authorId: msg.senderId || 'peer', authorName: msg.senderName || 'Participant', body: msg.message, createdAt: new Date().toISOString() }
                  : {
                      id: msg.message.id || generateCallMessageId(),
                      authorId: msg.message.authorId || msg.senderId || 'peer',
                      authorName: msg.message.authorName || msg.senderName || 'Participant',
                      body: msg.message.body || msg.message.text || msg.message.message || '',
                      createdAt: msg.message.createdAt || new Date().toISOString(),
                      isSystem: Boolean(msg.message.isSystem),
                    };
                if (incoming.authorId && incoming.authorId === currentUserId) return;
                setMessages(prev => (prev.some(m => m.id === incoming.id) ? prev : [...prev, incoming]));
              }
            } else if (msg.type === 'call_ended') {
              onEndCall();
            }
          } catch (signalErr) {
            console.warn('[WebRTC Mesh] Signal error:', signalErr);
          }
        };

        handlePeerJoined = async (data: any) => {
          console.log('[WebRTC Mesh] Peer joined event:', data);
          const peerId = String(data?.userId || data?.senderId || '');
          if (!peerId || peerId === String(currentUserId)) return;

          const peerName = data?.userName || data?.senderName || 'Partner';
          const peerRole = data?.role || (data?.isTeacher ? 'teacher' : 'student');
          const peerAvatar = data?.userAvatar || data?.avatarUrl || '';

          const sysMsg: CallMessage = {
            id: generateCallMessageId(),
            authorId: peerId,
            authorName: 'System',
            body: `${peerName} joined the call`,
            createdAt: new Date().toISOString(),
            isSystem: true,
          };
          setMessages(prev => (prev.some(m => m.id === sysMsg.id) ? prev : [...prev, sysMsg]));

          setParticipants(prev => {
            const existing = prev.find(p => p.id === peerId || (!p.isLocal && peerRole === 'teacher' && (p.role === 'teacher' || p.role === 'host')));
            if (existing) {
              return prev.map(p =>
                (p.id === peerId || p.id === existing.id)
                  ? { ...p, id: peerId, status: 'connected' as const, name: peerName || p.name, avatarUrl: peerAvatar || p.avatarUrl, role: peerRole || p.role || existing.role }
                  : p
              );
            }
            return [
              ...prev,
              {
                id: peerId,
                name: peerName,
                avatarUrl: peerAvatar,
                role: peerRole || 'student',
                isLocal: false,
                isMuted: false,
                isVideoOff: false,
                isHandRaised: false,
                isSpeaking: false,
                status: 'connected' as const,
                joinedAt: new Date().toISOString(),
              }
            ];
          });

          // Reply with our presence so the new peer registers us immediately
          const isCurrentlySharingScreen = Boolean(webScreenStreamRef.current && webScreenStreamRef.current.active);
          const isCurrentLocalVideoOff = Boolean(
            !webStreamRef.current ||
            initialVideoOn === false ||
            mode !== 'video' ||
            !webStreamRef.current.getVideoTracks().some(t => t.enabled && !t.muted && t.readyState === 'live')
          );
          const isCurrentLocalMuted = Boolean(
            !webStreamRef.current ||
            initialMicOn === false ||
            !webStreamRef.current.getAudioTracks().some(t => t.enabled && !t.muted)
          );

          const presencePayload = {
            type: 'peer_present',
            room: roomId,
            userId: currentUserId,
            userName: userNameRef.current,
            role: isTeacher ? 'teacher' : 'student',
            targetId: peerId,
            to: peerId,
            isScreenSharing: isCurrentlySharingScreen,
            isVideoOff: isCurrentLocalVideoOff,
            isMuted: isCurrentLocalMuted,
          };
          activeSocket?.emit('call_peer_present', presencePayload);
          if (bc) {
            try { bc.postMessage(presencePayload); } catch (e) {}
          }

          // If we are currently sharing screen, send direct screenshare_state notification to new joiner
          if (isCurrentlySharingScreen) {
            sendSignal({
              type: 'screenshare_state',
              room: roomId,
              senderId: currentUserId,
              targetId: peerId,
              to: peerId,
              isScreenSharing: true,
            });
          }

          // Send current media state directly to newly joined peer
          sendSignal({
            type: 'media_state',
            room: roomId,
            senderId: currentUserId,
            targetId: peerId,
            to: peerId,
            isVideoOff: isCurrentLocalVideoOff,
            isMuted: isCurrentLocalMuted,
          });

          // Create offer for the new joiner
          const pc = getOrCreatePeerConnection(peerId, peerRole, peerName, peerAvatar);
          if (pc) {
            try {
              const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
              await pc.setLocalDescription(offer);
              sendSignal({
                type: 'offer',
                offer,
                targetId: peerId,
                to: peerId,
                role: isTeacher ? 'teacher' : 'student',
                userName: userNameRef.current,
                isScreenSharing: isCurrentlySharingScreen,
                isVideoOff: isCurrentLocalVideoOff,
                isMuted: isCurrentLocalMuted,
              });
            } catch (err) {
              console.warn('[WebRTC Mesh] Create offer error for peer:', peerId, err);
            }
          }
        };

        handlePeerPresent = async (data: any) => {
          console.log('[WebRTC Mesh] Peer present event:', data);
          const peerId = String(data?.userId || data?.senderId || '');
          if (!peerId || peerId === String(currentUserId)) return;

          const peerName = data?.userName || data?.senderName || 'Partner';
          const peerRole = data?.role || (data?.isTeacher ? 'teacher' : 'student');
          const peerAvatar = data?.userAvatar || data?.avatarUrl || '';
          const remoteIsSharingScreen = Boolean(data?.isScreenSharing);
          const hasExplicitVideoOff = data?.isVideoOff !== undefined;
          const remoteIsVideoOff = hasExplicitVideoOff ? Boolean(data.isVideoOff) : undefined;
          const hasExplicitMuted = data?.isMuted !== undefined;
          const remoteIsMuted = hasExplicitMuted ? Boolean(data.isMuted) : undefined;

          setParticipants(prev => {
            const existing = prev.find(p => p.id === peerId || (!p.isLocal && peerRole === 'teacher' && (p.role === 'teacher' || p.role === 'host')));
            if (existing) {
              return prev.map(p =>
                (p.id === peerId || p.id === existing.id)
                  ? {
                      ...p,
                      id: peerId,
                      status: 'connected' as const,
                      name: peerName || p.name,
                      avatarUrl: peerAvatar || p.avatarUrl,
                      role: peerRole || p.role || existing.role,
                      isVideoOff: remoteIsVideoOff !== undefined ? remoteIsVideoOff : p.isVideoOff,
                      isMuted: remoteIsMuted !== undefined ? remoteIsMuted : p.isMuted,
                      screenShareStream: remoteIsSharingScreen ? (p.mediaStream || p.screenShareStream) : p.screenShareStream,
                    }
                  : p
              );
            }
            return [
              ...prev,
              {
                id: peerId,
                name: peerName,
                avatarUrl: peerAvatar,
                role: peerRole || 'student',
                isLocal: false,
                isMuted: remoteIsMuted ?? false,
                isVideoOff: remoteIsVideoOff ?? false,
                isHandRaised: false,
                isSpeaking: false,
                status: 'connected' as const,
                joinedAt: new Date().toISOString(),
              }
            ];
          });

          // Ensure connection exists and initiate offer if we are the designated offerer
          const isCurrentlySharingScreen = Boolean(webScreenStreamRef.current && webScreenStreamRef.current.active);
          const pc = getOrCreatePeerConnection(peerId, peerRole, peerName, peerAvatar);
          if (pc && pc.signalingState === 'stable' && String(currentUserId) < String(peerId)) {
            try {
              const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
              await pc.setLocalDescription(offer);
              sendSignal({
                type: 'offer',
                offer,
                targetId: peerId,
                to: peerId,
                role: isTeacher ? 'teacher' : 'student',
                userName: userNameRef.current,
                isScreenSharing: isCurrentlySharingScreen,
              });

              if (isCurrentlySharingScreen) {
                sendSignal({
                  type: 'screenshare_state',
                  room: roomId,
                  senderId: currentUserId,
                  targetId: peerId,
                  to: peerId,
                  isScreenSharing: true,
                });
              }
            } catch (err) {
              console.warn('[WebRTC Mesh] Present create offer error:', err);
            }
          }
        };

        handlePeerLeft = (data: any) => {
          console.log('[WebRTC Mesh] Peer left event:', data);
          const peerId = String(data?.userId || data?.senderId || '');
          if (!peerId || peerId === String(currentUserId)) return;

          const peerName = data?.userName || data?.senderName || 'Participant';

          // In-call popup notification: Student/Peer left
          const sysMsg: CallMessage = {
            id: generateCallMessageId(),
            authorId: peerId,
            authorName: 'System',
            body: `${peerName} left the call`,
            createdAt: new Date().toISOString(),
            isSystem: true,
          };
          setMessages(prev => (prev.some(m => m.id === sysMsg.id) ? prev : [...prev, sysMsg]));

          const existingPC = peerConnections.get(peerId);
          if (existingPC) {
            try { existingPC.close(); } catch (e) {}
            peerConnections.delete(peerId);
          }
          candidateQueues.delete(peerId);

          setParticipants(prev =>
            prev.map(p =>
              p.id === peerId ? { ...p, status: 'disconnected' as const, mediaStream: undefined, videoTrackId: undefined } : p
            )
          );
        };

        handleReactionMessage = (data: any) => {
          if (!data) return;
          if (data.senderId && currentUserId && data.senderId === currentUserId) return;
          const raw = data.reaction || data;
          if (!raw) return;
          const emoji = typeof raw === 'string' ? raw : (raw.emoji || (typeof data.emoji === 'string' ? data.emoji : ''));
          if (!emoji) return;

          const reactionObj: CallReaction = {
            id: (typeof raw === 'object' && raw.id) || generateReactionId(),
            emoji,
            senderName: (typeof raw === 'object' && raw.senderName) || data.senderName || 'Participant',
            timestamp: (typeof raw === 'object' && raw.timestamp) || Date.now(),
          };

          setReactions(prev => (prev.some(r => r.id === reactionObj.id) ? prev : [...prev.slice(-15), reactionObj]));
        };

        handleChatMessage = (data: any) => {
          const raw = data?.message || data;
          if (raw) {
            const incoming = typeof raw === 'string'
              ? { id: generateCallMessageId(), authorId: data?.senderId || 'peer', authorName: data?.senderName || 'Participant', body: raw, createdAt: new Date().toISOString() }
              : {
                  id: raw.id || generateCallMessageId(),
                  authorId: raw.authorId || data?.senderId || 'peer',
                  authorName: raw.authorName || data?.senderName || 'Participant',
                  body: raw.body || raw.text || raw.message || '',
                  createdAt: raw.createdAt || new Date().toISOString(),
                  isSystem: Boolean(raw.isSystem),
                };
            if (incoming.authorId && incoming.authorId === currentUserId) return;
            setMessages(prev => (prev.some(m => m.id === incoming.id) ? prev : [...prev, incoming]));
          }
        };

        handleCallEnded = (data: any) => {
          console.log('[WebRTC Mesh] Remote peer ended/left call:', data);
          handlePeerLeft?.(data || { userName: 'Partner' });
        };
        const peerJoinPayload = {
          type: 'peer_joined',
          room: roomId,
          userId: currentUserId,
          userName: userNameRef.current,
          role: isTeacher ? 'teacher' : 'student',
          targetId: partnerIdRef.current,
          to: partnerIdRef.current,
        };
        activeSocket?.emit('call_peer_joined', peerJoinPayload);
        if (bc) {
          try { bc.postMessage(peerJoinPayload); } catch (e) {}
        }

        if (bc) {
          bc.onmessage = (evt: MessageEvent) => {
            const data = evt.data;
            if (data?.type === 'peer_joined') {
              void handlePeerJoined?.(data);
            } else if (data?.type === 'peer_present') {
              void handlePeerPresent?.(data);
            } else {
              void handleSignalMessage?.(data);
            }
          };
        }

        // Periodic presence heartbeat sync (only presence and screenshare state; media_state is sent explicitly on user toggle)
        presenceHeartbeat = setInterval(() => {
          if (activeSocket) {
            const isCurrentlySharingScreen = Boolean(webScreenStreamRef.current && webScreenStreamRef.current.active);
            const heartbeatPayload = {
              type: 'peer_present',
              room: roomId,
              userId: currentUserId,
              userName: userNameRef.current,
              role: isTeacher ? 'teacher' : 'student',
              isScreenSharing: isCurrentlySharingScreen,
            };
            activeSocket.emit('call_peer_present', heartbeatPayload);
          }
        }, 3500);

        // If partnerId was provided (1:1 call), initialize offer
        const currentPartnerId = partnerIdRef.current;
        if (currentPartnerId && currentUserId && String(currentUserId) < String(currentPartnerId)) {
          setTimeout(async () => {
            try {
              const pc = getOrCreatePeerConnection(currentPartnerId);
              if (pc && pc.signalingState === 'stable') {
                const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
                await pc.setLocalDescription(offer);
                sendSignal({
                  type: 'offer',
                  offer,
                  targetId: currentPartnerId,
                  to: currentPartnerId,
                  role: isTeacher ? 'teacher' : 'student',
                  userName: userNameRef.current,
                });
              }
            } catch (offerErr) {
              console.warn('[WebRTC Mesh] Initial 1:1 offer error:', offerErr);
            }
          }, 500);
        }
      }
    }

    void initWebRTC();

    return () => {
      isCancelled = true;
      if (presenceHeartbeat) {
        clearInterval(presenceHeartbeat);
      }
      if (webStreamRef.current) {
        webStreamRef.current.getTracks().forEach(track => track.stop());
        webStreamRef.current = null;
      }
      if (webScreenStreamRef.current) {
        webScreenStreamRef.current.getTracks().forEach(track => track.stop());
        webScreenStreamRef.current = null;
      }
      if (bc) {
        bc.close();
        broadcastChannelRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (activeSocket) {
        activeSocket.off('call_signal', onCallSignal);
        activeSocket.off('signal', onCallSignal);
        activeSocket.off('call_peer_joined', onCallPeerJoined);
        activeSocket.off('peer_joined', onCallPeerJoined);
        activeSocket.off('call_peer_present', onCallPeerPresent);
        activeSocket.off('peer_present', onCallPeerPresent);
        activeSocket.off('call_peer_left', onCallPeerLeft);
        activeSocket.off('peer_left', onCallPeerLeft);
        activeSocket.off('call_reaction', onCallReaction);
        activeSocket.off('call_chat_message', onCallChatMessage);
        activeSocket.off('call_ended', onCallEnded);
      }
    };
  }, [mode, roomId, currentUserId]);

  // Toggle local microphone
  const toggleMute = useCallback(() => {
    setParticipants(prev => {
      const local = prev.find(p => p.isLocal);
      const nextMuted = !(local?.isMuted ?? false);

      if (webStreamRef.current) {
        webStreamRef.current.getAudioTracks().forEach((track: any) => {
          track.enabled = !nextMuted;
        });
      }

      const mediaStateMsg = {
        type: 'media_state',
        room: roomId,
        senderId: currentUserId,
        isMuted: nextMuted,
      };

      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage(mediaStateMsg);
        } catch (e) { }
      }

      if (socket) {
        socket.emit('call_signal', mediaStateMsg);
        socket.emit('signal', mediaStateMsg);
      }

      return prev.map(p => (p.isLocal ? { ...p, isMuted: nextMuted, isSpeaking: false } : p));
    });
  }, [socket, roomId, currentUserId]);

  // Toggle local camera video
  const toggleVideo = useCallback(() => {
    setParticipants(prev => {
      const local = prev.find(p => p.isLocal);
      const nextVideoOff = !(local?.isVideoOff ?? false);

      if (webStreamRef.current) {
        webStreamRef.current.getVideoTracks().forEach((track: any) => {
          track.enabled = !nextVideoOff;
        });
      }

      const mediaStateMsg = {
        type: 'media_state',
        room: roomId,
        senderId: currentUserId,
        isVideoOff: nextVideoOff,
      };

      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage(mediaStateMsg);
        } catch (e) { }
      }

      if (socket) {
        socket.emit('call_signal', mediaStateMsg);
        socket.emit('signal', mediaStateMsg);
      }

      return prev.map(p => (p.isLocal ? { ...p, isVideoOff: nextVideoOff } : p));
    });
  }, [socket, roomId, currentUserId]);

  // Switch camera (Front / Back)
  const switchCamera = useCallback(async () => {
    // Web camera toggle placeholder
  }, []);

  // Screen Sharing (Start / Stop)
  const toggleScreenShare = useCallback(async () => {
    // Only teacher can share screen in group classes (or both in 1:1)
    if (!isTeacher && !partnerIdRef.current) {
      console.warn('[use100msCall Web] Screen sharing is restricted to teachers in group classes.');
      return;
    }

    if (isScreenSharing) {
      if (webScreenStreamRef.current) {
        webScreenStreamRef.current.getTracks().forEach((t: any) => t.stop());
        webScreenStreamRef.current = null;
      }

      // Revert all mesh peer connections' video tracks back to camera track
      const camTrack = webStreamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        meshPeerConnectionsRef.current.forEach(pc => {
          try {
            const senders = pc.getSenders();
            const videoSender = senders.find(s => s.track?.kind === 'video');
            if (videoSender) {
              videoSender.replaceTrack(camTrack).catch(e => console.warn('Revert cam track error:', e));
            }
          } catch (e) {
            console.warn('Revert track error:', e);
          }
        });
      }

      // Broadcast screen share ended
      const screenShareMsg = {
        type: 'screenshare_state',
        room: roomId,
        senderId: currentUserId,
        isScreenSharing: false,
      };
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage(screenShareMsg);
        } catch (e) { }
      }
      if (socket) {
        socket.emit('call_signal', screenShareMsg);
        socket.emit('signal', screenShareMsg);
      }

      setParticipants(prev => prev.map(p => (p.isLocal ? { ...p, screenShareStream: undefined } : p)));
      setIsScreenSharing(false);
    } else {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia) {
        try {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
          webScreenStreamRef.current = screenStream;
          setIsScreenSharing(true);

          const screenTrack = screenStream.getVideoTracks()[0];

          // Replace video track on ALL mesh peer connections with screenshare track
          if (screenTrack) {
            meshPeerConnectionsRef.current.forEach(pc => {
              try {
                const senders = pc.getSenders();
                const videoSender = senders.find(s => s.track?.kind === 'video');
                if (videoSender) {
                  videoSender.replaceTrack(screenTrack).catch(e => console.warn('Replace screenshare track error:', e));
                }
              } catch (e) {
                console.warn('Replace screenshare track error:', e);
              }
            });
          }

          // Broadcast screenshare started
          const screenShareMsg = {
            type: 'screenshare_state',
            room: roomId,
            senderId: currentUserId,
            isScreenSharing: true,
          };
          if (broadcastChannelRef.current) {
            try {
              broadcastChannelRef.current.postMessage(screenShareMsg);
            } catch (e) { }
          }
          if (socket) {
            socket.emit('call_signal', screenShareMsg);
            socket.emit('signal', screenShareMsg);
          }

          screenTrack.onended = () => {
            // Auto revert when user clicks browser "Stop Sharing" button
            setIsScreenSharing(false);
            const camTrack = webStreamRef.current?.getVideoTracks()[0];
            if (camTrack) {
              meshPeerConnectionsRef.current.forEach(pc => {
                try {
                  const senders = pc.getSenders();
                  const videoSender = senders.find(s => s.track?.kind === 'video');
                  if (videoSender) {
                    videoSender.replaceTrack(camTrack).catch(e => console.warn('Revert cam track error:', e));
                  }
                } catch (e) {
                  console.warn('Revert cam track on end error:', e);
                }
              });
            }
            const endedMsg = {
              type: 'screenshare_state',
              room: roomId,
              senderId: currentUserId,
              isScreenSharing: false,
            };
            if (broadcastChannelRef.current) {
              try {
                broadcastChannelRef.current.postMessage(endedMsg);
              } catch (e) { }
            }
            if (socket) {
              socket.emit('call_signal', endedMsg);
              socket.emit('signal', endedMsg);
            }
            setParticipants(prev => prev.map(p => (p.isLocal ? { ...p, screenShareStream: undefined } : p)));
          };

          setParticipants(prev => prev.map(p => (p.isLocal ? { ...p, screenShareStream: screenStream } : p)));
        } catch (err) {
          console.warn('[use100msCall Web] DisplayMedia error:', err);
        }
      }
    }
  }, [isScreenSharing, roomId, currentUserId, socket, isTeacher]);

  // Audio Device Routing
  const switchAudioOutput = useCallback(async (device: AudioDevice) => {
    setSelectedAudioDevice(device);
  }, []);

  // Hand raise / lower
  const toggleHand = useCallback(() => {
    setParticipants(prev => {
      const local = prev.find(p => p.isLocal);
      const nextRaised = !(local?.isHandRaised ?? false);
      return prev.map(p => (p.isLocal ? { ...p, isHandRaised: nextRaised } : p));
    });
  }, []);

  // Send In-Call Reactions
  const sendReaction = useCallback(
    (emoji: string) => {
      const reaction: CallReaction = {
        id: generateReactionId(),
        emoji,
        senderName: userName || 'You',
        timestamp: Date.now(),
      };
      setReactions(prev => [...prev.slice(-15), reaction]);

      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({ type: 'reaction', room: roomId, senderId: currentUserId, reaction });
        } catch (e) { }
      }
      if (socket) {
        socket.emit('call_reaction', { room: roomId, senderId: currentUserId, partnerId, to: partnerId, reaction });
      }
    },
    [userName, socket, roomId, currentUserId, partnerId]
  );

  // Host Moderation: Mute a remote participant
  const muteParticipant = useCallback(
    async (participantId: string) => {
      if (!isTeacher) return;
      setParticipants(prev => prev.map(p => (p.id === participantId ? { ...p, isMuted: true } : p)));
    },
    [isTeacher]
  );

  // Host Moderation: Remove participant from room
  const removeParticipant = useCallback(
    async (participantId: string) => {
      if (!isTeacher) return;
      setParticipants(prev => prev.filter(p => p.id !== participantId));
    },
    [isTeacher]
  );

  // Send in-call message
  const sendMessage = useCallback(
    (text: string, authorId: string, authorName: string) => {
      if (!text.trim()) return;
      const msg: CallMessage = {
        id: generateCallMessageId(),
        authorId,
        authorName,
        body: text.trim(),
        createdAt: new Date().toISOString(),
      };

      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));

      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({ type: 'chat', room: roomId, senderId: authorId, message: msg });
        } catch (e) { }
      }
      if (socket) {
        socket.emit('call_chat_message', { room: roomId, senderId: authorId, message: msg });
      }
    },
    [socket, roomId]
  );

  // Leave / end call
  const leaveCall = useCallback(() => {
    if (socket && roomId) {
      socket.emit('call_peer_left', {
        room: roomId,
        userId: currentUserId,
        userName,
        targetId: partnerId,
        to: partnerId,
      });
      socket.emit('call_ended', {
        room: roomId,
        swapId: roomId,
        userId: currentUserId,
        partnerId,
      });
    }
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'peer_left',
          room: roomId,
          userId: currentUserId,
          userName,
        });
      } catch (e) { }
      broadcastChannelRef.current.close();
      broadcastChannelRef.current = null;
    }
    if (webStreamRef.current) {
      webStreamRef.current.getTracks().forEach((track: any) => track.stop());
      webStreamRef.current = null;
    }
    if (webScreenStreamRef.current) {
      webScreenStreamRef.current.getTracks().forEach((track: any) => track.stop());
      webScreenStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    onEndCall();
  }, [socket, roomId, currentUserId, userName, partnerId, onEndCall]);

  return {
    participants,
    setParticipants,
    messages,
    reactions,
    isConnected,
    isConnecting,
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
  };
}
