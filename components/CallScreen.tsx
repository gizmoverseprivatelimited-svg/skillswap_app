import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  Platform,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  FlatList,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Users as UsersIcon,
  Hand, Send, Wifi, Signal, Volume2, Grid3x3, Maximize2,
  ChevronDown, Circle, Sparkles, SwitchCamera, MonitorUp, Smile,
  MoreVertical, VolumeX, UserMinus, ShieldCheck, Check, User, UserCheck, UserX,
} from 'lucide-react-native';
import {
  type CallParticipant,
  type CallMessage,
  type CallMode,
  type CallReaction,
  type AudioDevice,
  formatDuration,
  startCallTimer,
  stopCallTimer,
  startSpeakingSimulator,
  stopSpeakingSimulator,
  generateCallMessageId,
} from '../lib/call-engine';
import LiveVideoTrack from './LiveVideoTrack';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const REACTION_EMOJIS = ['👏', '❤️', '🔥', '🎉', '👍', '💡', '🚀', '😂'];

interface CallScreenProps {
  participants: CallParticipant[];
  roomTitle: string;
  mode: CallMode;
  isGroupCall: boolean;
  isTeacher?: boolean;
  onEndCall: () => void;
  onToggleMute?: () => void;
  onToggleVideo?: () => void;
  onSwitchCamera?: () => void;
  onToggleScreenShare?: () => void;
  isScreenSharing?: boolean;
  onSwitchAudioOutput?: (device: AudioDevice) => void;
  selectedAudioDevice?: AudioDevice;
  availableAudioDevices?: string[];
  onToggleHand?: () => void;
  onSendReaction?: (emoji: string) => void;
  reactions?: CallReaction[];
  onMuteParticipant?: (id: string) => void;
  onRemoveParticipant?: (id: string) => void;
  onSendMessage?: (text: string) => void;
  externalMessages?: CallMessage[];
}

type BottomPanel = 'none' | 'chat' | 'participants' | 'more' | 'reactions' | 'audioDevices';

export default function CallScreen({
  participants: initialParticipants,
  roomTitle,
  mode,
  isGroupCall,
  isTeacher = false,
  onEndCall,
  onToggleMute,
  onToggleVideo,
  onSwitchCamera,
  onToggleScreenShare,
  isScreenSharing = false,
  onSwitchAudioOutput,
  selectedAudioDevice = 'SPEAKER_PHONE',
  availableAudioDevices = ['SPEAKER_PHONE', 'EARPIECE'],
  onToggleHand,
  onSendReaction,
  reactions = [],
  onMuteParticipant,
  onRemoveParticipant,
  onSendMessage,
  externalMessages,
}: CallScreenProps) {
  const insets = useSafeAreaInsets();
  const [participants, setParticipants] = useState<CallParticipant[]>(initialParticipants);
  const [duration, setDuration] = useState(0);
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>('none');
  const [messages, setMessages] = useState<CallMessage[]>(externalMessages || []);
  const [chatDraft, setChatDraft] = useState('');
  const [spotlightId, setSpotlightId] = useState<string | null>(
    isGroupCall ? initialParticipants.find(p => !p.isLocal)?.id ?? null : initialParticipants.find(p => !p.isLocal)?.id ?? null,
  );
  const [layout, setLayout] = useState<'grid' | 'spotlight'>(isGroupCall ? 'spotlight' : 'spotlight');
  const [connecting, setConnecting] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  // Floating reaction animations
  const [activeReactions, setActiveReactions] = useState<{ id: string; emoji: string; anim: Animated.Value; left: number }[]>([]);
  const [reactionToast, setReactionToast] = useState<{ id: string; emoji: string; senderName?: string } | null>(null);
  const reactionToastAnim = useRef(new Animated.Value(0)).current;
  const lastAnimatedReactionIdRef = useRef<string | null>(null);

  // In-call Event Toast (Peer joined / Peer left)
  const [callEventToast, setCallEventToast] = useState<{ id: string; message: string; type: 'join' | 'leave' | 'info' } | null>(null);
  const callEventToastAnim = useRef(new Animated.Value(0)).current;
  const lastSystemMsgIdRef = useRef<string | null>(null);

  const triggerEventToast = useCallback((message: string, type: 'join' | 'leave' | 'info' = 'info') => {
    const id = `evt-${Date.now()}`;
    setCallEventToast({ id, message, type });
    callEventToastAnim.setValue(0);
    Animated.sequence([
      Animated.spring(callEventToastAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.delay(2600),
      Animated.timing(callEventToastAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setCallEventToast(prev => (prev?.id === id ? null : prev));
    });
  }, [callEventToastAnim]);

  // Trigger floating reaction animation & pop-up toast
  const triggerFloatingReaction = useCallback((emoji: string, senderName?: string) => {
    // 1. Floating bubble animation moving upwards
    const anim = new Animated.Value(0);
    const id = `react-${Date.now()}-${Math.random()}`;
    const left = Math.random() * (SCREEN_WIDTH - 120) + 40;

    setActiveReactions(prev => [...prev.slice(-10), { id, emoji, anim, left }]);

    Animated.timing(anim, {
      toValue: 1,
      duration: 2500,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setActiveReactions(prev => prev.filter(r => r.id !== id));
    });

    // 2. Reaction Pop-up Toast banner
    setReactionToast({ id, emoji, senderName });
    reactionToastAnim.setValue(0);
    Animated.sequence([
      Animated.spring(reactionToastAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.delay(1800),
      Animated.timing(reactionToastAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setReactionToast(prev => (prev?.id === id ? null : prev));
    });
  }, [reactionToastAnim]);

  // Sync external incoming reactions
  useEffect(() => {
    if (reactions && reactions.length > 0) {
      const latest = reactions[reactions.length - 1];
      if (latest && latest.id !== lastAnimatedReactionIdRef.current) {
        lastAnimatedReactionIdRef.current = latest.id;
        triggerFloatingReaction(latest.emoji, latest.senderName);
      }
    }
  }, [reactions, triggerFloatingReaction]);

  // Sync participants from parent when updated by 100ms / WebRTC
  useEffect(() => {
    if (initialParticipants && initialParticipants.length > 0) {
      setParticipants(initialParticipants);
    }
  }, [initialParticipants]);

  // Sync external messages
  useEffect(() => {
    if (externalMessages && externalMessages.length > 0) {
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newItems = externalMessages.filter(m => !existingIds.has(m.id));
        if (newItems.length === 0) {
          return externalMessages.length === prev.length ? prev : externalMessages;
        }
        return [...prev, ...newItems];
      });
    }
  }, [externalMessages]);

  // Watch for in-call system events (Join / Leave)
  useEffect(() => {
    const all = [...messages, ...(externalMessages || [])];
    if (all.length > 0) {
      const latestSys = all.filter(m => m.isSystem).pop();
      if (latestSys && latestSys.id !== lastSystemMsgIdRef.current) {
        lastSystemMsgIdRef.current = latestSys.id;
        const text = latestSys.body || '';
        if (text.includes('joined the call')) {
          triggerEventToast(text, 'join');
        } else if (text.includes('left the call') || text.includes('ended')) {
          triggerEventToast(text, 'leave');
        }
      }
    }
  }, [messages, externalMessages, triggerEventToast]);

  const localParticipant = useMemo(() => participants.find(p => p.isLocal) ?? null, [participants]);
  const remoteParticipants = useMemo(() => participants.filter(p => !p.isLocal), [participants]);

  const isOnlyOneUser = useMemo(() => {
    const connectedRemotes = remoteParticipants.filter(p => p.status === 'connected');
    return connectedRemotes.length === 0;
  }, [remoteParticipants]);

  const spotlightParticipant = useMemo(() => {
    // 1. If explicit spotlight ID matches a non-local participant with live video, return it
    const explicit = participants.find(p => p.id === spotlightId && !p.isLocal);
    if (explicit && (explicit.videoTrackId || explicit.mediaStream)) {
      return explicit;
    }
    // 2. Prioritize any remote participant that has live video
    const liveRemote = remoteParticipants.find(p => p.videoTrackId || p.mediaStream);
    if (liveRemote) return liveRemote;

    // 3. Prioritize any connected remote participant
    const connectedRemote = remoteParticipants.find(p => p.status === 'connected');
    if (connectedRemote) return connectedRemote;

    return explicit ?? remoteParticipants[0] ?? null;
  }, [participants, spotlightId, remoteParticipants]);

  const screenSharingParticipant = useMemo(() =>
    participants.find(p => p.screenShareTrackId || p.screenShareStream || (p.isLocal && isScreenSharing)) ?? null,
  [participants, isScreenSharing]);

  // Timer + connecting initialization
  useEffect(() => {
    startCallTimer(setDuration);
    const connectTimeout = setTimeout(() => {
      setConnecting(false);
      setParticipants(prev =>
        prev.map(p => {
          if (p.isLocal) return { ...p, status: 'connected' as const };
          if (isGroupCall && p.status === 'connecting') return { ...p, status: 'connected' as const };
          return p;
        })
      );
      if (messages.length === 0) {
        setMessages([{
          id: generateCallMessageId(),
          authorId: 'system',
          authorName: 'SkillSwap',
          body: `Encrypted call session ready: ${roomTitle}`,
          createdAt: new Date().toISOString(),
          isSystem: true,
        }]);
      }
    }, 1500);

    if (isGroupCall) {
      const remoteIds = remoteParticipants.map(p => p.id);
      startSpeakingSimulator(remoteIds, (speakingId) => {
        setParticipants(prev => prev.map(p => ({
          ...p,
          isSpeaking: p.id === speakingId && !p.isMuted,
        })));
      });
    }

    return () => {
      clearTimeout(connectTimeout);
      stopCallTimer();
      stopSpeakingSimulator();
    };
  }, [isGroupCall, roomTitle]);

  // Auto-scroll chat
  useEffect(() => {
    if (bottomPanel === 'chat' && messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, bottomPanel]);

  const toggleMute = useCallback(() => {
    if (onToggleMute) onToggleMute();
    if (!localParticipant) return;
    setParticipants(prev => prev.map(p =>
      p.isLocal ? { ...p, isMuted: !p.isMuted, isSpeaking: false } : p,
    ));
  }, [localParticipant, onToggleMute]);

  const toggleVideo = useCallback(() => {
    if (onToggleVideo) onToggleVideo();
    if (!localParticipant) return;
    setParticipants(prev => prev.map(p =>
      p.isLocal ? { ...p, isVideoOff: !p.isVideoOff } : p,
    ));
  }, [localParticipant, onToggleVideo]);

  const toggleHand = useCallback(() => {
    if (onToggleHand) onToggleHand();
    if (!localParticipant) return;
    setParticipants(prev => prev.map(p =>
      p.isLocal ? { ...p, isHandRaised: !p.isHandRaised } : p,
    ));
  }, [localParticipant, onToggleHand]);

  const handleSendReaction = useCallback((emoji: string) => {
    if (onSendReaction) {
      onSendReaction(emoji);
    } else {
      triggerFloatingReaction(emoji);
    }
    setBottomPanel('none');
  }, [onSendReaction, triggerFloatingReaction]);

  const handleSendMessage = useCallback(() => {
    if (!localParticipant || chatDraft.trim().length === 0) return;
    const text = chatDraft.trim();
    if (onSendMessage) {
      onSendMessage(text);
    } else {
      const msg: CallMessage = {
        id: generateCallMessageId(),
        authorId: localParticipant.id,
        authorName: localParticipant.name,
        body: text,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
    }
    setChatDraft('');
  }, [localParticipant, chatDraft, onSendMessage]);

  const handleSpotlight = useCallback((id: string) => {
    setSpotlightId(id);
    setLayout('spotlight');
  }, []);

  const toggleLayout = useCallback(() => {
    setLayout(prev => prev === 'grid' ? 'spotlight' : 'grid');
  }, []);

  const isMuted = localParticipant?.isMuted ?? false;
  const isVideoOff = localParticipant?.isVideoOff ?? false;
  const isHandRaised = localParticipant?.isHandRaised ?? false;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0F1D', '#0F172A', '#020617']} style={styles.gradient}>
        {/* Floating Reactions Overlay & Pop-up Toast */}
        <View pointerEvents="none" style={styles.reactionsOverlay}>
          {/* In-Call Peer Join / Leave Event Banner */}
          {callEventToast && (
            <Animated.View
              style={[
                styles.eventToast,
                callEventToast.type === 'join'
                  ? styles.eventToastJoin
                  : callEventToast.type === 'leave'
                  ? styles.eventToastLeave
                  : styles.eventToastInfo,
                {
                  opacity: callEventToastAnim,
                  transform: [
                    {
                      translateY: callEventToastAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-24, 0],
                      }),
                    },
                    {
                      scale: callEventToastAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              {callEventToast.type === 'join' ? (
                <UserCheck size={18} color="#34D399" />
              ) : callEventToast.type === 'leave' ? (
                <UserX size={18} color="#F87171" />
              ) : (
                <UsersIcon size={18} color="#818CF8" />
              )}
              <Text style={styles.eventToastText}>{callEventToast.message}</Text>
            </Animated.View>
          )}

          {/* Reaction Pop-up Toast banner */}
          {reactionToast && (
            <Animated.View
              style={[
                styles.reactionToast,
                {
                  opacity: reactionToastAnim,
                  transform: [
                    {
                      translateY: reactionToastAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-24, 0],
                      }),
                    },
                    {
                      scale: reactionToastAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.75, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.reactionToastEmoji}>{reactionToast.emoji}</Text>
              <Text style={styles.reactionToastText}>
                {reactionToast.senderName ? `${reactionToast.senderName} reacted` : 'Reaction'}
              </Text>
            </Animated.View>
          )}

          {/* Flying emojis */}
          {activeReactions.map(r => {
            const translateY = r.anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -SCREEN_HEIGHT * 0.65],
            });
            const opacity = r.anim.interpolate({
              inputRange: [0, 0.1, 0.75, 1],
              outputRange: [0, 1, 0.95, 0],
            });
            const scale = r.anim.interpolate({
              inputRange: [0, 0.2, 0.75, 1],
              outputRange: [0.5, 1.4, 1.1, 0.75],
            });

            return (
              <Animated.View
                key={r.id}
                style={[
                  styles.floatingReaction,
                  { left: r.left, transform: [{ translateY }, { scale }], opacity },
                ]}
              >
                <View style={styles.floatingEmojiBubble}>
                  <Text style={styles.floatingEmojiText}>{r.emoji}</Text>
                </View>
              </Animated.View>
            );
          })}
        </View>

        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <View style={styles.topBarLeft}>
            <View style={styles.roomBadge}>
              <Circle size={8} color="#34D399" fill="#34D399" />
              <Text style={styles.roomTitle} numberOfLines={1}>{roomTitle}</Text>
            </View>
            <Text style={styles.durationText}>
              {connecting ? 'Connecting...' : formatDuration(duration)}
            </Text>
          </View>

          <View style={styles.topBarRight}>
            {/* Network quality signal badge */}
            <View style={styles.signalBadge}>
              <Signal size={13} color="#34D399" />
              <Wifi size={13} color="#34D399" />
            </View>

            {/* Quick Switch Camera Button on Mobile */}
            {mode === 'video' && onSwitchCamera && (
              <TouchableOpacity style={styles.topBarIconBtn} onPress={onSwitchCamera} activeOpacity={0.8}>
                <SwitchCamera size={16} color="#F8FAFC" />
              </TouchableOpacity>
            )}

            {/* Participant count / Only You Status */}
            <TouchableOpacity
              style={[styles.participantCount, isOnlyOneUser && styles.onlyYouBadge]}
              onPress={() => setBottomPanel('participants')}
              activeOpacity={0.8}
            >
              {isOnlyOneUser ? (
                <>
                  <User size={13} color="#F59E0B" />
                  <Text style={styles.onlyYouBadgeText}>Only you are in the call</Text>
                </>
              ) : (
                <>
                  <UsersIcon size={14} color="#A5B4FC" />
                  <Text style={styles.participantCountText}>{participants.length}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Video Area */}
        <View style={styles.videoArea}>
          {connecting ? (
            <ConnectingView roomTitle={roomTitle} />
          ) : screenSharingParticipant ? (
            <ScreenShareView
              sharer={screenSharingParticipant}
              localParticipant={localParticipant}
              remoteParticipants={remoteParticipants}
              mode={mode}
              onSpotlight={handleSpotlight}
            />
          ) : layout === 'spotlight' && spotlightParticipant ? (
            <SpotlightView
              participant={spotlightParticipant}
              localParticipant={localParticipant}
              mode={mode}
              isGroupCall={isGroupCall}
              remoteParticipants={remoteParticipants}
              onSpotlight={handleSpotlight}
            />
          ) : (
            <GridView
              participants={participants}
              mode={mode}
              isOnlyOneUser={isOnlyOneUser}
              onSpotlight={handleSpotlight}
            />
          )}

          {/* Waiting for partner status pill */}
          {isOnlyOneUser && !connecting && (
            <View style={styles.aloneStatusOverlay} pointerEvents="none">
              <View style={styles.aloneStatusPill}>
                <View style={styles.aloneStatusDot} />
                <Text style={styles.aloneStatusTitle}>Only you are in the call</Text>
                <Text style={styles.aloneStatusSub}>Waiting for your partner to join...</Text>
              </View>
            </View>
          )}
        </View>

        {/* Bottom Drawers / Modals */}
        {bottomPanel !== 'none' && (
          <BottomPanelView
            panel={bottomPanel}
            messages={messages}
            participants={participants}
            chatDraft={chatDraft}
            isTeacher={isTeacher}
            selectedAudioDevice={selectedAudioDevice}
            availableAudioDevices={availableAudioDevices}
            onChatDraftChange={setChatDraft}
            onSendMessage={handleSendMessage}
            onSendReaction={handleSendReaction}
            onSwitchAudioOutput={onSwitchAudioOutput}
            onMuteParticipant={onMuteParticipant}
            onRemoveParticipant={onRemoveParticipant}
            onClose={() => setBottomPanel('none')}
            scrollRef={scrollRef}
            onSpotlight={handleSpotlight}
            bottomInset={insets.bottom}
          />
        )}

        {/* Controls Bar */}
        {showControls && (
          <View style={[styles.controlsBar, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.controlsRow}>
              {/* Mute toggle */}
              <CallControl
                icon={isMuted ? <MicOff size={22} color="#FFFFFF" /> : <Mic size={22} color="#FFFFFF" />}
                active={isMuted}
                onPress={toggleMute}
                label={isMuted ? 'Unmute' : 'Mute'}
              />

              {/* Video toggle */}
              {mode === 'video' && (
                <CallControl
                  icon={isVideoOff ? <VideoOff size={22} color="#FFFFFF" /> : <Video size={22} color="#FFFFFF" />}
                  active={isVideoOff}
                  onPress={toggleVideo}
                  label={isVideoOff ? 'Start Video' : 'Stop Video'}
                />
              )}

              {/* Screen share toggle */}
              {onToggleScreenShare && (
                <CallControl
                  icon={<MonitorUp size={22} color={isScreenSharing ? '#38BDF8' : '#FFFFFF'} />}
                  active={isScreenSharing}
                  onPress={onToggleScreenShare}
                  label={isScreenSharing ? 'Sharing' : 'Share'}
                  activeColor="rgba(56, 189, 248, 0.25)"
                />
              )}

              {/* Reactions trigger */}
              <CallControl
                icon={<Smile size={22} color="#FFFFFF" />}
                onPress={() => setBottomPanel('reactions')}
                label="React"
              />

              {/* Chat trigger */}
              <CallControl
                icon={<MessageSquare size={22} color="#FFFFFF" />}
                onPress={() => setBottomPanel('chat')}
                label="Chat"
                badge={messages.length > 0 ? messages.length : undefined}
              />

              {/* More options menu */}
              <CallControl
                icon={<MoreVertical size={22} color="#FFFFFF" />}
                onPress={() => setBottomPanel('more')}
                label="More"
              />

              {/* End call button */}
              <TouchableOpacity style={styles.endCallBtn} onPress={onEndCall} activeOpacity={0.85}>
                <PhoneOff size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

// ============================================================
// Sub-components: Views
// ============================================================

function ConnectingView({ roomTitle }: { roomTitle: string }) {
  return (
    <View style={styles.connectingContainer}>
      <View style={styles.connectingRing}>
        <View style={styles.connectingRingInner}>
          <Sparkles size={32} color="#818CF8" />
        </View>
      </View>
      <Text style={styles.connectingTitle}>Connecting to "{roomTitle}"</Text>
      <Text style={styles.connectingSub}>Establishing real-time WebRTC 100ms connection...</Text>
    </View>
  );
}

interface SpotlightViewProps {
  participant: CallParticipant;
  localParticipant: CallParticipant | null;
  mode: CallMode;
  isGroupCall: boolean;
  remoteParticipants: CallParticipant[];
  onSpotlight: (id: string) => void;
}

function SpotlightView({
  participant, localParticipant, mode, isGroupCall, remoteParticipants, onSpotlight,
}: SpotlightViewProps) {
  const targetRemote = !participant.isLocal ? participant : (remoteParticipants[0] ?? participant);

  return (
    <View style={styles.spotlightContainer}>
      {/* Main big box: Remote partner / class video */}
      <View style={styles.spotlightVideo}>
        <ParticipantTile
          participant={targetRemote}
          mode={mode}
          isLarge
        />
        {targetRemote.isSpeaking && (
          <View style={styles.speakingIndicator}>
            <View style={[styles.speakingDot, { backgroundColor: '#34D399' }]} />
            <Text style={styles.speakingText}>Speaking</Text>
          </View>
        )}
      </View>

      {/* Self PiP: User's own camera video ALWAYS in the small box */}
      {localParticipant && (
        <View style={styles.selfPip}>
          <ParticipantTile participant={localParticipant} mode={mode} isSmall />
        </View>
      )}

      {/* Filmstrip for group classes */}
      {isGroupCall && remoteParticipants.length > 1 && (
        <View style={styles.filmstrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filmstripContent}>
            {remoteParticipants.filter(p => p.id !== targetRemote.id).map(p => (
              <TouchableOpacity
                key={p.id}
                style={styles.filmstripTile}
                onPress={() => onSpotlight(p.id)}
                activeOpacity={0.8}
              >
                <ParticipantTile participant={p} mode={mode} isSmall />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

interface ScreenShareViewProps {
  sharer: CallParticipant;
  localParticipant: CallParticipant | null;
  remoteParticipants: CallParticipant[];
  mode: CallMode;
  onSpotlight: (id: string) => void;
}

function ScreenShareView({
  sharer, localParticipant, remoteParticipants, mode, onSpotlight,
}: ScreenShareViewProps) {
  const hasLiveScreen = Boolean(sharer.screenShareTrackId || sharer.screenShareStream);

  return (
    <View style={styles.spotlightContainer}>
      {/* Main Screen Share View */}
      <View style={styles.spotlightVideo}>
        {hasLiveScreen ? (
          <LiveVideoTrack
            trackId={sharer.screenShareTrackId}
            mediaStream={sharer.screenShareStream}
            scaleType="fit"
            style={styles.liveVideoTrack}
          />
        ) : (
          <View style={styles.screenSharePlaceholder}>
            <MonitorUp size={48} color="#38BDF8" />
            <Text style={styles.screenShareTitle}>{sharer.isLocal ? 'You are sharing your screen' : `${sharer.name} is presenting`}</Text>
          </View>
        )}

        <View style={styles.screenShareBadge}>
          <MonitorUp size={14} color="#38BDF8" />
          <Text style={styles.screenShareBadgeText}>{sharer.isLocal ? 'You are presenting' : `${sharer.name}'s screen`}</Text>
        </View>
      </View>

      {/* Self PiP */}
      {localParticipant && (
        <View style={styles.selfPip}>
          <ParticipantTile participant={localParticipant} mode={mode} isSmall />
        </View>
      )}

      {/* Ribbon of participants */}
      <View style={styles.filmstrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filmstripContent}>
          {remoteParticipants.map(p => (
            <TouchableOpacity key={p.id} style={styles.filmstripTile} onPress={() => onSpotlight(p.id)} activeOpacity={0.8}>
              <ParticipantTile participant={p} mode={mode} isSmall />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function GridView({
  participants, mode, isOnlyOneUser, onSpotlight,
}: {
  participants: CallParticipant[];
  mode: CallMode;
  isOnlyOneUser?: boolean;
  onSpotlight: (id: string) => void;
}) {
  const numColumns = isOnlyOneUser ? 1 : participants.length <= 2 ? 1 : participants.length <= 4 ? 2 : 3;

  return (
    <View style={styles.gridContainer}>
      <View style={styles.gridInner}>
        {participants.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[
              styles.gridTile,
              { width: `${100 / numColumns - 2}%` } as ViewStyle,
              isOnlyOneUser && styles.singleUserTile,
            ]}
            onPress={() => onSpotlight(p.id)}
            activeOpacity={0.85}
          >
            <ParticipantTile participant={p} mode={mode} isGrid />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ============================================================
// Participant Tile
// ============================================================

interface ParticipantTileProps {
  participant: CallParticipant;
  mode: CallMode;
  isLarge?: boolean;
  isSmall?: boolean;
  isGrid?: boolean;
}

function ParticipantTile({ participant, mode, isLarge, isSmall }: ParticipantTileProps) {
  const showVideo = mode === 'video' && !participant.isVideoOff;
  const hasLiveVideo = Boolean(participant.videoTrackId || participant.mediaStream);
  const isVideoActive = showVideo && hasLiveVideo;
  const showAvatar = !isVideoActive;
  const avatarSize = isLarge ? 80 : isSmall ? 28 : 48;

  return (
    <View style={styles.tileContainer}>
      {isVideoActive ? (
        <View style={styles.tileVideo}>
          <LiveVideoTrack
            trackId={participant.videoTrackId}
            mediaStream={participant.mediaStream}
            mirror={participant.isLocal}
            style={styles.liveVideoTrack}
          />
        </View>
      ) : (
        <View style={[styles.tileAvatarWrap, showAvatar && styles.tileAvatarWrapVisible]}>
          <LinearGradient
            colors={getAvatarGradientColors(participant.id)}
            style={styles.tileAvatarGradient}
          >
            {participant.avatarUrl && !isSmall ? (
              <Image source={{ uri: participant.avatarUrl }} style={[styles.tileAvatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]} />
            ) : (
              <Text style={[styles.tileAvatarText, { fontSize: isSmall ? 12 : 28 }]}>
                {participant.name.charAt(0).toUpperCase()}
              </Text>
            )}
            {isLarge && !participant.isLocal && (
              <Text style={styles.waitingNotice}>
                {participant.status === 'connecting' ? 'Connecting to partner...' : 'Camera is turned off'}
              </Text>
            )}
          </LinearGradient>
        </View>
      )}

      {/* Name label */}
      {!isSmall && (
        <View style={styles.tileNameWrap}>
          {participant.isMuted && <MicOff size={11} color="rgba(255,255,255,0.7)" />}
          {participant.isHandRaised && <Hand size={11} color="#F59E0B" />}
          <Text style={styles.tileName} numberOfLines={1}>
            {participant.isLocal ? 'You' : participant.name}
          </Text>
          {participant.role === 'teacher' && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Host</Text>
            </View>
          )}
        </View>
      )}

      {/* Small tile badge */}
      {isSmall && (
        <View style={styles.smallTileBadge}>
          {participant.isMuted && <MicOff size={9} color="#FFFFFF" />}
        </View>
      )}

      {/* Speaking border */}
      {participant.isSpeaking && (
        <View style={[styles.speakingBorder, { borderColor: '#34D399' }]} />
      )}
    </View>
  );
}

// ============================================================
// Bottom Panel (Chat, People, Reactions, More)
// ============================================================

interface BottomPanelViewProps {
  panel: BottomPanel;
  messages: CallMessage[];
  participants: CallParticipant[];
  chatDraft: string;
  isTeacher?: boolean;
  selectedAudioDevice?: AudioDevice;
  availableAudioDevices?: string[];
  onChatDraftChange: (text: string) => void;
  onSendMessage: () => void;
  onSendReaction?: (emoji: string) => void;
  onSwitchAudioOutput?: (device: AudioDevice) => void;
  onMuteParticipant?: (id: string) => void;
  onRemoveParticipant?: (id: string) => void;
  onClose: () => void;
  scrollRef: React.RefObject<ScrollView | null>;
  onSpotlight: (id: string) => void;
  bottomInset: number;
}

function BottomPanelView({
  panel,
  messages,
  participants,
  chatDraft,
  isTeacher,
  selectedAudioDevice,
  availableAudioDevices = [],
  onChatDraftChange,
  onSendMessage,
  onSendReaction,
  onSwitchAudioOutput,
  onMuteParticipant,
  onRemoveParticipant,
  onClose,
  scrollRef,
  bottomInset,
}: BottomPanelViewProps) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.bottomPanelContainer, { maxHeight: SCREEN_HEIGHT * 0.65 }]}
    >
      <View style={styles.bottomPanelHeader}>
        <Text style={styles.bottomPanelTitle}>
          {panel === 'chat' && 'In-Call Messages'}
          {panel === 'participants' && `Participants (${participants.length})`}
          {panel === 'reactions' && 'Send Reaction'}
          {panel === 'more' && 'Call Options'}
          {panel === 'audioDevices' && 'Audio Output'}
        </Text>
        <TouchableOpacity style={styles.panelCloseBtn} onPress={onClose}>
          <ChevronDown size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* 1. In-Call Chat */}
      {panel === 'chat' && (
        <View style={styles.chatWrap}>
          <ScrollView
            ref={scrollRef as any}
            style={{ flex: 1 }}
            contentContainerStyle={styles.chatListContent}
            onContentSizeChange={() => {
              (scrollRef as any)?.current?.scrollToEnd?.({ animated: true });
            }}
          >
            {(messages || []).map((item, idx) => {
              if (!item) return null;
              const isSystem = item.authorId === 'system' || item.isSystem;
              const authorName = item.authorName || 'Participant';
              const body = typeof item.body === 'string'
                ? item.body
                : (typeof (item as any).message === 'string'
                  ? (item as any).message
                  : typeof (item as any).text === 'string'
                    ? (item as any).text
                    : String(item.body || ''));
              return (
                <View
                  key={item.id || `msg-${idx}-${item.createdAt || ''}`}
                  style={[
                    styles.chatBubble,
                    isSystem ? styles.chatBubbleSystem : styles.chatBubbleUser,
                  ]}
                >
                  {!isSystem && (
                    <Text style={styles.chatAuthor}>{authorName}</Text>
                  )}
                  <Text style={styles.chatBody}>{body}</Text>
                </View>
              );
            })}
          </ScrollView>
          <View style={[styles.chatInputRow, { paddingBottom: Math.max(bottomInset, 12) }]}>
            <TextInput
              style={styles.chatInput}
              value={chatDraft}
              onChangeText={onChatDraftChange}
              placeholder="Type message to room..."
              placeholderTextColor="#64748B"
              returnKeyType="send"
              onSubmitEditing={onSendMessage}
            />
            <TouchableOpacity style={styles.chatSendBtn} onPress={onSendMessage}>
              <Send size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 2. Participants List & Host Moderation */}
      {panel === 'participants' && (
        <ScrollView style={styles.peopleList} contentContainerStyle={{ paddingBottom: bottomInset + 16 }}>
          {(participants || []).map((p, idx) => {
            if (!p) return null;
            const displayName = p.name || (p.isLocal ? 'You' : 'Participant');
            const initial = displayName.charAt(0).toUpperCase() || 'U';
            return (
              <View key={p.id || `participant-${idx}`} style={styles.personRow}>
                <View style={styles.personAvatarWrap}>
                  <Text style={styles.personAvatarText}>{initial}</Text>
                </View>
                <View style={styles.personInfo}>
                  <View style={styles.personNameRow}>
                    <Text style={styles.personName}>{p.isLocal ? `${displayName} (You)` : displayName}</Text>
                    {p.role === 'teacher' && <View style={styles.personBadge}><Text style={styles.personBadgeText}>Host</Text></View>}
                  </View>
                  <Text style={styles.personStatus}>{p.status === 'connected' ? 'In Call' : 'Connecting...'}</Text>
                </View>

                <View style={styles.personActions}>
                {p.isMuted && <MicOff size={16} color="#94A3B8" style={{ marginRight: 8 }} />}
                {isTeacher && !p.isLocal && (
                  <>
                    {onMuteParticipant && (
                      <TouchableOpacity style={styles.hostActionBtn} onPress={() => onMuteParticipant(p.id)}>
                        <VolumeX size={16} color="#F87171" />
                      </TouchableOpacity>
                    )}
                    {onRemoveParticipant && (
                      <TouchableOpacity style={styles.hostActionBtn} onPress={() => onRemoveParticipant(p.id)}>
                        <UserMinus size={16} color="#F87171" />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </View>
          );
        })}
        </ScrollView>
      )}

      {/* 3. Reaction Picker */}
      {panel === 'reactions' && (
        <View style={[styles.reactionsPickerWrap, { paddingBottom: bottomInset + 20 }]}>
          <Text style={styles.reactionsPrompt}>Tap to send an instant reaction:</Text>
          <View style={styles.reactionGrid}>
            {REACTION_EMOJIS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionEmojiBtn}
                onPress={() => onSendReaction && onSendReaction(emoji)}
                activeOpacity={0.7}
              >
                <Text style={styles.reactionEmojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* 4. More Options Menu */}
      {panel === 'more' && (
        <View style={[styles.moreMenuWrap, { paddingBottom: bottomInset + 20 }]}>
          <TouchableOpacity style={styles.menuRow} onPress={() => onClose()}>
            <ShieldCheck size={20} color="#34D399" />
            <Text style={styles.menuText}>End-to-End Encrypted Session</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ============================================================
// Controls Button Helper
// ============================================================

function CallControl({
  icon, label, active = false, onPress, badge, activeColor = 'rgba(239, 68, 68, 0.25)',
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onPress: () => void;
  badge?: number;
  activeColor?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.controlBtn, active && { backgroundColor: activeColor, borderColor: 'rgba(239,68,68,0.5)' }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.controlIconWrap}>
        {icon}
        {badge !== undefined && (
          <View style={styles.controlBadge}>
            <Text style={styles.controlBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.controlLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function getAvatarGradientColors(id: string): [string, string] {
  const gradients: [string, string][] = [
    ['#3B82F6', '#1E40AF'],
    ['#8B5CF6', '#5B21B6'],
    ['#EC4899', '#9D174D'],
    ['#10B981', '#065F46'],
    ['#F59E0B', '#B45309'],
  ];
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return gradients[sum % gradients.length];
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F1D' },
  gradient: { flex: 1 },

  // Floating Reactions
  reactionsOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 80,
  },
  reactionToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.45)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
  },
  reactionToastEmoji: {
    fontSize: 22,
  },
  reactionToastText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  floatingReaction: {
    position: 'absolute',
    bottom: 140,
  },
  floatingEmojiBubble: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 32,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  floatingEmojiText: {
    fontSize: 44,
  },

  // Event Toasts (Peer joined / left)
  eventToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 14,
    marginBottom: 8,
  },
  eventToastJoin: {
    borderColor: 'rgba(52, 211, 153, 0.6)',
    backgroundColor: 'rgba(6, 78, 59, 0.85)',
  },
  eventToastLeave: {
    borderColor: 'rgba(248, 113, 113, 0.6)',
    backgroundColor: 'rgba(127, 29, 29, 0.85)',
  },
  eventToastInfo: {
    borderColor: 'rgba(129, 140, 248, 0.6)',
    backgroundColor: 'rgba(30, 27, 75, 0.85)',
  },
  eventToastText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700' as const,
  },

  // Only You Badge in TopBar
  onlyYouBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderWidth: 1,
  },
  onlyYouBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FDE68A',
  },

  // Alone Status Overlay in Video Area
  aloneStatusOverlay: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  aloneStatusPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  aloneStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  aloneStatusTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  aloneStatusSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500' as const,
  },
  singleUserTile: {
    width: '100%',
    height: '100%',
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    maxWidth: SCREEN_WIDTH * 0.45,
  },
  roomTitle: { fontSize: 13, fontWeight: '700', color: '#F8FAFC' },
  durationText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  signalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
  },
  topBarIconBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
  },
  participantCountText: { fontSize: 12, fontWeight: '700', color: '#A5B4FC' },

  // Video Area
  videoArea: { flex: 1, paddingHorizontal: 12, paddingBottom: 8 },

  // Connecting
  connectingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  connectingRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectingRingInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectingTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  connectingSub: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  // Spotlight layout
  spotlightContainer: { flex: 1, position: 'relative' },
  spotlightVideo: { flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#1E293B' },
  selfPip: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 105,
    height: 145,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 20,
  },
  filmstrip: { position: 'absolute', top: 12, left: 12, right: 12, zIndex: 15 },
  filmstripContent: { gap: 8 },
  filmstripTile: { width: 85, height: 110, borderRadius: 12, overflow: 'hidden' },

  // Screen Share layout
  screenSharePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#0F172A',
  },
  screenShareTitle: { fontSize: 16, fontWeight: '700', color: '#F8FAFC' },
  screenShareBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  screenShareBadgeText: { fontSize: 12, fontWeight: '600', color: '#38BDF8' },

  // Grid layout
  gridContainer: { flex: 1 },
  gridInner: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridTile: { flex: 1, minHeight: 180, borderRadius: 16, overflow: 'hidden' },

  // Participant tile
  tileContainer: { flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#1E293B', position: 'relative' },
  tileVideo: { flex: 1, position: 'relative' },
  liveVideoTrack: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  tileVideoGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileVideoInitial: { fontSize: 48, fontWeight: '800', color: 'rgba(255,255,255,0.15)' },
  tileAvatarWrap: { flex: 1, display: 'none' },
  tileAvatarWrapVisible: { display: 'flex' },
  tileAvatarGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileAvatar: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  tileAvatarText: { fontWeight: '700', color: '#FFFFFF' },
  waitingNotice: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 12, textAlign: 'center', paddingHorizontal: 16 },
  tileNameWrap: {
    position: 'absolute', bottom: 8, left: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  tileName: { fontSize: 12, fontWeight: '600', color: '#FFFFFF', flex: 1 },
  roleBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.8)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  smallTileBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: 2 },
  speakingBorder: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, borderWidth: 2, borderRadius: 20 },
  speakingIndicator: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  speakingDot: { width: 8, height: 8, borderRadius: 4 },
  speakingText: { fontSize: 11, fontWeight: '700', color: '#34D399' },

  // Controls bar
  controlsBar: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 14,
    paddingHorizontal: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 14,
    minWidth: 46,
  },
  controlIconWrap: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLabel: { fontSize: 10, color: 'rgba(255, 255, 255, 0.75)', fontWeight: '600' },
  controlBadge: {
    position: 'absolute', top: -3, right: -3,
    backgroundColor: '#6366F1',
    borderRadius: 9, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  controlBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
  endCallBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },

  // Bottom Panel
  bottomPanelContainer: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  bottomPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  bottomPanelTitle: { fontSize: 16, fontWeight: '700', color: '#F8FAFC' },
  panelCloseBtn: { padding: 4 },

  // Chat
  chatWrap: { height: 320 },
  chatListContent: { padding: 14, gap: 10 },
  chatBubble: { maxWidth: '80%', padding: 10, borderRadius: 14 },
  chatBubbleUser: { backgroundColor: '#334155', alignSelf: 'flex-start' },
  chatBubbleSystem: { backgroundColor: 'rgba(99, 102, 241, 0.2)', alignSelf: 'center' },
  chatAuthor: { fontSize: 11, fontWeight: '700', color: '#A5B4FC', marginBottom: 2 },
  chatBody: { fontSize: 13, color: '#F8FAFC' },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0F172A',
  },
  chatInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 13,
  },
  chatSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // People List
  peopleList: { paddingHorizontal: 14, paddingTop: 10 },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  personAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  personAvatarText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  personInfo: { flex: 1 },
  personNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  personName: { fontSize: 14, fontWeight: '600', color: '#F8FAFC' },
  personBadge: { backgroundColor: 'rgba(99, 102, 241, 0.25)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  personBadgeText: { fontSize: 10, fontWeight: '700', color: '#A5B4FC' },
  personStatus: { fontSize: 11, color: '#64748B' },
  personActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hostActionBtn: {
    padding: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 8,
  },

  // Reaction Picker
  reactionsPickerWrap: { padding: 18, alignItems: 'center' },
  reactionsPrompt: { fontSize: 13, color: '#94A3B8', marginBottom: 14 },
  reactionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  reactionEmojiBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmojiText: { fontSize: 28 },

  // More Menu
  moreMenuWrap: { padding: 18, gap: 14 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  menuText: { fontSize: 14, fontWeight: '600', color: '#F8FAFC' },
});
