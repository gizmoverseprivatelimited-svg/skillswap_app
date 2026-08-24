import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
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

  const hmsInstanceRef = useRef<any>(null);
  const webStreamRef = useRef<MediaStream | null>(null);
  const webScreenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const candidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const broadcastChannelRef = useRef<any>(null);

  // Sync initial participants when updated
  useEffect(() => {
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
    if (Platform.OS !== 'web' || !roomId) return;
    let isCancelled = false;
    const enableVideo = mode === 'video';

    // Broadcast channel for instantaneous cross-tab/cross-window signaling
    const channelName = `skillswap_call_${roomId || 'general'}`;
    let bc: any = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(channelName);
        broadcastChannelRef.current = bc;
      } catch (e) {
        console.warn('[BroadcastChannel] init notice:', e);
      }
    }

    async function startWebMedia() {
      try {
        let stream: MediaStream | null = null;
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: enableVideo
                ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user',
                  }
                : false,
              audio: true,
            });
          } catch (camErr) {
            console.warn('[use100msCall] Standard video/audio failed, attempting fallback:', camErr);
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: enableVideo,
                audio: false,
              });
            } catch (fallbackErr) {
              console.warn('[use100msCall] Media fallback error:', fallbackErr);
            }
          }
        }

        if (isCancelled) {
          stream?.getTracks().forEach(t => t.stop());
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
        setIsConnecting(false);
        setIsConnected(true);

        setParticipants(prev =>
          prev.map(p => {
            if (p.isLocal) {
              return {
                ...p,
                status: 'connected' as const,
                mediaStream: stream || undefined,
                isVideoOff: initialVideoOn === false || !enableVideo || !stream,
                isMuted: initialMicOn === false,
              };
            }
            return {
              ...p,
              status: 'connected' as const,
            };
          })
        );

        // Setup WebRTC peer-to-peer connection
        if (typeof RTCPeerConnection !== 'undefined') {
          const pc = new RTCPeerConnection(ICE_SERVERS);
          peerConnectionRef.current = pc;
          candidateQueueRef.current = [];

          // Add local media tracks to peer connection
          if (stream) {
            stream.getTracks().forEach(track => {
              pc.addTrack(track, stream!);
            });
          }

          // Handle incoming remote tracks (camera video, screen share, and audio)
          pc.ontrack = (event) => {
            console.log('[WebRTC] Received remote track:', event.track?.kind, event.streams);
            const remoteStream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);

            setParticipants(prev =>
              prev.map(p =>
                !p.isLocal
                  ? {
                      ...p,
                      mediaStream: remoteStream,
                      status: 'connected' as const,
                      isVideoOff: false,
                    }
                  : p
              )
            );
          };

          // Helper to send WebRTC signals across all available communication transports
          const sendSignal = (payload: any) => {
            const signalMsg = {
              ...payload,
              room: roomId,
              senderId: currentUserId,
              targetId: partnerId,
              timestamp: Date.now(),
            };

            // 1. BroadcastChannel (fast local/cross-tab sync)
            if (bc) {
              try {
                bc.postMessage(signalMsg);
              } catch (e) {}
            }

            // 2. Socket.IO signaling
            if (socket) {
              try {
                socket.emit('call_signal', signalMsg);
                socket.emit('signal', signalMsg);
                if (partnerId) {
                  socket.emit('call_signal', { ...signalMsg, to: partnerId });
                }
              } catch (e) {}
            }
          };

          // Handle ICE candidates
          pc.onicecandidate = (event) => {
            if (event.candidate) {
              sendSignal({
                type: 'candidate',
                candidate: event.candidate.toJSON(),
              });
            }
          };

          // Process queued ICE candidates after remote description is set
          const drainCandidateQueue = async () => {
            while (candidateQueueRef.current.length > 0) {
              const cand = candidateQueueRef.current.shift();
              if (cand) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {
                  console.warn('[WebRTC] Add queued candidate error:', e);
                }
              }
            }
          };

          // Signal handler
          const handleSignalMessage = async (signalData: any) => {
            if (!signalData || signalData.senderId === currentUserId) return;
            if (signalData.room && roomId && String(signalData.room) !== String(roomId)) return;

            try {
              if (signalData.type === 'offer') {
                console.log('[WebRTC] Handling offer from peer:', signalData.senderId);
                await pc.setRemoteDescription(new RTCSessionDescription(signalData.offer));
                await drainCandidateQueue();

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendSignal({
                  type: 'answer',
                  answer,
                  targetId: signalData.senderId,
                });
              } else if (signalData.type === 'answer') {
                console.log('[WebRTC] Handling answer from peer:', signalData.senderId);
                if (pc.signalingState === 'have-local-offer') {
                  await pc.setRemoteDescription(new RTCSessionDescription(signalData.answer));
                  await drainCandidateQueue();
                }
              } else if (signalData.type === 'candidate' && signalData.candidate) {
                if (pc.remoteDescription && pc.remoteDescription.type) {
                  await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
                } else {
                  candidateQueueRef.current.push(signalData.candidate);
                }
              } else if (signalData.type === 'media_state') {
                const sId = signalData.senderId;
                setParticipants(prev =>
                  prev.map(p =>
                    p.id === sId || (!p.isLocal && !prev.some(x => x.id === sId))
                      ? {
                          ...p,
                          isVideoOff: signalData.isVideoOff !== undefined ? signalData.isVideoOff : p.isVideoOff,
                          isMuted: signalData.isMuted !== undefined ? signalData.isMuted : p.isMuted,
                        }
                      : p
                  )
                );
              } else if (signalData.type === 'hand_state') {
                const sId = signalData.senderId;
                setParticipants(prev =>
                  prev.map(p =>
                    p.id === sId
                      ? {
                          ...p,
                          isHandRaised: Boolean(signalData.isHandRaised),
                        }
                      : p
                  )
                );
              } else if (signalData.type === 'screenshare_state') {
                const isPartnerScreenSharing = Boolean(signalData.isScreenSharing);
                const sId = signalData.senderId;
                console.log('[WebRTC] Peer screenshare state changed:', sId, isPartnerScreenSharing);
                setParticipants(prev =>
                  prev.map(p =>
                    p.id === sId || (!p.isLocal && !prev.some(x => x.id === sId))
                      ? {
                          ...p,
                          screenShareStream: isPartnerScreenSharing ? (p.mediaStream || p.screenShareStream) : undefined,
                        }
                      : p
                  )
                );
              } else if (signalData.type === 'peer_joined') {
                console.log('[WebRTC] Peer announced arrival, creating offer...');
                try {
                  const offer = await pc.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true,
                  });
                  await pc.setLocalDescription(offer);
                  sendSignal({
                    type: 'offer',
                    offer,
                    targetId: signalData.senderId,
                  });
                } catch (err) {
                  console.warn('[WebRTC CreateOffer Error]', err);
                }
              }
            } catch (sigErr) {
              console.warn('[WebRTC Signaling processing error]', sigErr);
            }
          };

          // Peer presence handler (When real users join/announce)
          const handlePeerPresence = (peerData: any) => {
            if (!peerData) return;
            const pId = String(peerData.userId || peerData.senderId || '');
            if (!pId || pId === currentUserId) return;
            if (peerData.room && roomId && String(peerData.room) !== String(roomId)) return;

            console.log('[use100msCall] Real-time peer present:', pId, peerData.userName);

            setParticipants(prev => {
              const existing = prev.find(p => p.id === pId);
              if (existing) {
                return prev.map(p =>
                  p.id === pId
                    ? {
                        ...p,
                        name: peerData.userName || p.name,
                        avatarUrl: peerData.userAvatar || p.avatarUrl,
                        status: 'connected' as const,
                        isMuted: peerData.isMicOn !== undefined ? !peerData.isMicOn : p.isMuted,
                        isVideoOff: peerData.isVideoOn !== undefined ? !peerData.isVideoOn : p.isVideoOff,
                      }
                    : p
                );
              }
              // Add real remote participant
              return [
                ...prev,
                {
                  id: pId,
                  name: peerData.userName || 'Participant',
                  avatarUrl: peerData.userAvatar || '',
                  role: peerData.role || (peerData.isTeacher ? 'teacher' : 'student'),
                  isLocal: false,
                  isMuted: peerData.isMicOn !== undefined ? !peerData.isMicOn : false,
                  isVideoOff: peerData.isVideoOn !== undefined ? !peerData.isVideoOn : false,
                  isHandRaised: false,
                  isSpeaking: false,
                  status: 'connected' as const,
                  joinedAt: new Date().toISOString(),
                  networkQuality: 5,
                },
              ];
            });

            // If it was peer_joined, reply with our presence
            if (peerData.type === 'call_peer_joined' && socket) {
              socket.emit('call_peer_present', {
                room: roomId,
                to: pId,
                userId: currentUserId,
                senderId: currentUserId,
                userName,
                userAvatar: initialParticipants.find(p => p.isLocal)?.avatarUrl || '',
                role: isTeacher ? 'teacher' : 'student',
                isTeacher,
                isMicOn: initialMicOn !== false,
                isVideoOn: initialVideoOn !== false,
              });
            }
          };

          const handlePeerLeftEvent = (data: any) => {
            const pId = String(data?.userId || data?.senderId || '');
            if (!pId || pId === currentUserId) return;
            console.log('[use100msCall] Real-time peer left room:', pId);
            setParticipants(prev => prev.filter(p => p.id !== pId));
          };

          const handleChatMessageEvent = (data: any) => {
            if (!data?.message) return;
            const msg: CallMessage = data.message;
            if (msg.authorId === currentUserId) return;
            setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
          };

          const handleReactionEvent = (data: any) => {
            if (!data?.reaction) return;
            const reaction: CallReaction = data.reaction;
            setReactions(prev => (prev.some(r => r.id === reaction.id) ? prev : [...prev.slice(-15), reaction]));
          };

          // Attach BroadcastChannel listener
          if (bc) {
            bc.onmessage = (ev: MessageEvent) => {
              void handleSignalMessage(ev.data);
            };
          }

          // Socket signaling listeners & room subscriptions
          if (socket) {
            socket.emit('join_room', `call_${roomId}`);
            socket.emit('join_room', roomId);
            socket.emit('join_call_room', { room: roomId, userId: currentUserId });
            if (currentUserId) socket.emit('join_room', currentUserId);
            if (partnerId) socket.emit('join_room', partnerId);

            socket.on('call_signal', handleSignalMessage);
            socket.on('signal', handleSignalMessage);
            socket.on('call_peer_joined', handlePeerPresence);
            socket.on('call_peer_present', handlePeerPresence);
            socket.on('call_peer_left', handlePeerLeftEvent);
            socket.on('call_chat_message', handleChatMessageEvent);
            socket.on('call_reaction', handleReactionEvent);

            // Announce presence to room
            socket.emit('call_peer_joined', {
              type: 'call_peer_joined',
              room: roomId,
              userId: currentUserId,
              senderId: currentUserId,
              userName,
              userAvatar: initialParticipants.find(p => p.isLocal)?.avatarUrl || '',
              role: isTeacher ? 'teacher' : 'student',
              isTeacher,
              isMicOn: initialMicOn !== false,
              isVideoOn: initialVideoOn !== false,
            });
          }

          // Announce local arrival and create initial offer
          sendSignal({ type: 'peer_joined', userName });

          setTimeout(async () => {
            if (pc.signalingState === 'stable') {
              try {
                const offer = await pc.createOffer({
                  offerToReceiveAudio: true,
                  offerToReceiveVideo: true,
                });
                await pc.setLocalDescription(offer);
                sendSignal({ type: 'offer', offer });
              } catch (e) {
                console.warn('[WebRTC Initial Offer Error]', e);
              }
            }
          }, 300);

          // Return teardown
          return () => {
            if (bc) {
              bc.close();
            }
            if (socket) {
              socket.emit('call_peer_left', {
                room: roomId,
                userId: currentUserId,
                senderId: currentUserId,
                userName,
              });
              socket.off('call_signal', handleSignalMessage);
              socket.off('signal', handleSignalMessage);
              socket.off('call_peer_joined', handlePeerPresence);
              socket.off('call_peer_present', handlePeerPresence);
              socket.off('call_peer_left', handlePeerLeftEvent);
              socket.off('call_chat_message', handleChatMessageEvent);
              socket.off('call_reaction', handleReactionEvent);
            }
            if (peerConnectionRef.current) {
              peerConnectionRef.current.close();
              peerConnectionRef.current = null;
            }
          };
        }
      } catch (err) {
        console.warn('[use100msCall Web] Initialisation error:', err);
        setIsConnecting(false);
        setIsConnected(true);
        setParticipants(prev => prev.map(p => (p.isLocal ? { ...p, status: 'connected' as const } : p)));
      }
    }

    void startWebMedia();

    return () => {
      isCancelled = true;
      if (webStreamRef.current) {
        webStreamRef.current.getTracks().forEach((t: any) => t.stop());
        webStreamRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    };
  }, [mode, roomId, currentUserId, partnerId, socket, userName]);

  // 2. Native 100ms SDK initialization (Android / iOS)
  useEffect(() => {
    if (Platform.OS === 'web' || !roomCode) return;
    let isMounted = true;

    async function initNative100ms() {
      try {
        const { HMSSDK, HMSConfig, HMSUpdateListenerActions } = await import('@100mslive/react-native-hms');

        const hms = await HMSSDK.build();
        hmsInstanceRef.current = hms;

        try {
          const devices = await hms.getAudioDevicesList();
          if (devices && Array.isArray(devices)) {
            setAvailableAudioDevices(devices);
          }
        } catch (e) {
          console.log('Audio devices notice:', e);
        }

        hms.addEventListener(HMSUpdateListenerActions.ON_JOIN, (data: any) => {
          if (!isMounted) return;
          console.log('[100ms] Joined room:', data);
          setIsConnecting(false);
          setIsConnected(true);

          if (data?.localPeer?.videoTrack?.trackId) {
            const videoTrackId = data.localPeer.videoTrack.trackId;
            setParticipants(prev =>
              prev.map(p =>
                p.isLocal
                  ? {
                      ...p,
                      videoTrackId,
                      status: 'connected',
                      isVideoOff: data.localPeer.videoTrack.isMute() ?? false,
                    }
                  : p
              )
            );
          }

          if (data?.remotePeers && Array.isArray(data.remotePeers) && data.remotePeers.length > 0) {
            for (const remotePeer of data.remotePeers) {
              setParticipants(prev => {
                const existingIndex = prev.findIndex(
                  p => !p.isLocal && (p.id === remotePeer.peerID || p.role === remotePeer.role?.name)
                );
                if (existingIndex !== -1) {
                  return prev.map((p, idx) =>
                    idx === existingIndex
                      ? {
                          ...p,
                          id: remotePeer.peerID,
                          videoTrackId: remotePeer.videoTrack?.trackId,
                          isVideoOff: remotePeer.videoTrack?.isMute() ?? false,
                          isMuted: remotePeer.audioTrack?.isMute() ?? false,
                          status: 'connected',
                        }
                      : p
                  );
                }
                return [
                  ...prev,
                  {
                    id: remotePeer.peerID,
                    name: remotePeer.name || 'Participant',
                    avatarUrl: '',
                    role:
                      remotePeer.role?.name?.includes('teacher') || remotePeer.role?.name?.includes('host')
                        ? 'teacher'
                        : 'student',
                    isLocal: false,
                    isMuted: remotePeer.audioTrack?.isMute() ?? true,
                    isVideoOff: remotePeer.videoTrack?.isMute() ?? false,
                    isHandRaised: false,
                    isSpeaking: false,
                    status: 'connected',
                    joinedAt: new Date().toISOString(),
                    videoTrackId: remotePeer.videoTrack?.trackId,
                  },
                ];
              });
            }
          }
        });

        hms.addEventListener(HMSUpdateListenerActions.ON_PEER_UPDATE, (data: any) => {
          if (!isMounted) return;
          const { peer, type } = data;
          if (!peer) return;

          if (type === 'PEER_JOINED' && !peer.isLocal) {
            setParticipants(prev => {
              const existingIndex = prev.findIndex(
                p => !p.isLocal && (p.id === peer.peerID || p.status === 'connecting' || !p.videoTrackId)
              );
              if (existingIndex !== -1) {
                return prev.map((p, idx) =>
                  idx === existingIndex
                    ? {
                        ...p,
                        id: peer.peerID,
                        name: peer.name || p.name || 'Partner',
                        status: 'connected' as const,
                        videoTrackId: peer.videoTrack?.trackId || p.videoTrackId,
                        isVideoOff: peer.videoTrack?.isMute() ?? false,
                        isMuted: peer.audioTrack?.isMute() ?? false,
                      }
                    : p
                );
              }
              return [
                ...prev,
                {
                  id: peer.peerID,
                  name: peer.name || 'Participant',
                  avatarUrl: '',
                  role:
                    peer.role?.name?.includes('teacher') || peer.role?.name?.includes('host')
                      ? 'teacher'
                      : 'student',
                  isLocal: false,
                  isMuted: peer.audioTrack?.isMute() ?? true,
                  isVideoOff: peer.videoTrack?.isMute() ?? false,
                  isHandRaised: false,
                  isSpeaking: false,
                  status: 'connected' as const,
                  joinedAt: new Date().toISOString(),
                  videoTrackId: peer.videoTrack?.trackId,
                },
              ];
            });
          } else if (type === 'PEER_LEFT' && !peer.isLocal) {
            setParticipants(prev => prev.filter(p => p.id !== peer.peerID));
          }
        });

        hms.addEventListener(HMSUpdateListenerActions.ON_TRACK_UPDATE, (data: any) => {
          if (!isMounted) return;
          const { peer, track, type } = data;
          if (!peer || !track) return;

          setParticipants(prev => {
            let updatedAny = false;
            return prev.map(p => {
              const isTarget = p.isLocal
                ? peer.isLocal
                : p.id === peer.peerID || (!peer.isLocal && (!p.videoTrackId || !updatedAny));
              if (!isTarget) return p;
              updatedAny = true;

              if (track.type === 'VIDEO') {
                const isVideoMuted = track.isMute() || type === 'TRACK_MUTED' || type === 'TRACK_REMOVED';
                return {
                  ...p,
                  id: peer.isLocal ? p.id : peer.peerID,
                  name: !peer.isLocal && peer.name ? peer.name : p.name,
                  videoTrackId: type === 'TRACK_REMOVED' ? undefined : track.trackId,
                  isVideoOff: isVideoMuted,
                  status: 'connected' as const,
                };
              }
              if (track.type === 'AUDIO') {
                const isAudioMuted = track.isMute() || type === 'TRACK_MUTED' || type === 'TRACK_REMOVED';
                return {
                  ...p,
                  id: peer.isLocal ? p.id : peer.peerID,
                  isMuted: isAudioMuted,
                };
              }
              return p;
            });
          });
        });

        hms.addEventListener(HMSUpdateListenerActions.ON_MESSAGE, (data: any) => {
          if (!isMounted || !data) return;
          const rawMsg = data.message || '';

          const incoming: CallMessage = {
            id: data.id || generateCallMessageId(),
            authorId: data.sender?.peerID || 'peer',
            authorName: data.sender?.name || 'Participant',
            body: rawMsg,
            createdAt: new Date().toISOString(),
          };
          setMessages(prev => (prev.some(m => m.id === incoming.id) ? prev : [...prev, incoming]));
        });

        hms.addEventListener(HMSUpdateListenerActions.ON_SPEAKER, (data: any) => {
          if (!isMounted || !data?.speakers) return;
          const speakingIds = new Set(data.speakers.map((s: any) => s.peerID));
          setParticipants(prev =>
            prev.map(p => ({
              ...p,
              isSpeaking: speakingIds.has(p.id),
            }))
          );
        });

        hms.addEventListener(HMSUpdateListenerActions.ON_REMOVED_FROM_ROOM, () => {
          onEndCall();
        });

        const config = new HMSConfig({
          username: userName || (isTeacher ? 'Teacher' : 'Participant'),
          authToken: authToken || roomCode || '',
        });

        await hms.join(config);
      } catch (err) {
        console.warn('[use100msCall Native] Join exception:', err);
        setIsConnecting(false);
        setIsConnected(true);
      }
    }

    void initNative100ms();

    return () => {
      isMounted = false;
      if (hmsInstanceRef.current) {
        hmsInstanceRef.current.leave().catch(() => {});
        hmsInstanceRef.current.destroy().catch(() => {});
        hmsInstanceRef.current = null;
      }
    };
  }, [roomCode, authToken, userName, isTeacher]);

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

      if (hmsInstanceRef.current?.localPeer?.localAudioTrack()) {
        hmsInstanceRef.current.localPeer.localAudioTrack().setMute(nextMuted);
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
        } catch (e) {}
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

      if (hmsInstanceRef.current?.localPeer?.localVideoTrack()) {
        hmsInstanceRef.current.localPeer.localVideoTrack().setMute(nextVideoOff);
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
        } catch (e) {}
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
    if (hmsInstanceRef.current?.localPeer?.localVideoTrack()) {
      try {
        await hmsInstanceRef.current.localPeer.localVideoTrack().switchCamera();
      } catch (err) {
        console.warn('[100ms] switchCamera error:', err);
      }
    }
  }, []);

  // Screen Sharing (Start / Stop)
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      if (Platform.OS === 'web') {
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
          } catch (e) {}
        }
        if (socket) {
          socket.emit('call_signal', screenShareMsg);
          socket.emit('signal', screenShareMsg);
        }

        setParticipants(prev => prev.map(p => (p.isLocal ? { ...p, screenShareStream: undefined } : p)));
      } else if (hmsInstanceRef.current) {
        try {
          await hmsInstanceRef.current.stopScreenshare();
        } catch (e) {
          console.warn('[100ms] stopScreenshare error:', e);
        }
      }
      setIsScreenSharing(false);
    } else {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia) {
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
            } catch (e) {}
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
              } catch (e) {}
            }
            if (socket) {
              socket.emit('call_signal', endedMsg);
              socket.emit('signal', endedMsg);
            }
            setParticipants(prev => prev.map(p => (p.isLocal ? { ...p, screenShareStream: undefined } : p)));
          };

          setParticipants(prev => prev.map(p => (p.isLocal ? { ...p, screenShareStream: screenStream } : p)));
        } catch (err) {
          console.warn('[use100msCall] DisplayMedia error:', err);
        }
      } else if (hmsInstanceRef.current) {
        try {
          await hmsInstanceRef.current.startScreenshare();
          setIsScreenSharing(true);
        } catch (err) {
          console.warn('[100ms] startScreenshare error:', err);
        }
      }
    }
  }, [isScreenSharing, roomId, currentUserId, socket]);

  // Audio Device Routing
  const switchAudioOutput = useCallback(async (device: AudioDevice) => {
    setSelectedAudioDevice(device);
    if (hmsInstanceRef.current) {
      try {
        await hmsInstanceRef.current.switchAudioOutput(device);
      } catch (err) {
        console.warn('[100ms] switchAudioOutput error:', err);
      }
    }
  }, []);

  // Hand raise / lower
  const toggleHand = useCallback(() => {
    setParticipants(prev => {
      const local = prev.find(p => p.isLocal);
      const nextRaised = !(local?.isHandRaised ?? false);

      if (hmsInstanceRef.current) {
        hmsInstanceRef.current.changeMetadata(JSON.stringify({ isHandRaised: nextRaised })).catch(() => {});
      }

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
      setReactions(prev => (prev.some(r => r.id === reaction.id) ? prev : [...prev.slice(-15), reaction]));

      if (hmsInstanceRef.current) {
        const payload = JSON.stringify({ type: 'reaction', emoji });
        hmsInstanceRef.current.sendBroadcastMessage(payload).catch(() => {});
      }
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({ type: 'reaction', room: roomId, senderId: currentUserId, reaction });
        } catch (e) {}
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
      if (hmsInstanceRef.current) {
        try {
          const peers = await hmsInstanceRef.current.getRemotePeers();
          const targetPeer = peers.find((p: any) => p.peerID === participantId);
          if (targetPeer) {
            await hmsInstanceRef.current.removePeer(targetPeer, 'Removed by teacher');
          }
        } catch (e) {
          console.warn('[100ms] removePeer error:', e);
        }
      }
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

      if (hmsInstanceRef.current) {
        hmsInstanceRef.current.sendBroadcastMessage(text.trim()).catch((err: any) => {
          console.warn('[100ms] sendBroadcastMessage error:', err);
        });
      }
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({ type: 'chat', room: roomId, senderId: authorId, message: msg });
        } catch (e) {}
      }
      if (socket) {
        socket.emit('call_chat_message', { room: roomId, senderId: authorId, message: msg });
      }
    },
    [socket, roomId]
  );

  // Leave / end call
  const leaveCall = useCallback(() => {
    if (webStreamRef.current) {
      webStreamRef.current.getTracks().forEach((track: any) => track.stop());
      webStreamRef.current = null;
    }
    if (webScreenStreamRef.current) {
      webScreenStreamRef.current.getTracks().forEach((track: any) => track.stop());
      webScreenStreamRef.current = null;
    }
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.close();
      broadcastChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (socket) {
      socket.emit('call_peer_left', {
        room: roomId,
        userId: currentUserId,
        senderId: currentUserId,
        userName,
      });
    }
    if (hmsInstanceRef.current) {
      hmsInstanceRef.current.leave().catch(() => {});
    }
    onEndCall();
  }, [onEndCall, socket, roomId, currentUserId, userName]);

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
