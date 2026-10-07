import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Alert, PermissionsAndroid, type Permission } from 'react-native';
import {
  requestCameraAndMicrophonePermissions,
  checkCameraAndMicrophonePermissions,
} from '../lib/media-permissions';
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
  const [sdkId, setSdkId] = useState<string>('12345');
  const [isRecording, setIsRecording] = useState(false);

  const hmsInstanceRef = useRef<any>(null);
  const webStreamRef = useRef<MediaStream | null>(null);
  const webScreenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const candidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const broadcastChannelRef = useRef<any>(null);
  const facingModeRef = useRef<'user' | 'environment'>('user');

  // Sync initial participants when updated
  useEffect(() => {
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
          initP => String(initP.id) === String(existing.id) || (initP.isLocal && existing.isLocal) || (!existing.isLocal && !initP.isLocal && (existing.role === 'teacher' || existing.role === 'host') && (initP.role === 'teacher' || initP.role === 'host'))
        );
        if (!matchingInit) return existing;
        return {
          ...existing,
          name: existing.name || matchingInit.name,
          role: existing.role || matchingInit.role,
          avatarUrl: existing.avatarUrl || matchingInit.avatarUrl,
          mediaStream: existing.isLocal ? (activeStream || existing.mediaStream) : existing.mediaStream,
          videoTrackId: existing.videoTrackId || matchingInit.videoTrackId,
          status: existing.status === 'connected' ? 'connected' : matchingInit.status,
          isVideoOff: (existing.mediaStream || existing.videoTrackId) ? existing.isVideoOff : matchingInit.isVideoOff,
          isMuted: existing.isMuted !== undefined ? existing.isMuted : matchingInit.isMuted,
        };
      });

      // 2. Add any new initial participants not already in prev
      const newInitials = initialParticipants.filter(
        initP => !prev.some(p => String(p.id) === String(initP.id) || (p.isLocal && initP.isLocal) || (!p.isLocal && !initP.isLocal && (p.role === 'teacher' || p.role === 'host') && (initP.role === 'teacher' || initP.role === 'host')))
      );

      return [...updatedExisting, ...newInitials];
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
            const isVideoTrack = event.track?.kind === 'video';

            setParticipants(prev =>
              prev.map(p => {
                if (p.isLocal) return p;

                const existingTracks = p.mediaStream ? (p.mediaStream as MediaStream).getTracks() : [];
                const combinedTracks = [...existingTracks, event.track].filter((t, idx, arr) => arr.findIndex(x => x.id === t.id) === idx);
                const updatedStream = new MediaStream(combinedTracks);

                return {
                  ...p,
                  mediaStream: updatedStream,
                  status: 'connected' as const,
                  isVideoOff: isVideoTrack ? false : p.isVideoOff,
                };
              })
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
              } catch (e) { }
            }

            // 2. Socket.IO signaling
            if (socket) {
              try {
                socket.emit('call_signal', signalMsg);
                socket.emit('signal', signalMsg);
                if (partnerId) {
                  socket.emit('call_signal', { ...signalMsg, to: partnerId });
                }
              } catch (e) { }
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
        setIsConnecting(true);

        // Verify camera and microphone permissions are active
        const curPerm = await checkCameraAndMicrophonePermissions();
        let permResult = curPerm;
        if (!curPerm.granted) {
          permResult = await requestCameraAndMicrophonePermissions({ showAlertOnDenial: false });
        }
        console.log("===== LETESKI MEDIA PERMISSIONS =====");
        console.log("Camera:", JSON.stringify(curPerm.camera, null, 2));
        console.log("Microphone:", JSON.stringify(curPerm.microphone, null, 2));
        console.log("Granted:", JSON.stringify(curPerm.granted, null, 2));
        console.log("=====================================");

        const {
          HMSSDK,
          HMSConfig,
          HMSUpdateListenerActions,
          HMSTrackSource,
          HMSTrackSettings,
          HMSVideoTrackSettings,
          HMSAudioTrackSettings,
          HMSTrackSettingsInitState,
        } = await import('@100mslive/react-native-hms');

        // Configure initial hardware media track states based on user preview choices
        let trackSettings: any;
        try {
          trackSettings = new HMSTrackSettings({
            video: new HMSVideoTrackSettings({
              initialState:
                initialVideoOn && mode === 'video'
                  ? HMSTrackSettingsInitState.UNMUTED
                  : HMSTrackSettingsInitState.MUTED,
            }),
            audio: new HMSAudioTrackSettings({
              initialState:
                initialMicOn
                  ? HMSTrackSettingsInitState.UNMUTED
                  : HMSTrackSettingsInitState.MUTED,
            }),
          });
        } catch (tsErr) {
          console.warn('[100ms] trackSettings config notice:', tsErr);
        }

        console.log('[100ms] Building HMSSDK instance with trackSettings...');
        const buildOptions: any = {
          haltPreviewJoinForPermissionsRequestOnAndroid: true,
        };
        if (trackSettings) {
          buildOptions.trackSettings = trackSettings;
        }

        const hms = await HMSSDK.build(buildOptions);

        if (Platform.OS === 'android') {
          hms.addEventListener(
            HMSUpdateListenerActions.ON_PERMISSIONS_REQUESTED,
            async (data: { permissions: Array<string> }) => {
              try {
                if (data.permissions && data.permissions.length > 0) {
                  await PermissionsAndroid.requestMultiple(data.permissions as Permission[]);
                }
                await hms.setPermissionsAcceptedOnAndroid();
              } catch (e) {
                console.warn('[100ms] Error requesting Android permissions:', e);
                await hms.setPermissionsAcceptedOnAndroid();
              }
            }
          );
        }
        hmsInstanceRef.current = hms;
        if (hms?.id) {
          setSdkId(hms.id);
        }
        console.log('[100ms] HMSSDK built successfully, id:', hms?.id);

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
          console.log('[100ms] Joined room successfully:', data);
          setIsConnecting(false);
          setIsConnected(true);

          const room = data?.room;
          const localPeer = room?.localPeer || data?.localPeer || (hms as any).localPeer;
          const localVideoTrack =
            localPeer?.videoTrack ||
            (localPeer?.localVideoTrack && typeof localPeer.localVideoTrack === 'function'
              ? localPeer.localVideoTrack()
              : null) ||
            (hms as any).localPeer?.videoTrack ||
            (hms as any).localPeer?.localVideoTrack?.();

          const localAudioTrack =
            localPeer?.audioTrack ||
            (localPeer?.localAudioTrack && typeof localPeer.localAudioTrack === 'function'
              ? localPeer.localAudioTrack()
              : null) ||
            (hms as any).localPeer?.audioTrack ||
            (hms as any).localPeer?.localAudioTrack?.();

          console.log("===== LETESKI LOCAL PEER DIAGNOSTICS =====");
          console.log("Local peer:", localPeer?.name, localPeer?.peerID);
          console.log("Local audio track:", localAudioTrack ? "Found" : "None");
          console.log("Local video track:", localVideoTrack ? "Found" : "None");
          console.log("Video track ID:", localVideoTrack?.trackId);
          console.log("==========================================");

          const localVideoTrackId = localVideoTrack?.trackId;
          const isVideoMuted = !initialVideoOn || mode !== 'video';
          const isAudioMuted = !initialMicOn;

          // Explicitly set unmuted on local tracks if enabled
          try {
            if (localAudioTrack && typeof localAudioTrack.setMute === 'function') {
              localAudioTrack.setMute(initialMicOn === false);
            }
            if (localVideoTrack && typeof localVideoTrack.setMute === 'function') {
              localVideoTrack.setMute(initialVideoOn === false || mode !== 'video');
            }
          } catch (muteErr) {
            console.warn('[100ms] ON_JOIN setMute notice:', muteErr);
          }

          setParticipants(prev =>
            prev.map(p =>
              p.isLocal
                ? {
                  ...p,
                  videoTrackId: localVideoTrackId || p.videoTrackId,
                  status: 'connected' as const,
                  isVideoOff: isVideoMuted,
                  isMuted: isAudioMuted,
                }
                : p
            )
          );

          // In 100ms React Native SDK, room.peers contains all peers
          const allPeers: any[] = room?.peers || [];
          const remotePeers: any[] = allPeers.length > 0
            ? allPeers.filter((p: any) => !p.isLocal)
            : (room?.remotePeers || data?.remotePeers || []);

          if (remotePeers && Array.isArray(remotePeers) && remotePeers.length > 0) {
            for (const remotePeer of remotePeers) {
              const rVideoTrack =
                remotePeer.videoTrack ||
                (typeof remotePeer.remoteVideoTrack === 'function' ? remotePeer.remoteVideoTrack() : null);
              const rAudioTrack =
                remotePeer.audioTrack ||
                (typeof remotePeer.remoteAudioTrack === 'function' ? remotePeer.remoteAudioTrack() : null);
              const rAuxiliaryTracks: any[] = remotePeer.auxiliaryTracks || [];
              const screenTrack = rAuxiliaryTracks.find((t: any) =>
                t.type === 'VIDEO' &&
                (String(t.source || '').toLowerCase() === 'screen' || (HMSTrackSource && t.source === HMSTrackSource.SCREEN) || Boolean(t.trackId))
              );

              const rVideoTrackId = rVideoTrack?.trackId;
              const rScreenTrackId = screenTrack?.trackId;
              const rIsVideoMuted = typeof rVideoTrack?.isMute === 'function'
                ? Boolean(rVideoTrack.isMute())
                : Boolean(rVideoTrack?.mute ?? rVideoTrack?.isMute ?? false);
              const rIsAudioMuted = typeof rAudioTrack?.isMute === 'function'
                ? Boolean(rAudioTrack.isMute())
                : Boolean(rAudioTrack?.mute ?? rAudioTrack?.isMute ?? false);

              setParticipants(prev => {
                const existingIndex = prev.findIndex(
                  p => !p.isLocal && (
                    p.id === remotePeer.peerID ||
                    (p.role === 'teacher' && (remotePeer.role?.name?.includes('teacher') || remotePeer.role?.name?.includes('host'))) ||
                    (p.name && remotePeer.name && p.name.trim().toLowerCase() === remotePeer.name.trim().toLowerCase()) ||
                    prev.filter(x => !x.isLocal).length === 1
                  )
                );
                if (existingIndex !== -1) {
                  return prev.map((p, idx) =>
                    idx === existingIndex
                      ? {
                        ...p,
                        id: remotePeer.peerID,
                        name: remotePeer.name || p.name,
                        videoTrackId: rVideoTrackId || p.videoTrackId,
                        screenShareTrackId: rScreenTrackId || p.screenShareTrackId,
                        isVideoOff: rVideoTrackId ? rIsVideoMuted : p.isVideoOff,
                        isMuted: rIsAudioMuted,
                        status: 'connected' as const,
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
                    isMuted: rIsAudioMuted,
                    isVideoOff: rIsVideoMuted,
                    isHandRaised: false,
                    isSpeaking: false,
                    status: 'connected' as const,
                    joinedAt: new Date().toISOString(),
                    videoTrackId: rVideoTrackId,
                    screenShareTrackId: rScreenTrackId,
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
            const rVideoTrack =
              peer.videoTrack || (typeof peer.remoteVideoTrack === 'function' ? peer.remoteVideoTrack() : null);
            const rAudioTrack =
              peer.audioTrack || (typeof peer.remoteAudioTrack === 'function' ? peer.remoteAudioTrack() : null);
            const rAuxiliaryTracks: any[] = peer.auxiliaryTracks || [];
            const screenTrack = rAuxiliaryTracks.find((t: any) =>
              t.type === 'VIDEO' &&
              (String(t.source || '').toLowerCase() === 'screen' || (HMSTrackSource && t.source === HMSTrackSource.SCREEN) || Boolean(t.trackId))
            );

            const rVideoTrackId = rVideoTrack?.trackId;
            const rScreenTrackId = screenTrack?.trackId;
            const rIsVideoMuted = typeof rVideoTrack?.isMute === 'function'
              ? Boolean(rVideoTrack.isMute())
              : Boolean(rVideoTrack?.mute ?? rVideoTrack?.isMute ?? false);
            const rIsAudioMuted = typeof rAudioTrack?.isMute === 'function'
              ? Boolean(rAudioTrack.isMute())
              : Boolean(rAudioTrack?.mute ?? rAudioTrack?.isMute ?? false);

            setParticipants(prev => {
              const existingIndex = prev.findIndex(
                p => !p.isLocal && (
                  p.id === peer.peerID ||
                  (p.role === 'teacher' && (peer.role?.name?.includes('teacher') || peer.role?.name?.includes('host'))) ||
                  (p.name && peer.name && p.name.trim().toLowerCase() === peer.name.trim().toLowerCase()) ||
                  p.status === 'connecting' ||
                  !p.videoTrackId ||
                  prev.filter(x => !x.isLocal).length === 1
                )
              );
              if (existingIndex !== -1) {
                return prev.map((p, idx) =>
                  idx === existingIndex
                    ? {
                      ...p,
                      id: peer.peerID,
                      name: peer.name || p.name || 'Partner',
                      status: 'connected' as const,
                      videoTrackId: rVideoTrackId || p.videoTrackId,
                      screenShareTrackId: rScreenTrackId || p.screenShareTrackId,
                      isVideoOff: rVideoTrackId ? rIsVideoMuted : p.isVideoOff,
                      isMuted: rIsAudioMuted,
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
                  isMuted: rIsAudioMuted,
                  isVideoOff: rIsVideoMuted,
                  isHandRaised: false,
                  isSpeaking: false,
                  status: 'connected' as const,
                  joinedAt: new Date().toISOString(),
                  videoTrackId: rVideoTrackId,
                  screenShareTrackId: rScreenTrackId,
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

          const isScreenSource =
            String(track.source || '').toLowerCase() === 'screen' ||
            (HMSTrackSource && track.source === HMSTrackSource.SCREEN) ||
            (track.type === 'VIDEO' && Boolean(peer.auxiliaryTracks?.some((at: any) => at.trackId === track.trackId)));

          const isTrackMuted =
            type === 'TRACK_MUTED' || type === 'TRACK_REMOVED'
              ? true
              : type === 'TRACK_UNMUTED'
                ? false
                : typeof track.isMute === 'function'
                  ? Boolean(track.isMute())
                  : Boolean(track.mute ?? track.isMute ?? false);

          setParticipants(prev => {
            let updatedAny = false;
            const updated = prev.map(p => {
              const isTarget = p.isLocal
                ? peer.isLocal
                : (
                  p.id === peer.peerID ||
                  (!peer.isLocal && !p.isLocal && (
                    (p.role === 'teacher' && (peer.role?.name?.includes('teacher') || peer.role?.name?.includes('host'))) ||
                    (p.name && peer.name && p.name.trim().toLowerCase() === peer.name.trim().toLowerCase()) ||
                    (!p.videoTrackId && !p.screenShareTrackId) ||
                    (!updatedAny && prev.filter(x => !x.isLocal).length === 1)
                  ))
                );
              if (!isTarget) return p;
              updatedAny = true;

              if (track.type === 'VIDEO') {
                if (isScreenSource) {
                  return {
                    ...p,
                    id: peer.isLocal ? p.id : peer.peerID,
                    name: !peer.isLocal && peer.name ? peer.name : p.name,
                    screenShareTrackId: type === 'TRACK_REMOVED' ? undefined : track.trackId,
                    status: 'connected' as const,
                  };
                }

                // If local peer was set to video on in preview, keep it unmuted on TRACK_ADDED
                const resolvedVideoOff = p.isLocal && type === 'TRACK_ADDED' && initialVideoOn && mode === 'video'
                  ? false
                  : isTrackMuted;

                return {
                  ...p,
                  id: peer.isLocal ? p.id : peer.peerID,
                  name: !peer.isLocal && peer.name ? peer.name : p.name,
                  videoTrackId: type === 'TRACK_REMOVED' ? undefined : track.trackId,
                  isVideoOff: resolvedVideoOff,
                  status: 'connected' as const,
                };
              }
              if (track.type === 'AUDIO') {
                const resolvedAudioMuted = p.isLocal && type === 'TRACK_ADDED' && initialMicOn
                  ? false
                  : isTrackMuted;
                return {
                  ...p,
                  id: peer.isLocal ? p.id : peer.peerID,
                  isMuted: resolvedAudioMuted,
                  status: 'connected' as const,
                };
              }
              return p;
            });

            // If a remote video track arrived for a peer not yet in participants list, add them
            if (!updatedAny && !peer.isLocal && track.type === 'VIDEO') {
              return [
                ...updated,
                {
                  id: peer.peerID,
                  name: peer.name || 'Participant',
                  avatarUrl: '',
                  role: peer.role?.name?.includes('teacher') || peer.role?.name?.includes('host') ? 'teacher' : 'student',
                  isLocal: false,
                  isMuted: false,
                  isVideoOff: isScreenSource ? false : isTrackMuted,
                  isHandRaised: false,
                  isSpeaking: false,
                  status: 'connected' as const,
                  joinedAt: new Date().toISOString(),
                  videoTrackId: isScreenSource ? undefined : (type === 'TRACK_REMOVED' ? undefined : track.trackId),
                  screenShareTrackId: isScreenSource ? (type === 'TRACK_REMOVED' ? undefined : track.trackId) : undefined,
                },
              ];
            }

            return updated;
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

        // Listen for SDK-level errors to surface them instead of silently failing
        hms.addEventListener(HMSUpdateListenerActions.ON_ERROR, (error: any) => {
          if (!isMounted) return;
          const errorCode = error?.code || error?.errorCode || 'UNKNOWN';
          const errorMsg = error?.message || error?.description || String(error || 'Unknown error');
          console.error('[100ms] SDK Error:', errorCode, errorMsg);

          // If this is a fatal error (join failure, auth failure), surface to user
          if (
            errorCode === 2003 || // Token error
            errorCode === 4005 || // Peer already joined
            errorMsg.includes('join') ||
            errorMsg.includes('token') ||
            errorMsg.includes('auth')
          ) {
            setIsConnecting(false);
            Alert.alert(
              'Connection Error',
              `Could not connect to the call room: ${errorMsg}`,
              [{ text: 'OK' }]
            );
          }
        });

        let tokenToUse = authToken || '';
        if (!tokenToUse && roomCode) {
          try {
            if (typeof hms.getAuthTokenByRoomCode === 'function') {
              tokenToUse = await hms.getAuthTokenByRoomCode(roomCode);
            }
          } catch (tokenErr) {
            console.warn('[100ms] getAuthTokenByRoomCode fallback notice:', tokenErr);
          }
          if (!tokenToUse) {
            tokenToUse = roomCode;
          }
        }

        const config = new HMSConfig({
          username: userName || (isTeacher ? 'Teacher' : 'Participant'),
          authToken: tokenToUse,
        });

        // Small delay to ensure native SDK modules are fully initialized before joining
        await new Promise(resolve => setTimeout(resolve, 200));

        console.log('[100ms] Joining room with config...');
        await hms.join(config);
        console.log('[100ms] Join call completed (awaiting ON_JOIN callback)');

        // Ensure tracks are explicitly unmuted or muted according to initial user choices
        try {
          let lPeer = (hms as any).localPeer;
          if (!lPeer && typeof hms.getLocalPeer === 'function') {
            try {
              lPeer = await hms.getLocalPeer();
            } catch (e) { }
          }
          const audioTrack = lPeer?.localAudioTrack?.() || lPeer?.audioTrack;
          const videoTrack = lPeer?.localVideoTrack?.() || lPeer?.videoTrack;

          if (audioTrack && typeof audioTrack.setMute === 'function') {
            audioTrack.setMute(initialMicOn === false);
          }
          if (videoTrack && typeof videoTrack.setMute === 'function') {
            videoTrack.setMute(initialVideoOn === false || mode !== 'video');
          }

          if (videoTrack?.trackId) {
            setParticipants(prev =>
              prev.map(p =>
                p.isLocal
                  ? {
                    ...p,
                    videoTrackId: videoTrack.trackId,
                    status: 'connected' as const,
                    isVideoOff: initialVideoOn === false || mode !== 'video',
                    isMuted: initialMicOn === false,
                  }
                  : p
              )
            );
          }
        } catch (e) {
          console.warn('[100ms] Post-join track sync notice:', e);
        }
      } catch (err: any) {
        const errMsg = err?.message || err?.description || String(err || 'Unknown error');
        console.error('[use100msCall Native] Join exception:', errMsg, err);
        setIsConnecting(false);
        // Do NOT set isConnected=true on failure — this was masking real errors
        // Show an alert so the user knows what happened
        Alert.alert(
          'Call Connection Failed',
          `Could not connect to the call: ${errMsg}. Please check your internet connection and try again.`,
          [{ text: 'OK' }]
        );
      }
    }

    void initNative100ms();

    return () => {
      isMounted = false;
      if (hmsInstanceRef.current) {
        console.log('[100ms] Leaving room and cleaning up SDK instance');
        try {
          hmsInstanceRef.current.leave();
          hmsInstanceRef.current.destroy();
        } catch (e) { }
        hmsInstanceRef.current = null;
      }
    };
  }, [roomCode, authToken, userName, isTeacher, initialMicOn, initialVideoOn, mode]);

  // Helper to obtain native local peer
  const getNativeLocalPeer = useCallback(async () => {
    if (!hmsInstanceRef.current) return null;
    if (typeof hmsInstanceRef.current.getLocalPeer === 'function') {
      try {
        const p = await hmsInstanceRef.current.getLocalPeer();
        if (p) return p;
      } catch (e) { }
    }
    return (
      (hmsInstanceRef.current as any).localPeer ||
      (hmsInstanceRef.current.getRoom?.() as any)?.localPeer ||
      null
    );
  }, []);

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

      // Primary: Direct NativeModules call (most reliable on Android)
      if (Platform.OS !== 'web' && hmsInstanceRef.current) {
        try {
          const { NativeModules } = require('react-native');
          const HMSManager = NativeModules.HMSManager;
          if (HMSManager && typeof HMSManager.setLocalMute === 'function') {
            HMSManager.setLocalMute({ isMute: nextMuted, id: hmsInstanceRef.current.id || '12345' });
          }
        } catch (hmsErr) {
          console.warn('[100ms] setLocalMute NativeModules notice:', hmsErr);
        }
      }

      // Fallback: track-level setMute via getLocalPeer
      void getNativeLocalPeer().then(lPeer => {
        try {
          const track = lPeer?.localAudioTrack?.() || lPeer?.audioTrack;
          if (track && typeof track.setMute === 'function') {
            track.setMute(nextMuted);
          }
        } catch (hmsErr) {
          console.warn('[100ms] setMute notice:', hmsErr);
        }
      });

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
  }, [socket, roomId, currentUserId, getNativeLocalPeer]);

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

      // Primary: Direct NativeModules call (most reliable on Android)
      if (Platform.OS !== 'web' && hmsInstanceRef.current) {
        try {
          const { NativeModules } = require('react-native');
          const HMSManager = NativeModules.HMSManager;
          if (HMSManager && typeof HMSManager.setLocalVideoMute === 'function') {
            HMSManager.setLocalVideoMute({ isMute: nextVideoOff, id: hmsInstanceRef.current.id || '12345' });
          }
        } catch (hmsErr) {
          console.warn('[100ms] setLocalVideoMute NativeModules notice:', hmsErr);
        }
      }

      // Fallback: track-level setMute via getLocalPeer
      void getNativeLocalPeer().then(lPeer => {
        try {
          const track = lPeer?.localVideoTrack?.() || lPeer?.videoTrack;
          if (track && typeof track.setMute === 'function') {
            track.setMute(nextVideoOff);
          }
        } catch (hmsErr) {
          console.warn('[100ms] setVideoMute notice:', hmsErr);
        }
      });

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
  }, [socket, roomId, currentUserId, getNativeLocalPeer]);

  // Switch camera (Front / Back)
  const switchCamera = useCallback(async () => {
    // 1. Primary: Direct NativeModules call for native (most reliable)
    if (Platform.OS !== 'web' && hmsInstanceRef.current) {
      try {
        const { NativeModules } = require('react-native');
        const HMSManager = NativeModules.HMSManager;
        if (HMSManager && typeof HMSManager.switchCamera === 'function') {
          HMSManager.switchCamera({ id: hmsInstanceRef.current.id || '12345' });
          setParticipants(prev =>
            prev.map(p =>
              p.isLocal
                ? {
                  ...p,
                  facingMode: p.facingMode === 'environment' ? 'user' : 'environment',
                }
                : p
            )
          );
          return;
        }
      } catch (err) {
        console.warn('[100ms] switchCamera NativeModules error:', err);
      }
    }

    // 2. Fallback: track-level switchCamera via getLocalPeer
    try {
      const lPeer = await getNativeLocalPeer();
      const track = lPeer?.localVideoTrack?.() || lPeer?.videoTrack;
      if (track && typeof track.switchCamera === 'function') {
        await track.switchCamera();
        setParticipants(prev =>
          prev.map(p =>
            p.isLocal
              ? {
                ...p,
                facingMode: p.facingMode === 'environment' ? 'user' : 'environment',
              }
              : p
          )
        );
        return;
      }
    } catch (err) {
      console.warn('[100ms] switchCamera error:', err);
    }

    // 2. Web / WebRTC Fallback switchCamera
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const nextFacing = facingModeRef.current === 'user' ? 'environment' : 'user';
        let newStream: MediaStream | null = null;
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
        } catch {
          try {
            newStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: nextFacing },
              audio: false,
            });
          } catch {
            try {
              const devices = await navigator.mediaDevices.enumerateDevices();
              const videoDevices = devices.filter(d => d.kind === 'videoinput');
              const currentTrack = webStreamRef.current?.getVideoTracks()[0];
              const currentDeviceId = currentTrack?.getSettings?.()?.deviceId;
              const nextDevice = videoDevices.find(d => d.deviceId && d.deviceId !== currentDeviceId) || videoDevices[0];
              if (nextDevice?.deviceId) {
                newStream = await navigator.mediaDevices.getUserMedia({
                  video: { deviceId: { exact: nextDevice.deviceId } },
                  audio: false,
                });
              }
            } catch (enumErr) {
              console.warn('[switchCamera] deviceId fallback notice:', enumErr);
            }
          }
        }

        if (!newStream) return;
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (!newVideoTrack) return;

        facingModeRef.current = nextFacing;

        if (webStreamRef.current) {
          const oldTracks = webStreamRef.current.getVideoTracks();
          oldTracks.forEach((t: any) => {
            t.stop();
            webStreamRef.current?.removeTrack(t);
          });
          webStreamRef.current.addTrack(newVideoTrack);
        }

        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find((s: any) => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(newVideoTrack).catch((e: any) => console.warn('[switchCamera] replaceTrack error:', e));
          }
        }

        if (webStreamRef.current) {
          const freshStream = new MediaStream(webStreamRef.current.getTracks());
          setParticipants(prev =>
            prev.map(p =>
              p.isLocal
                ? {
                  ...p,
                  mediaStream: freshStream,
                  facingMode: nextFacing,
                }
                : p
            )
          );
        }
      } catch (e) {
        console.warn('[switchCamera fallback] error:', e);
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
          } catch (e) { }
        }
        if (socket) {
          socket.emit('call_signal', screenShareMsg);
          socket.emit('signal', screenShareMsg);
        }

        setParticipants(prev => prev.map(p => (p.isLocal ? { ...p, screenShareStream: undefined } : p)));
      } else if (hmsInstanceRef.current) {
        try {
          if (typeof hmsInstanceRef.current.stopScreenshare === 'function') {
            await hmsInstanceRef.current.stopScreenshare();
          }
        } catch (e) {
          console.warn('[100ms] stopScreenshare error:', e);
        }

        // Broadcast native screen share stopped
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

        setParticipants(prev => prev.map(p => (p.isLocal ? { ...p, screenShareTrackId: undefined, screenShareStream: undefined } : p)));
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
        } catch (err: any) {
          console.warn('[use100msCall] DisplayMedia error:', err);
          setIsScreenSharing(false);
        }
      } else if (hmsInstanceRef.current) {
        try {
          if (Platform.OS === 'android') {
            await requestCameraAndMicrophonePermissions({ showAlertOnDenial: false });
          }
          if (typeof hmsInstanceRef.current.startScreenshare === 'function') {
            await hmsInstanceRef.current.startScreenshare();
            setIsScreenSharing(true);

            // Broadcast screenshare started to cross-platform peers
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
          } else {
            Alert.alert(
              'Screen Sharing',
              'Screen sharing is best supported on desktop web browsers. Mobile screen broadcasting is not supported on this device.'
            );
          }
        } catch (err: any) {
          console.warn('[100ms] startScreenshare error:', err);
          setIsScreenSharing(false);
          const errorMsg = String(err?.message || err?.description || err || '');
          if (!errorMsg.includes('RESULT_CANCELED') && !errorMsg.includes('canceled') && !errorMsg.includes('cancelled')) {
            Alert.alert(
              'Screen Sharing',
              `Screen sharing could not be started.\n\n${errorMsg ? errorMsg : 'Ensure you granted screen recording permission when prompted.'}`
            );
          }
        }
      } else {
        Alert.alert(
          'Screen Sharing',
          'Screen sharing requires an active video call room.'
        );
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
        hmsInstanceRef.current.changeMetadata(JSON.stringify({ isHandRaised: nextRaised })).catch(() => { });
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
        hmsInstanceRef.current.sendBroadcastMessage(payload).catch(() => { });
      }
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
      hmsInstanceRef.current.leave().catch(() => { });
    }
    onEndCall();
  }, [onEndCall, socket, roomId, currentUserId, userName]);

  const stopRecording = useCallback(async () => {
    if (hmsInstanceRef.current && isTeacher) {
      try {
        await hmsInstanceRef.current.stopRTMPAndRecording();
        setIsRecording(false);
      } catch (error) {
        console.error('Failed to stop recording', error);
      }
    }
  }, [isTeacher]);

  const startRecording = useCallback(async () => {
    if (hmsInstanceRef.current && isTeacher) {
      try {
        const { HMSRTMPConfig } = await import('@100mslive/react-native-hms');
        // Let 100ms use the default meeting URL defined in the template by leaving meetingURL empty if not strictly needed
        const rtmpConfig = new HMSRTMPConfig({
          record: true,
          rtmpURLs: [], // No RTMP URLs needed for just recording
        });
        await hmsInstanceRef.current.startRTMPOrRecording(rtmpConfig);
        setIsRecording(true);
      } catch (error) {
        console.error('Failed to start recording', error);
      }
    }
  }, [isTeacher]);

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
    sdkId,
    startRecording,
    stopRecording,
    isRecording,
  };
}
