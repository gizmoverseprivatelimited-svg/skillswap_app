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

  // Sync initial participants when updated
  useEffect(() => {
    setParticipants(prev => {
      if (prev.length === 0) return initialParticipants;
      return initialParticipants.map(initP => {
        const existing = prev.find(p => p.id === initP.id || (p.isLocal && initP.isLocal));
        if (existing) {
          return {
            ...initP,
            mediaStream: existing.mediaStream || initP.mediaStream,
            videoTrackId: existing.videoTrackId || initP.videoTrackId,
            status: existing.status === 'connected' ? 'connected' : initP.status,
            isVideoOff: existing.isVideoOff !== undefined ? existing.isVideoOff : initP.isVideoOff,
            isMuted: existing.isMuted !== undefined ? existing.isMuted : initP.isMuted,
          };
        }
        return initP;
      });
    });
  }, [initialParticipants]);

  // 1. Web Media (Camera & Mic) and WebRTC Peer Connection
  useEffect(() => {
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

      webStreamRef.current = stream;

      // Update local participant with media stream
      setParticipants(prev =>
        prev.map(p =>
          p.isLocal
            ? {
                ...p,
                mediaStream: stream,
                status: 'connected',
                isVideoOff: !enableVideo || !stream?.getVideoTracks()?.length,
                isMuted: !stream?.getAudioTracks()?.length,
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
        pc.ontrack = event => {
          console.log('[use100msCall Web] Received remote stream track:', event.streams[0]);
          const remoteStream = event.streams[0];
          setParticipants(prev =>
            prev.map(p =>
              !p.isLocal
                ? {
                    ...p,
                    mediaStream: remoteStream,
                    status: 'connected',
                    isVideoOff: false,
                    isMuted: false,
                  }
                : p
            )
          );
        };

        // ICE candidate handler
        pc.onicecandidate = event => {
          if (event.candidate) {
            const candidatePayload = {
              type: 'candidate',
              candidate: event.candidate,
              room: roomId,
              senderId: currentUserId,
              targetId: partnerId,
            };
            if (bc) {
              try {
                bc.postMessage(candidatePayload);
              } catch (e) {}
            }
            if (socket) {
              socket.emit('call_signal', candidatePayload);
              socket.emit('signal', candidatePayload);
            }
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
        const handleSignalMessage = async (msg: any) => {
          if (!msg || msg.senderId === currentUserId) return;

          try {
            if (msg.type === 'offer' && pc) {
              console.log('[use100msCall Web] Processing Offer');
              await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));

              // Process queued candidates
              while (candidateQueueRef.current.length > 0) {
                const cand = candidateQueueRef.current.shift();
                if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
              }

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              const answerPayload = {
                type: 'answer',
                answer,
                room: roomId,
                senderId: currentUserId,
                targetId: msg.senderId,
              };
              if (bc) {
                try {
                  bc.postMessage(answerPayload);
                } catch (e) {}
              }
              if (socket) {
                socket.emit('call_signal', answerPayload);
                socket.emit('signal', answerPayload);
              }
            } else if (msg.type === 'answer' && pc) {
              console.log('[use100msCall Web] Processing Answer');
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
              if (msg.reaction) {
                setReactions(prev => [...prev.slice(-15), msg.reaction]);
              }
            } else if (msg.type === 'chat') {
              if (msg.message) {
                setMessages(prev => [...prev, msg.message]);
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
            void handleSignalMessage(evt.data);
          };
        }

        if (socket) {
          socket.on('call_signal', handleSignalMessage);
          socket.on('signal', handleSignalMessage);
          socket.on('call_reaction', (data: any) => {
            if (data?.reaction) {
              setReactions(prev => [...prev.slice(-15), data.reaction]);
            }
          });
          socket.on('call_chat_message', (data: any) => {
            if (data?.message) {
              setMessages(prev => [...prev, data.message]);
            }
          });
          socket.on('call_ended', () => {
            onEndCall();
          });
        }

        // Caller initiates the offer if we have the lower ID or are caller
        const isCaller = currentUserId && partnerId ? String(currentUserId) < String(partnerId) : true;
        if (isCaller) {
          setTimeout(async () => {
            try {
              if (pc.signalingState === 'stable') {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                const offerPayload = {
                  type: 'offer',
                  offer,
                  room: roomId,
                  senderId: currentUserId,
                  targetId: partnerId,
                };
                if (bc) {
                  try {
                    bc.postMessage(offerPayload);
                  } catch (e) {}
                }
                if (socket) {
                  socket.emit('call_signal', offerPayload);
                  socket.emit('signal', offerPayload);
                }
              }
            } catch (offerErr) {
              console.warn('[use100msCall Web] Create offer error:', offerErr);
            }
          }, 600);
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
    };
  }, [mode, roomId, currentUserId, partnerId, socket, userName, onEndCall]);

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
        } catch (e) {}
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
          broadcastChannelRef.current.postMessage({ type: 'reaction', room: roomId, reaction });
        } catch (e) {}
      }
      if (socket) {
        socket.emit('call_reaction', { room: roomId, reaction });
      }
    },
    [userName, socket, roomId]
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

      setMessages(prev => [...prev, msg]);

      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({ type: 'chat', room: roomId, message: msg });
        } catch (e) {}
      }
      if (socket) {
        socket.emit('call_chat_message', { room: roomId, message: msg });
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
    onEndCall();
  }, [onEndCall]);

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
