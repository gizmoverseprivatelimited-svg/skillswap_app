import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  type CallParticipant,
  type CallMessage,
  type CallMode,
  generateCallMessageId,
} from '../lib/call-engine';

interface Use100msCallProps {
  roomCode?: string | null;
  authToken?: string | null;
  userName: string;
  isTeacher?: boolean;
  initialParticipants: CallParticipant[];
  mode: CallMode;
  onEndCall: () => void;
}

export function use100msCall({
  roomCode,
  authToken,
  userName,
  isTeacher = false,
  initialParticipants,
  mode,
  onEndCall,
}: Use100msCallProps) {
  const [participants, setParticipants] = useState<CallParticipant[]>(initialParticipants);
  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [localStream, setLocalStream] = useState<any>(null);

  const hmsInstanceRef = useRef<any>(null);
  const webStreamRef = useRef<any>(null);

  // Sync initial participants
  useEffect(() => {
    setParticipants(prev => {
      if (prev.length === 0) return initialParticipants;
      return prev;
    });
  }, [initialParticipants]);

  // 1. Web Camera & Microphone initialization
  useEffect(() => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      let isCancelled = false;
      const enableVideo = mode === 'video';

      navigator.mediaDevices.getUserMedia({
        video: enableVideo,
        audio: true,
      })
        .then((stream) => {
          if (isCancelled) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          webStreamRef.current = stream;
          setLocalStream(stream);
          setIsConnecting(false);
          setIsConnected(true);

          setParticipants(prev => prev.map(p => {
            if (p.isLocal) {
              return {
                ...p,
                status: 'connected' as const,
                mediaStream: stream,
                isVideoOff: !enableVideo,
                isMuted: false,
              };
            }
            return {
              ...p,
              status: 'connected' as const,
            };
          }));
        })
        .catch((err) => {
          console.warn('[use100msCall Web] Camera/mic access notice:', err);
          setIsConnecting(false);
          setIsConnected(true);
          setParticipants(prev => prev.map(p => ({ ...p, status: 'connected' as const })));
        });

      return () => {
        isCancelled = true;
        if (webStreamRef.current) {
          webStreamRef.current.getTracks().forEach((t: any) => t.stop());
          webStreamRef.current = null;
        }
      };
    }
  }, [mode]);

  // 2. Native 100ms SDK initialization (Android / iOS)
  useEffect(() => {
    if (Platform.OS !== 'web' && roomCode) {
      let isMounted = true;

      async function initNative100ms() {
        try {
          const {
            HMSSDK,
            HMSConfig,
            HMSUpdateListenerActions,
          } = await import('@100mslive/react-native-hms');

          const hms = await HMSSDK.build();
          hmsInstanceRef.current = hms;

          // Register listeners
          hms.addEventListener(HMSUpdateListenerActions.ON_JOIN, (data: any) => {
            if (!isMounted) return;
            console.log('[100ms] Joined room:', data);
            setIsConnecting(false);
            setIsConnected(true);

            // Update local participant track
            if (data?.localPeer?.videoTrack?.trackId) {
              const videoTrackId = data.localPeer.videoTrack.trackId;
              setParticipants(prev => prev.map(p => p.isLocal ? {
                ...p,
                videoTrackId,
                status: 'connected',
                isVideoOff: data.localPeer.videoTrack.isMute() ?? false,
              } : p));
            }
          });

          hms.addEventListener(HMSUpdateListenerActions.ON_PEER_UPDATE, (data: any) => {
            if (!isMounted) return;
            const { peer, type } = data;
            if (!peer) return;

            if (type === 'PEER_JOINED' && !peer.isLocal) {
              setParticipants(prev => {
                const exists = prev.find(p => p.id === peer.peerID);
                if (exists) return prev;
                return [
                  ...prev,
                  {
                    id: peer.peerID,
                    name: peer.name || 'Participant',
                    avatarUrl: '',
                    role: peer.role?.name?.includes('teacher') || peer.role?.name?.includes('host') ? 'teacher' : 'student',
                    isLocal: false,
                    isMuted: peer.audioTrack?.isMute() ?? true,
                    isVideoOff: peer.videoTrack?.isMute() ?? true,
                    isHandRaised: false,
                    isSpeaking: false,
                    status: 'connected',
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

            setParticipants(prev => prev.map(p => {
              const isTarget = p.isLocal ? peer.isLocal : p.id === peer.peerID;
              if (!isTarget) return p;

              if (track.type === 'VIDEO') {
                const isVideoMuted = track.isMute() || type === 'TRACK_MUTED' || type === 'TRACK_REMOVED';
                return {
                  ...p,
                  videoTrackId: type === 'TRACK_REMOVED' ? undefined : track.trackId,
                  isVideoOff: isVideoMuted,
                };
              }
              if (track.type === 'AUDIO') {
                const isAudioMuted = track.isMute() || type === 'TRACK_MUTED' || type === 'TRACK_REMOVED';
                return {
                  ...p,
                  isMuted: isAudioMuted,
                };
              }
              return p;
            }));
          });

          hms.addEventListener(HMSUpdateListenerActions.ON_MESSAGE, (data: any) => {
            if (!isMounted || !data) return;
            const incoming: CallMessage = {
              id: generateCallMessageId(),
              authorId: data.sender?.peerID || 'peer',
              authorName: data.sender?.name || 'Participant',
              body: data.message || '',
              createdAt: new Date().toISOString(),
            };
            setMessages(prev => [...prev, incoming]);
          });

          hms.addEventListener(HMSUpdateListenerActions.ON_SPEAKER, (data: any) => {
            if (!isMounted || !data?.speakers) return;
            const speakingIds = new Set(data.speakers.map((s: any) => s.peerID));
            setParticipants(prev => prev.map(p => ({
              ...p,
              isSpeaking: speakingIds.has(p.id),
            })));
          });

          hms.addEventListener(HMSUpdateListenerActions.ON_ERROR, (error: any) => {
            console.error('[100ms SDK Error]', error);
          });

          // Join room
          const config = new HMSConfig({
            username: userName || (isTeacher ? 'Teacher' : 'Participant'),
            authToken: authToken || roomCode || '',
          });

          await hms.join(config);
        } catch (err) {
          console.warn('[use100msCall Native] HMSSDK join exception:', err);
          setIsConnecting(false);
          setIsConnected(true);
        }
      }

      void initNative100ms();

      return () => {
        isMounted = false;
        if (hmsInstanceRef.current) {
          hmsInstanceRef.current.leave().catch((e: any) => console.log('Leave error:', e));
          hmsInstanceRef.current.destroy().catch((e: any) => console.log('Destroy error:', e));
          hmsInstanceRef.current = null;
        }
      };
    } else {
      // Fallback for simulation / expo go
      const timeout = setTimeout(() => {
        setIsConnecting(false);
        setIsConnected(true);
        setParticipants(prev => prev.map(p => ({ ...p, status: 'connected' as const })));
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [roomCode, authToken, userName, isTeacher]);

  // Toggle local microphone
  const toggleMute = useCallback(() => {
    setParticipants(prev => {
      const local = prev.find(p => p.isLocal);
      const nextMuted = !(local?.isMuted ?? false);

      // Web audio track control
      if (webStreamRef.current) {
        webStreamRef.current.getAudioTracks().forEach((track: any) => {
          track.enabled = !nextMuted;
        });
      }

      // Native 100ms audio track control
      if (hmsInstanceRef.current?.localPeer?.localAudioTrack()) {
        hmsInstanceRef.current.localPeer.localAudioTrack().setMute(nextMuted);
      }

      return prev.map(p => p.isLocal ? { ...p, isMuted: nextMuted, isSpeaking: false } : p);
    });
  }, []);

  // Toggle local camera video
  const toggleVideo = useCallback(() => {
    setParticipants(prev => {
      const local = prev.find(p => p.isLocal);
      const nextVideoOff = !(local?.isVideoOff ?? false);

      // Web video track control
      if (webStreamRef.current) {
        webStreamRef.current.getVideoTracks().forEach((track: any) => {
          track.enabled = !nextVideoOff;
        });
      }

      // Native 100ms video track control
      if (hmsInstanceRef.current?.localPeer?.localVideoTrack()) {
        hmsInstanceRef.current.localPeer.localVideoTrack().setMute(nextVideoOff);
      }

      return prev.map(p => p.isLocal ? { ...p, isVideoOff: nextVideoOff } : p);
    });
  }, []);

  // Send in-call message
  const sendMessage = useCallback((text: string, authorId: string, authorName: string) => {
    if (!text.trim()) return;
    const msg: CallMessage = {
      id: generateCallMessageId(),
      authorId,
      authorName,
      body: text.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, msg]);

    // Native 100ms broadcast
    if (hmsInstanceRef.current) {
      hmsInstanceRef.current.sendBroadcastMessage(text.trim()).catch((err: any) => {
        console.warn('[100ms] sendBroadcastMessage error:', err);
      });
    }
  }, []);

  // Leave / end call
  const leaveCall = useCallback(() => {
    if (webStreamRef.current) {
      webStreamRef.current.getTracks().forEach((track: any) => track.stop());
      webStreamRef.current = null;
    }
    if (hmsInstanceRef.current) {
      hmsInstanceRef.current.leave().catch(() => {});
    }
    onEndCall();
  }, [onEndCall]);

  return {
    participants,
    setParticipants,
    messages,
    isConnected,
    isConnecting,
    localStream,
    toggleMute,
    toggleVideo,
    sendMessage,
    leaveCall,
  };
}
