import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  SwitchCamera,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Users,
  GraduationCap,
  ArrowLeft,
  Settings2,
} from 'lucide-react-native';
import LiveVideoTrack from './LiveVideoTrack';
import { resolveImageUrl } from '@/lib/resolveImageUrl';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';

export interface CallPreviewScreenProps {
  roomTitle: string;
  userName: string;
  userAvatar?: string;
  partnerName?: string;
  partnerAvatar?: string;
  isTeacher?: boolean;
  isGroupCall?: boolean;
  initialMicOn?: boolean;
  initialVideoOn?: boolean;
  onJoin: (settings: { isMicOn: boolean; isVideoOn: boolean }) => void;
  onCancel: () => void;
}

export default function CallPreviewScreen({
  roomTitle,
  userName,
  userAvatar,
  partnerName,
  partnerAvatar,
  isTeacher = false,
  isGroupCall = false,
  initialMicOn = true,
  initialVideoOn = true,
  onJoin,
  onCancel,
}: CallPreviewScreenProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isSmallScreen = windowWidth < 380 || windowHeight < 680;
  const isTabletOrDesktop = windowWidth >= 768;
  const dynamicPreviewHeight = isTabletOrDesktop ? 380 : Math.min(Math.max(windowHeight * 0.36, 210), 340);

  const [isMicOn, setIsMicOn] = useState<boolean>(initialMicOn);
  const [isVideoOn, setIsVideoOn] = useState<boolean>(initialVideoOn);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const localStreamRef = useRef<MediaStream | null>(null);

  const stopAllMediaTracks = useCallback(() => {
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (e) {}
        });
      } catch (e) {}
      localStreamRef.current = null;
    }
    setLocalStream(null);
  }, []);

  // Initialize local media preview on Web
  const startPreview = useCallback(async (withVideo: boolean, withAudio: boolean, face: 'user' | 'environment') => {
    if (Platform.OS !== 'web') return;
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (e) {}
        });
        localStreamRef.current = null;
      }
      setStreamError(null);

      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        if (!withVideo && !withAudio) {
          stopAllMediaTracks();
          return;
        }

        const constraints: MediaStreamConstraints = {
          video: withVideo ? { facingMode: face, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
          audio: withAudio,
        };

        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (isMountedRef.current) {
            localStreamRef.current = stream;
            setLocalStream(stream);
          } else {
            stream.getTracks().forEach((t) => {
              try {
                t.stop();
              } catch (e) {}
            });
          }
        } catch (err: any) {
          console.warn('[CallPreviewScreen] getUserMedia notice:', err);
          // Fallback to video-only if audio device is locked or vice versa
          if (withVideo) {
            try {
              const fallbackStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: face },
                audio: false,
              });
              if (isMountedRef.current) {
                localStreamRef.current = fallbackStream;
                setLocalStream(fallbackStream);
              } else {
                fallbackStream.getTracks().forEach((t) => {
                  try {
                    t.stop();
                  } catch (e) {}
                });
              }
            } catch (e2) {
              if (isMountedRef.current) {
                setStreamError('Camera permission denied or camera not found');
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[CallPreviewScreen] Media start error:', err);
      if (isMountedRef.current) {
        setStreamError('Could not start camera preview');
      }
    }
  }, [stopAllMediaTracks]);

  useEffect(() => {
    isMountedRef.current = true;
    startPreview(isVideoOn, isMicOn, facingMode);

    return () => {
      isMountedRef.current = false;
      stopAllMediaTracks();
    };
  }, []);

  const handleToggleVideo = useCallback(() => {
    const next = !isVideoOn;
    setIsVideoOn(next);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = next;
      });
      if (!next) {
        // Stop video tracks to free camera hardware light immediately
        localStreamRef.current.getVideoTracks().forEach((t) => {
          try {
            t.stop();
          } catch (e) {}
        });
        startPreview(false, isMicOn, facingMode);
      } else {
        startPreview(true, isMicOn, facingMode);
      }
    } else if (next) {
      startPreview(true, isMicOn, facingMode);
    }
  }, [isVideoOn, isMicOn, facingMode, startPreview]);

  const handleToggleMic = useCallback(() => {
    const next = !isMicOn;
    setIsMicOn(next);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = next;
      });
    }
  }, [isMicOn]);

  const handleSwitchCamera = useCallback(() => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    if (isVideoOn) {
      startPreview(true, isMicOn, nextFacing);
    }
  }, [facingMode, isVideoOn, isMicOn, startPreview]);

  const handleJoinPress = useCallback(() => {
    setIsJoining(true);
    // Stop local preview tracks so 100ms / call room connection can cleanly acquire media
    stopAllMediaTracks();
    onJoin({ isMicOn, isVideoOn });
  }, [isMicOn, isVideoOn, stopAllMediaTracks, onJoin]);

  const handleExitPress = useCallback(() => {
    stopAllMediaTracks();
    onCancel();
  }, [stopAllMediaTracks, onCancel]);

  const avatarUri = resolveImageUrl(userAvatar, DEFAULT_AVATAR);
  const resolvedPartnerAvatar = partnerAvatar ? resolveImageUrl(partnerAvatar, DEFAULT_AVATAR) : undefined;

  const displayTitle = React.useMemo(() => {
    if (!roomTitle) return isGroupCall ? 'Group Workshop' : '1:1 Skill Swap';
    if (partnerName && roomTitle.toLowerCase().includes(`with ${partnerName.toLowerCase()}`)) {
      const cleaned = roomTitle.replace(new RegExp(`\\s*with\\s+${partnerName}`, 'i'), '').trim();
      return cleaned || (isGroupCall ? 'Group Workshop' : '1:1 Skill Swap');
    }
    return roomTitle;
  }, [roomTitle, partnerName, isGroupCall]);

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient colors={['#0B0F19', '#111827', '#0F172A']} style={styles.gradient}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleExitPress} activeOpacity={0.7}>
            <ArrowLeft size={20} color="#F8FAFC" />
            <Text style={styles.backButtonText}>Exit</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.contentWrap}>
            {/* Room / Meeting Title */}
            <View style={styles.titleSection}>
              <View style={styles.tagRow}>
                {isGroupCall ? (
                  <View style={styles.roomTypeBadge}>
                    <GraduationCap size={12} color="#818CF8" />
                    <Text style={styles.roomTypeText}>Group Workshop</Text>
                  </View>
                ) : (
                  <View style={styles.roomTypeBadge}>
                    <Users size={12} color="#34D399" />
                    <Text style={styles.roomTypeText}>1:1 Skill Swap</Text>
                  </View>
                )}
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>Ready to Join</Text>
                </View>
              </View>

              <Text style={styles.roomTitleText} numberOfLines={2}>
                {displayTitle}
              </Text>
              {partnerName ? (
                <Text style={styles.partnerSubtext}>
                  With <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>{partnerName}</Text>
                </Text>
              ) : null}
            </View>

            {/* Video Preview Viewport */}
            <View style={[styles.previewCard, { height: dynamicPreviewHeight }]}>
            <View style={styles.previewContainer}>
              {isVideoOn && localStream ? (
                <LiveVideoTrack
                  mediaStream={localStream}
                  mirror={facingMode === 'user'}
                  style={styles.videoTrack}
                />
              ) : (
                <View style={styles.cameraOffOverlay}>
                  <View style={styles.avatarGlow}>
                    <Image source={{ uri: avatarUri }} style={styles.largeAvatar} />
                  </View>
                  <View style={styles.cameraOffPill}>
                    <VideoOff size={14} color="#CBD5E1" />
                    <Text style={styles.cameraOffText}>Camera is turned off</Text>
                  </View>
                </View>
              )}

              {/* Floating Participant Tag */}
              <View style={styles.previewFloatingTag}>
                <View style={[styles.micStatusDot, { backgroundColor: isMicOn ? '#10B981' : '#EF4444' }]} />
                <Text style={styles.previewUserName} numberOfLines={1}>
                  {userName || 'You'} {isTeacher ? '(Host)' : ''}
                </Text>
              </View>

              {/* Quick Floating Camera Switch (Web/Mobile) */}
              {isVideoOn && (
                <TouchableOpacity
                  style={styles.switchCameraFloatingBtn}
                  onPress={handleSwitchCamera}
                  activeOpacity={0.7}
                  accessibilityLabel="Switch Camera"
                >
                  <SwitchCamera size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Quick Preview Media Controls Bar */}
            <View style={styles.previewControlsRow}>
              {/* Mic Toggle Button */}
              <TouchableOpacity
                style={[
                  styles.previewControlBtn,
                  isMicOn ? styles.controlBtnActive : styles.controlBtnMuted,
                ]}
                onPress={handleToggleMic}
                activeOpacity={0.8}
              >
                {isMicOn ? <Mic size={20} color="#FFFFFF" /> : <MicOff size={20} color="#FFFFFF" />}
                <Text style={styles.controlBtnLabel}>{isMicOn ? 'Mute' : 'Unmute'}</Text>
              </TouchableOpacity>

              {/* Camera Toggle Button */}
              <TouchableOpacity
                style={[
                  styles.previewControlBtn,
                  isVideoOn ? styles.controlBtnActive : styles.controlBtnMuted,
                ]}
                onPress={handleToggleVideo}
                activeOpacity={0.8}
              >
                {isVideoOn ? <Video size={20} color="#FFFFFF" /> : <VideoOff size={20} color="#FFFFFF" />}
                <Text style={styles.controlBtnLabel}>{isVideoOn ? 'Stop Video' : 'Start Video'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* User Info Bar & Join Actions */}
          <View style={styles.actionSection}>
            <View style={styles.userCardRow}>
              <Image source={{ uri: avatarUri }} style={styles.userSmallAvatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.userCardName} numberOfLines={1}>
                  {userName || 'You'}
                </Text>
                <Text style={styles.userCardRole}>
                  {isTeacher ? 'Hosting as Teacher' : isGroupCall ? 'Joining as Student' : 'Joining as Participant'}
                </Text>
              </View>
              <View style={styles.statusPill}>
                <Sparkles size={13} color="#818CF8" />
                <Text style={styles.statusPillText}>HD Ready</Text>
              </View>
            </View>

            {/* Join CTA Button */}
            <TouchableOpacity
              style={[styles.joinMeetingButton, isJoining && { opacity: 0.8 }]}
              onPress={handleJoinPress}
              disabled={isJoining}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#6366F1', '#4F46E5', '#4338CA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.joinBtnGradient}
              >
                {isJoining ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.joinBtnText}>Connecting to room...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.joinBtnText}>Join Meeting Now</Text>
                    <ArrowRight size={20} color="#FFFFFF" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  gradient: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 54 : 32,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backButtonText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  securityText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
  },
  contentWrap: {
    flex: 1,
    justifyContent: 'space-between',
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  titleSection: {
    gap: 6,
    marginBottom: 12,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roomTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  roomTypeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A5B4FC',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  roomTitleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 28,
  },
  partnerSubtext: {
    fontSize: 14,
    color: '#94A3B8',
  },
  previewCard: {
    flex: 1,
    maxHeight: 380,
    minHeight: 260,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
    marginVertical: 10,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cameraOffOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  avatarGlow: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  largeAvatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
  },
  cameraOffPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cameraOffText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  previewFloatingTag: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  micStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  previewUserName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  switchCameraFloatingBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  previewControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 14,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  previewControlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  controlBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  controlBtnMuted: {
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
  },
  controlBtnLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  actionSection: {
    gap: 12,
    marginTop: 6,
  },
  userCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  userSmallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  userCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  userCardRole: {
    fontSize: 12,
    color: '#94A3B8',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A5B4FC',
  },
  joinMeetingButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  joinBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  joinBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
