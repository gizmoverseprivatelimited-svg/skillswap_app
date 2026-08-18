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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Users as UsersIcon,
  Hand, Send, Wifi, Signal, Volume2, Grid3x3, Maximize2,
  ChevronDown, Circle, Sparkles,
} from 'lucide-react-native';
import {
  type CallParticipant, type CallMessage, type CallMode,
  formatDuration, startCallTimer, stopCallTimer,
  startSpeakingSimulator, stopSpeakingSimulator, generateCallMessageId,
} from '../lib/call-engine';
import LiveVideoTrack from './LiveVideoTrack';

interface CallScreenProps {
  participants: CallParticipant[];
  roomTitle: string;
  mode: CallMode;
  isGroupCall: boolean;
  onEndCall: () => void;
  onToggleMute?: () => void;
  onToggleVideo?: () => void;
  onSendMessage?: (text: string) => void;
  externalMessages?: CallMessage[];
}

type BottomPanel = 'none' | 'chat' | 'participants';

export default function CallScreen({
  participants: initialParticipants,
  roomTitle,
  mode,
  isGroupCall,
  onEndCall,
  onToggleMute,
  onToggleVideo,
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
  const [connecting, setConnecting] = useState(true);
  const scrollRef = useRef<FlatList>(null);

  // Sync participants from parent when updated by 100ms / WebRTC
  useEffect(() => {
    if (initialParticipants && initialParticipants.length > 0) {
      setParticipants(initialParticipants);
    }
  }, [initialParticipants]);

  // Sync external messages
  useEffect(() => {
    if (externalMessages && externalMessages.length > 0) {
      setMessages(externalMessages);
    }
  }, [externalMessages]);

  const localParticipant = useMemo(() => participants.find(p => p.isLocal) ?? null, [participants]);
  const remoteParticipants = useMemo(() => participants.filter(p => !p.isLocal), [participants]);
  const spotlightParticipant = useMemo(() =>
    participants.find(p => p.id === spotlightId) ?? remoteParticipants[0] ?? null,
  [participants, spotlightId, remoteParticipants]);

  const unreadCount = useMemo(() => 0, []);

  // Timer + connecting simulation
  useEffect(() => {
    startCallTimer(setDuration);
    const connectTimeout = setTimeout(() => {
      setConnecting(false);
      setParticipants(prev => prev.map(p => p.status === 'connecting' ? { ...p, status: 'connected' as const } : p));
      if (isGroupCall && messages.length === 0) {
        setMessages([{
          id: generateCallMessageId(),
          authorId: 'system',
          authorName: 'leteski',
          body: `Welcome to ${roomTitle}. The call has started.`,
          createdAt: new Date().toISOString(),
          isSystem: true,
        }]);
      }
    }, 1500);

    const remoteIds = remoteParticipants.map(p => p.id);
    startSpeakingSimulator(remoteIds, (speakingId) => {
      setParticipants(prev => prev.map(p => ({
        ...p,
        isSpeaking: p.id === speakingId && !p.isMuted,
      })));
    });

    return () => {
      clearTimeout(connectTimeout);
      stopCallTimer();
      stopSpeakingSimulator();
    };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (bottomPanel === 'chat' && messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, bottomPanel]);

  const toggleMute = useCallback(() => {
    if (onToggleMute) {
      onToggleMute();
    }
    if (!localParticipant) return;
    setParticipants(prev => prev.map(p =>
      p.isLocal ? { ...p, isMuted: !p.isMuted, isSpeaking: false } : p,
    ));
  }, [localParticipant, onToggleMute]);

  const toggleVideo = useCallback(() => {
    if (onToggleVideo) {
      onToggleVideo();
    }
    if (!localParticipant) return;
    setParticipants(prev => prev.map(p =>
      p.isLocal ? { ...p, isVideoOff: !p.isVideoOff } : p,
    ));
  }, [localParticipant, onToggleVideo]);

  const toggleHand = useCallback(() => {
    if (!localParticipant) return;
    setParticipants(prev => prev.map(p =>
      p.isLocal ? { ...p, isHandRaised: !p.isHandRaised } : p,
    ));
  }, [localParticipant]);

  const handleSendMessage = useCallback(() => {
    if (!localParticipant || chatDraft.trim().length === 0) return;
    const text = chatDraft.trim();
    if (onSendMessage) {
      onSendMessage(text);
    }
    const msg: CallMessage = {
      id: generateCallMessageId(),
      authorId: localParticipant.id,
      authorName: localParticipant.name,
      body: text,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);
    setChatDraft('');
  }, [localParticipant, chatDraft, onSendMessage]);

  const handleSpotlight = useCallback((id: string) => {
    setSpotlightId(id);
    setLayout('spotlight');
  }, []);

  const toggleLayout = useCallback(() => {
    setLayout(prev => prev === 'grid' ? 'spotlight' : 'grid');
  }, []);

  const togglePanel = useCallback((panel: BottomPanel) => {
    setBottomPanel(prev => prev === panel ? 'none' : panel);
  }, []);

  const isMuted = localParticipant?.isMuted ?? false;
  const isVideoOff = localParticipant?.isVideoOff ?? false;
  const isHandRaised = localParticipant?.isHandRaised ?? false;
  const showControls = true;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0B1120', '#1E293B', '#0F172A']}
        locations={[0, 0.5, 1]}
        style={styles.background}
      >
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
            <View style={styles.signalBadge}>
              <Signal size={14} color="#34D399" />
              <Wifi size={14} color="#34D399" />
            </View>
            {isGroupCall && (
              <View style={styles.participantCount}>
                <UsersIcon size={14} color="#A5B4FC" />
                <Text style={styles.participantCountText}>{participants.length}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Main video area */}
        <View style={styles.videoArea}>
          {connecting ? (
            <ConnectingView roomTitle={roomTitle} />
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
            <GridView participants={participants} mode={mode} onSpotlight={handleSpotlight} />
          )}
        </View>

        {/* Bottom panel */}
        {bottomPanel !== 'none' && (
          <BottomPanelView
            panel={bottomPanel}
            messages={messages}
            participants={participants}
            chatDraft={chatDraft}
            onChatDraftChange={setChatDraft}
            onSendMessage={handleSendMessage}
            onClose={() => setBottomPanel('none')}
            scrollRef={scrollRef}
            onSpotlight={handleSpotlight}
            bottomInset={insets.bottom}
          />
        )}

        {/* Controls bar */}
        {showControls && (
          <View style={[styles.controlsBar, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.controlsRow}>
              <CallControl
                icon={isMuted ? <MicOff size={22} color="#FFFFFF" /> : <Mic size={22} color="#FFFFFF" />}
                active={isMuted}
                onPress={toggleMute}
                label={isMuted ? 'Unmute' : 'Mute'}
              />
              {mode === 'video' && (
                <CallControl
                  icon={isVideoOff ? <VideoOff size={22} color="#FFFFFF" /> : <Video size={22} color="#FFFFFF" />}
                  active={isVideoOff}
                  onPress={toggleVideo}
                  label={isVideoOff ? 'Camera' : 'Video'}
                />
              )}
              {isGroupCall && (
                <>
                  <CallControl
                    icon={<Hand size={22} color={isHandRaised ? '#F59E0B' : '#FFFFFF'} />}
                    active={isHandRaised}
                    onPress={toggleHand}
                    label="Raise"
                    activeColor="rgba(245, 158, 11, 0.25)"
                  />
                  <CallControl
                    icon={<MessageSquare size={22} color="#FFFFFF" />}
                    onPress={() => togglePanel('chat')}
                    label="Chat"
                    badge={unreadCount > 0 ? unreadCount : undefined}
                  />
                  <CallControl
                    icon={<UsersIcon size={22} color="#FFFFFF" />}
                    onPress={() => togglePanel('participants')}
                    label="People"
                    badge={participants.length}
                  />
                </>
              )}
              {isGroupCall && (
                <CallControl
                  icon={layout === 'grid' ? <Maximize2 size={20} color="#FFFFFF" /> : <Grid3x3 size={20} color="#FFFFFF" />}
                  onPress={toggleLayout}
                  label={layout === 'grid' ? 'Spotlight' : 'Grid'}
                />
              )}
              <TouchableOpacity style={styles.endCallBtn} onPress={onEndCall} activeOpacity={0.85}>
                <PhoneOff size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

// ============================================================
// Sub-components
// ============================================================

function ConnectingView({ roomTitle }: { roomTitle: string }) {
  return (
    <View style={styles.connectingContainer}>
      <View style={styles.connectingRing}>
        <View style={styles.connectingRingInner}>
          <Sparkles size={32} color="#818CF8" />
        </View>
      </View>
      <Text style={styles.connectingTitle}>Joining "{roomTitle}"</Text>
      <Text style={styles.connectingSub}>Setting up encrypted connection...</Text>
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
  // Main video is always the remote partner (or selected remote participant in group calls)
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
        {/* Speaking indicator */}
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

      {/* Filmstrip for group calls */}
      {isGroupCall && remoteParticipants.length > 1 && (
        <View style={styles.filmstrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filmstripContent}>
            {remoteParticipants.filter(p => p.id !== participant.id).map(p => (
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

function GridView({
  participants, mode, onSpotlight,
}: {
  participants: CallParticipant[];
  mode: CallMode;
  onSpotlight: (id: string) => void;
}) {
  const numColumns = participants.length <= 4 ? 2 : 3;
  return (
    <View style={styles.gridContainer}>
      <View style={styles.gridInner}>
        {participants.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[styles.gridTile, { width: `${100 / numColumns - 2}%` } as ViewStyle]}
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

interface ParticipantTileProps {
  participant: CallParticipant;
  mode: CallMode;
  isLarge?: boolean;
  isSmall?: boolean;
  isGrid?: boolean;
}

function ParticipantTile({ participant, mode, isLarge, isSmall }: ParticipantTileProps) {
  const showVideo = mode === 'video' && !participant.isVideoOff;
  const showAvatar = !showVideo || participant.status === 'connecting';
  const avatarSize = isLarge ? 80 : isSmall ? 28 : 48;
  const hasLiveVideo = Boolean(participant.videoTrackId || participant.mediaStream);

  return (
    <View style={styles.tileContainer}>
      {showVideo && participant.status === 'connected' ? (
        <View style={styles.tileVideo}>
          {hasLiveVideo ? (
            <LiveVideoTrack
              trackId={participant.videoTrackId}
              mediaStream={participant.mediaStream}
              mirror={participant.isLocal}
              style={styles.liveVideoTrack}
            />
          ) : (
            <LinearGradient
              colors={getAvatarGradientColors(participant.id)}
              style={styles.tileVideoGradient}
            >
              <Text style={styles.tileVideoInitial}>
                {participant.name.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          )}
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
                {participant.status === 'connecting' ? 'Waiting for partner to connect...' : 'Camera is turned off'}
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

      {/* Small tile indicator */}
      {isSmall && (
        <View style={styles.smallTileBadge}>
          {participant.isMuted && <MicOff size={9} color="#FFFFFF" />}
        </View>
      )}

      {/* Speaking border */}
      {participant.isSpeaking && (
        <View style={[styles.speakingBorder, { borderColor: '#34D399' }]} />
      )}

      {/* Connecting overlay */}
      {participant.status === 'connecting' && (
        <View style={styles.connectingOverlay}>
          <Text style={styles.connectingOverlayText}>...</Text>
        </View>
      )}
    </View>
  );
}

interface BottomPanelViewProps {
  panel: BottomPanel;
  messages: CallMessage[];
  participants: CallParticipant[];
  chatDraft: string;
  onChatDraftChange: (text: string) => void;
  onSendMessage: () => void;
  onClose: () => void;
  scrollRef: React.RefObject<FlatList<any> | null>;
  onSpotlight: (id: string) => void;
  bottomInset: number;
}

function BottomPanelView({
  panel, messages, participants, chatDraft, onChatDraftChange, onSendMessage, onClose,
  scrollRef, onSpotlight, bottomInset,
}: BottomPanelViewProps) {
  return (
    <View style={[styles.bottomPanel, { paddingBottom: bottomInset + 80 }]}>
      <View style={styles.bottomPanelHeader}>
        <Text style={styles.bottomPanelTitle}>
          {panel === 'chat' ? 'In-call messages' : `Participants (${participants.length})`}
        </Text>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
          <ChevronDown size={22} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {panel === 'chat' ? (
        <>
          <FlatList
            ref={scrollRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ChatMessageItem message={item} />}
            contentContainerStyle={styles.chatList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.chatEmpty}>
                <MessageSquare size={32} color="rgba(148,163,184,0.3)" />
                <Text style={styles.chatEmptyText}>No messages yet. Start the conversation!</Text>
              </View>
            }
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Type a message..."
                value={chatDraft}
                onChangeText={onChatDraftChange}
                placeholderTextColor="rgba(148,163,184,0.5)"
                multiline={false}
              />
              <TouchableOpacity style={styles.chatSendBtn} onPress={onSendMessage} activeOpacity={0.8}>
                <Send size={18} color="#0B1120" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </>
      ) : (
        <FlatList
          data={participants}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ParticipantRow participant={item} onSpotlight={onSpotlight} />
          )}
          contentContainerStyle={styles.participantList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function ChatMessageItem({ message }: { message: CallMessage }) {
  if (message.isSystem) {
    return (
      <View style={styles.systemMessage}>
        <Text style={styles.systemMessageText}>{message.body}</Text>
      </View>
    );
  }
  return (
    <View style={styles.chatMessage}>
      <Text style={styles.chatMessageAuthor}>{message.authorName}</Text>
      <Text style={styles.chatMessageBody}>{message.body}</Text>
      <Text style={styles.chatMessageTime}>
        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
}

function ParticipantRow({
  participant, onSpotlight,
}: {
  participant: CallParticipant;
  onSpotlight: (id: string) => void;
}) {
  return (
    <TouchableOpacity style={styles.participantRow} onPress={() => onSpotlight(participant.id)} activeOpacity={0.7}>
      <View style={styles.participantRowAvatar}>
        {participant.avatarUrl ? (
          <Image source={{ uri: participant.avatarUrl }} style={styles.participantRowAvatarImg} />
        ) : (
          <LinearGradient colors={getAvatarGradientColors(participant.id)} style={styles.participantRowAvatarGradient}>
            <Text style={styles.participantRowAvatarText}>{participant.name.charAt(0).toUpperCase()}</Text>
          </LinearGradient>
        )}
      </View>
      <View style={styles.participantRowInfo}>
        <Text style={styles.participantRowName}>
          {participant.isLocal ? 'You' : participant.name}
        </Text>
        <Text style={styles.participantRowRole}>
          {participant.role === 'teacher' || participant.role === 'host' ? 'Host' : 'Participant'}
        </Text>
      </View>
      <View style={styles.participantRowBadges}>
        {participant.isSpeaking && (
          <View style={styles.speakingBadgeSmall}>
            <Volume2 size={12} color="#34D399" />
          </View>
        )}
        {participant.isHandRaised && (
          <View style={styles.handRaisedBadge}>
            <Hand size={12} color="#F59E0B" />
          </View>
        )}
        {participant.isMuted && <MicOff size={16} color="rgba(148,163,184,0.5)" />}
        {participant.isVideoOff && <VideoOff size={16} color="rgba(148,163,184,0.5)" />}
      </View>
    </TouchableOpacity>
  );
}

// ============================================================
// Call control button
// ============================================================

interface CallControlProps {
  icon: React.ReactNode;
  onPress: () => void;
  label: string;
  active?: boolean;
  activeColor?: string;
  badge?: number;
}

function CallControl({ icon, onPress, label, active, activeColor, badge }: CallControlProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.callControlWrap}>
      <View style={[
        styles.callControlBtn,
        active && { backgroundColor: activeColor ?? 'rgba(239, 68, 68, 0.25)' },
      ]}>
        {icon}
        {badge !== undefined && badge > 0 && (
          <View style={styles.controlBadge}>
            <Text style={styles.controlBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.callControlLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ============================================================
// Helpers
// ============================================================

const GRADIENTS: [string, string][] = [
  ['#6366F1', '#4F46E5'],
  ['#8B5CF6', '#6D28D9'],
  ['#EC4899', '#BE185D'],
  ['#F59E0B', '#D97706'],
  ['#10B981', '#059669'],
  ['#06B6D4', '#0891B2'],
  ['#3B82F6', '#1D4ED8'],
  ['#EF4444', '#B91C1C'],
];

function getAvatarGradientColors(id: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  background: { flex: 1 },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  roomBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
  },
  roomTitle: { fontSize: 13, fontWeight: '700' as const, color: '#E2E8F0', maxWidth: 160 },
  durationText: { fontSize: 14, fontWeight: '600' as const, color: '#94A3B8' },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  signalBadge: {
    flexDirection: 'row', gap: 4,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10,
  },
  participantCount: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10,
  },
  participantCountText: { fontSize: 12, fontWeight: '700' as const, color: '#A5B4FC' },

  // Video area
  videoArea: { flex: 1, paddingHorizontal: 12 },

  // Connecting
  connectingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  connectingRing: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: 'rgba(99, 102, 241, 0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  connectingRingInner: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  connectingTitle: { fontSize: 18, fontWeight: '700' as const, color: '#E2E8F0' },
  connectingSub: { fontSize: 14, color: '#64748B' },

  // Spotlight
  spotlightContainer: { flex: 1, gap: 8 },
  spotlightVideo: {
    flex: 1, borderRadius: 20, overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  speakingIndicator: {
    position: 'absolute' as const, top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
  },
  speakingDot: { width: 8, height: 8, borderRadius: 4 },
  speakingText: { fontSize: 12, fontWeight: '700' as const, color: '#34D399' },
  selfPip: {
    position: 'absolute' as const, bottom: 12, right: 12,
    width: 110, height: 160, borderRadius: 16,
    overflow: 'hidden' as const,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 10,
  },
  filmstrip: { height: 90 },
  filmstripContent: { gap: 8, paddingHorizontal: 4 },
  filmstripTile: { width: 120, height: 80, borderRadius: 12, overflow: 'hidden' as const },

  // Grid
  gridContainer: { flex: 1, padding: 4 },
  gridInner: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 8 },
  gridTile: { aspectRatio: 1, borderRadius: 14, overflow: 'hidden' as const },

  // Participant tile
  tileContainer: { flex: 1, borderRadius: 20, overflow: 'hidden' as const, backgroundColor: '#1E293B', position: 'relative' as const },
  tileVideo: { flex: 1, position: 'relative' as const },
  liveVideoTrack: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
  tileVideoGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileVideoInitial: { fontSize: 48, fontWeight: '800' as const, color: 'rgba(255,255,255,0.15)' },
  tileAvatarWrap: { flex: 1, display: 'none' as const },
  tileAvatarWrapVisible: { display: 'flex' as const },
  tileAvatarGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileAvatar: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  tileAvatarText: { fontWeight: '700' as const, color: '#FFFFFF' },
  waitingNotice: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 12, textAlign: 'center' as const, paddingHorizontal: 16 },
  tileNameWrap: {
    position: 'absolute' as const, bottom: 8, left: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  tileName: { fontSize: 12, fontWeight: '600' as const, color: '#FFFFFF', flex: 1 },
  roleBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.8)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  roleBadgeText: { fontSize: 9, fontWeight: '700' as const, color: '#FFFFFF' },
  smallTileBadge: {
    position: 'absolute' as const, bottom: 4, right: 4,
    flexDirection: 'row', gap: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4, paddingVertical: 2, borderRadius: 6,
  },
  speakingBorder: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 3, borderRadius: 20,
  },
  connectingOverlay: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  connectingOverlayText: { fontSize: 24, fontWeight: '700' as const, color: '#64748B' },

  // Bottom panel
  bottomPanel: {
    position: 'absolute' as const, bottom: 0, left: 0, right: 0,
    height: 340,
    backgroundColor: 'rgba(15, 23, 42, 0.97)',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.15)',
    paddingTop: 8,
  },
  bottomPanelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(99, 102, 241, 0.1)',
  },
  bottomPanelTitle: { fontSize: 16, fontWeight: '700' as const, color: '#E2E8F0' },

  // Chat
  chatList: { padding: 16, gap: 12 },
  chatEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12 },
  chatEmptyText: { fontSize: 14, color: '#64748B', textAlign: 'center' as const },
  chatMessage: { gap: 4 },
  chatMessageAuthor: { fontSize: 13, fontWeight: '700' as const, color: '#A5B4FC' },
  chatMessageBody: { fontSize: 14, color: '#E2E8F0', lineHeight: 20 },
  chatMessageTime: { fontSize: 11, color: '#475569' },
  systemMessage: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    alignItems: 'center' as const,
  },
  systemMessageText: { fontSize: 13, color: '#94A3B8', textAlign: 'center' as const },
  chatInputRow: {
    flexDirection: 'row', gap: 10, padding: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(99, 102, 241, 0.1)',
  },
  chatInput: {
    flex: 1, backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, color: '#E2E8F0', borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.15)',
  },
  chatSendBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center',
  },

  // Participants list
  participantList: { padding: 16, gap: 8 },
  participantRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14,
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
  },
  participantRowAvatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' as const },
  participantRowAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  participantRowAvatarGradient: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  participantRowAvatarText: { fontSize: 16, fontWeight: '700' as const, color: '#FFFFFF' },
  participantRowInfo: { flex: 1, gap: 2 },
  participantRowName: { fontSize: 14, fontWeight: '600' as const, color: '#E2E8F0' },
  participantRowRole: { fontSize: 12, color: '#64748B' },
  participantRowBadges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  speakingBadgeSmall: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  handRaisedBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },

  // Controls
  controlsBar: {
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: 'rgba(11, 17, 32, 0.8)',
    borderTopWidth: 1, borderTopColor: 'rgba(99, 102, 241, 0.1)',
  },
  controlsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  callControlWrap: { alignItems: 'center', gap: 4 },
  callControlBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.15)',
  },
  callControlLabel: { fontSize: 10, fontWeight: '600' as const, color: '#94A3B8' },
  controlBadge: {
    position: 'absolute' as const, top: -4, right: -4,
    backgroundColor: '#6366F1',
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  controlBadgeText: { fontSize: 10, fontWeight: '700' as const, color: '#FFFFFF' },
  endCallBtn: {
    width: 60, height: 52, borderRadius: 26,
    backgroundColor: '#DC2626',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 6,
  },
});
