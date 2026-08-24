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

  // Sync initial participants while preserving active media streams and roles
  useEffect(() => {
    if (!initialParticipants || initialParticipants.length === 0) return;
    setParticipants(prev => {
      const activeStream = webStreamRef.current;
      if (prev.length === 0) {
        return initialParticipants.map(p =>
          p.isLocal && activeStream ? { ...p, mediaStream: activeStream } : p
        );
      }
      return initialParticipants.map(initP => {
        const existing = prev.find(p => p.id === initP.id || (p.isLocal && initP.isLocal));
        if (existing) {
          return {
            ...initP,
            role: initP.role || existing.role,
            mediaStream: initP.isLocal ? (activeStream || existing.mediaStream) : (existing.mediaStream || initP.mediaStream),
            videoTrackId: existing.videoTrackId || initP.videoTrackId,
            status: existing.status === 'connected' ? 'connected' : initP.status,
            isVideoOff: existing.isVideoOff !== undefined ? existing.isVideoOff : initP.isVideoOff,
            isMuted: existing.isMuted !== undefined ? existing.isMuted : initP.isMuted,
          };
        }
        return initP.isLocal && activeStream ? { ...initP, mediaStream: activeStream } : initP;
      });
    });
  }, [initialParticipants]);

  // 1. Web Media (Camera & Mic) and WebRTC Peer Connection
  useEffect(() => {
    if (!roomId) return;
    let isCancelled = false;
    const enableVideo = mode === 'video';
    const activeSocket = socketRef.current;
    let handleSignalMessage: ((msg: any) => void) | undefined;
    let handlePeerJoined: ((data: any) => Promise<void>) | undefined;
    let handlePeerLeft: ((data: any) => void) | undefined;
    let handleReactionMessage: ((data: any) => void) | undefined;
    let handleChatMessage: ((data: any) => void) | undefined;
    let handleCallEnded: ((data?: any) => void) | undefined;

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

      // 1b. Setup RTCPeerConnection for P2P connection
      if (typeof RTCPeerConnection !== 'undefined' && stream) {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = pc;

        // Add local tracks to peer connection
        stream.getTracks().forEach(track => {
          if (stream) pc.addTrack(track, stream);
        });

        // Handle incoming remote track
        pc.ontrack = (event: RTCTrackEvent) => {
          console.log('[use100msCall Web] Received remote stream track:', event.track?.kind, event.streams);
          const remoteStream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
          
          setParticipants(prev => {
            const hasRemote = prev.some(p => !p.isLocal);
            if (!hasRemote) {
              return [
                ...prev,
                {
                  id: String(partnerId || 'remote-peer'),
                  name: 'Partner',
                  avatarUrl: '',
                  role: 'student' as const,
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
            }
            return prev.map(p =>
              !p.isLocal
                ? {
                  ...p,
                  mediaStream: remoteStream,
                  status: 'connected' as const,
                  isVideoOff: false,
                }
                : p
            );
          });
        };

        // Helper to send WebRTC signals across all available communication transports
        const sendSignal = (payload: any) => {
          const signalMsg = {
            ...payload,
            room: roomId,
            senderId: currentUserId,
            targetId: payload.targetId || payload.to || partnerIdRef.current,
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

        // ICE candidate handler
        pc.onicecandidate = event => {
          if (event.candidate) {
            sendSignal({
              type: 'candidate',
              candidate: event.candidate,
              targetId: partnerIdRef.current,
            });
          }
        };

        pc.onconnectionstatechange = () => {
          console.log('[use100msCall Web] Connection State:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            setIsConnected(true);
            setParticipants(prev => prev.map(p => (!p.isLocal ? { ...p, status: 'connected' } : p)));
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            console.log('[use100msCall Web] Disconnected from peer');
          }
        };

        // 1c. Signaling Handlers for both BroadcastChannel and Socket.IO
        handleSignalMessage = async (msg: any) => {
          if (!msg || msg.senderId === currentUserId) return;
          if (msg.targetId && currentUserId && msg.targetId !== currentUserId) return;

          try {
            if (msg.type === 'offer' && pc) {
              console.log('[use100msCall Web] Processing Offer from', msg.senderId);
              await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));

              // Process queued candidates
              while (candidateQueueRef.current.length > 0) {
                const cand = candidateQueueRef.current.shift();
                if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
              }

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              sendSignal({
                type: 'answer',
                answer,
                targetId: msg.senderId,
                to: msg.senderId,
              });
            } else if (msg.type === 'answer' && pc) {
              console.log('[use100msCall Web] Processing Answer from', msg.senderId);
              if (pc.signalingState !== 'stable') {
                await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
                // Process queued candidates
                while (candidateQueueRef.current.length > 0) {
                  const cand = candidateQueueRef.current.shift();
                  if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
                }
              }
            } else if (msg.type === 'candidate' && pc) {
              if (pc.remoteDescription && pc.remoteDescription.type) {
                await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
              } else {
                candidateQueueRef.current.push(msg.candidate);
              }
            } else if (msg.type === 'media_state') {
              setParticipants(prev =>
                prev.map(p =>
                  !p.isLocal
                    ? {
                      ...p,
                      isVideoOff: msg.isVideoOff !== undefined ? msg.isVideoOff : p.isVideoOff,
                      isMuted: msg.isMuted !== undefined ? msg.isMuted : p.isMuted,
                    }
                    : p
                )
              );
            } else if (msg.type === 'screenshare_state') {
              setParticipants(prev =>
                prev.map(p =>
                  !p.isLocal
                    ? {
                      ...p,
                      screenShareStream: msg.isScreenSharing ? p.mediaStream : undefined,
                    }
                    : p
                )
              );
            } else if (msg.type === 'reaction') {
              if (msg.senderId && currentUserId && msg.senderId === currentUserId) {
                // Ignore local echo
              } else {
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
                if (incoming.authorId && incoming.authorId === currentUserId) {
                  // Ignore local echo from BroadcastChannel
                } else {
                  setMessages(prev => (prev.some(m => m.id === incoming.id) ? prev : [...prev, incoming]));
                }
              }
            } else if (msg.type === 'call_ended') {
              onEndCall();
            }
          } catch (signalErr) {
            console.warn('[use100msCall Web] Signal error:', signalErr);
          }
        };

        if (bc) {
          bc.onmessage = (evt: MessageEvent) => {
            const data = evt.data;
            if (data?.type === 'peer_joined') {
              void handlePeerJoined?.(data);
            } else {
              void handleSignalMessage?.(data);
            }
          };
        }

        handlePeerJoined = async (data: any) => {
          console.log('[use100msCall Web] Peer joined event:', data);
          if (data?.userId && String(data.userId) === String(currentUserId)) return;
          const peerName = data?.userName || data?.senderName || 'Partner';

          const sysMsg: CallMessage = {
            id: generateCallMessageId(),
            authorId: data?.userId || 'system',
            authorName: 'System',
            body: `${peerName} joined the call`,
            createdAt: new Date().toISOString(),
            isSystem: true,
          };
          setMessages(prev => (prev.some(m => m.id === sysMsg.id) ? prev : [...prev, sysMsg]));

          setParticipants(prev => {
            const hasRemote = prev.some(p => !p.isLocal);
            if (!hasRemote && data?.userId) {
              const newRemote: CallParticipant = {
                id: String(data.userId),
                name: peerName,
                avatarUrl: data?.avatarUrl || '',
                isLocal: false,
                isMuted: false,
                isVideoOff: false,
                isHandRaised: false,
                isSpeaking: false,
                status: 'connected',
                role: 'guest',
                joinedAt: new Date().toISOString(),
              };
              return [...prev, newRemote];
            }
            return prev.map(p => (!p.isLocal ? { ...p, status: 'connected', name: p.name || peerName } : p));
          });

          if (pc && (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer')) {
            try {
              const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
              await pc.setLocalDescription(offer);
              sendSignal({
                type: 'offer',
                offer,
                targetId: data?.userId || partnerId,
                to: data?.userId || partnerId,
              });
            } catch (err) {
              console.warn('[use100msCall Web] Peer joined offer error:', err);
            }
          }
        };

        handlePeerLeft = (data: any) => {
          console.log('[use100msCall Web] Peer left event:', data);
          if (data?.userId && String(data.userId) === String(currentUserId)) return;
          const peerName = data?.userName || data?.senderName || 'Partner';

          const sysMsg: CallMessage = {
            id: generateCallMessageId(),
            authorId: data?.userId || 'system',
            authorName: 'System',
            body: `${peerName} left the call`,
            createdAt: new Date().toISOString(),
            isSystem: true,
          };
          setMessages(prev => (prev.some(m => m.id === sysMsg.id) ? prev : [...prev, sysMsg]));

          setParticipants(prev =>
            prev.map(p =>
              !p.isLocal ? { ...p, status: 'disconnected', mediaStream: undefined, videoTrackId: undefined } : p
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
          console.log('[use100msCall Web] Remote peer ended/left call:', data);
          handlePeerLeft?.(data || { userName: 'Partner' });
        };

        if (activeSocket) {
          activeSocket.emit('join_call_room', { room: roomId, userId: currentUserId });
          activeSocket.on('call_signal', handleSignalMessage);
          activeSocket.on('signal', handleSignalMessage);
          activeSocket.on('call_peer_joined', handlePeerJoined);
          activeSocket.on('peer_joined', handlePeerJoined);
          activeSocket.on('call_peer_left', handlePeerLeft);
          activeSocket.on('peer_left', handlePeerLeft);
          activeSocket.on('call_reaction', handleReactionMessage);
          activeSocket.on('call_chat_message', handleChatMessage);
          activeSocket.on('call_ended', handleCallEnded);

          // Announce local presence to room and partner
          const peerJoinPayload = {
            type: 'peer_joined',
            room: roomId,
            userId: currentUserId,
            userName: userNameRef.current,
            targetId: partnerIdRef.current,
            to: partnerIdRef.current,
          };
          activeSocket.emit('call_peer_joined', peerJoinPayload);
          if (bc) {
            try { bc.postMessage(peerJoinPayload); } catch (e) { }
          }
        }

        // Caller initiates the offer if we have the lower ID or are caller
        const currentPartnerId = partnerIdRef.current;
        const isCaller = currentUserId && currentPartnerId ? String(currentUserId) < String(currentPartnerId) : true;
        if (isCaller) {
          setTimeout(async () => {
            try {
              if (pc.signalingState === 'stable') {
                const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
                await pc.setLocalDescription(offer);
                sendSignal({
                  type: 'offer',
                  offer,
                  targetId: currentPartnerId,
                  to: currentPartnerId,
                });
              }
            } catch (offerErr) {
              console.warn('[use100msCall Web] Create offer error:', offerErr);
            }
          }, 500);
        }
      }
    }

    void initWebRTC();

    return () => {
      isCancelled = true;
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
        activeSocket.off('call_signal', handleSignalMessage);
        activeSocket.off('signal', handleSignalMessage);
        activeSocket.off('call_peer_joined', handlePeerJoined);
        activeSocket.off('peer_joined', handlePeerJoined);
        activeSocket.off('call_peer_left', handlePeerLeft);
        activeSocket.off('peer_left', handlePeerLeft);
        activeSocket.off('call_reaction', handleReactionMessage);
        activeSocket.off('call_chat_message', handleChatMessage);
        activeSocket.off('call_ended', handleCallEnded);
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
    if (isScreenSharing) {
      if (webScreenStreamRef.current) {
        webScreenStreamRef.current.getTracks().forEach((t: any) => t.stop());
        webScreenStreamRef.current = null;
      }

      // Revert peer connection video track back to camera track
      if (peerConnectionRef.current && webStreamRef.current) {
        const camTrack = webStreamRef.current.getVideoTracks()[0];
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender && camTrack) {
          videoSender.replaceTrack(camTrack).catch(e => console.warn('Revert cam track error:', e));
        }
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

          // Replace peer connection track with screenshare track
          if (peerConnectionRef.current && screenTrack) {
            const senders = peerConnectionRef.current.getSenders();
            const videoSender = senders.find(s => s.track?.kind === 'video');
            if (videoSender) {
              videoSender.replaceTrack(screenTrack).catch(e => console.warn('Replace screenshare track error:', e));
            }
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
            if (peerConnectionRef.current && webStreamRef.current) {
              const camTrack = webStreamRef.current.getVideoTracks()[0];
              const senders = peerConnectionRef.current.getSenders();
              const videoSender = senders.find(s => s.track?.kind === 'video');
              if (videoSender && camTrack) {
                videoSender.replaceTrack(camTrack).catch(e => console.warn('Revert cam track error:', e));
              }
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
  }, [isScreenSharing, roomId, currentUserId, socket]);

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
