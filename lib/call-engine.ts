import type { User } from '../types';

export type CallRole = 'host' | 'guest' | 'teacher' | 'student';
export type CallMode = 'video' | 'voice';
export type ParticipantStatus = 'connecting' | 'connected' | 'disconnected' | 'hand_raised' | 'muted' | 'video_off';
export type CallLayout = 'grid' | 'spotlight' | 'screenshare';

export type AudioDevice = 'SPEAKER_PHONE' | 'EARPIECE' | 'WIRED_HEADSET' | 'BLUETOOTH' | 'AUTOMATIC';

export interface CallParticipant {
  id: string;
  name: string;
  avatarUrl: string;
  role: CallRole;
  isLocal: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isHandRaised: boolean;
  isSpeaking: boolean;
  status: ParticipantStatus;
  joinedAt: string;
  videoTrackId?: string;
  screenShareTrackId?: string;
  mediaStream?: any;
  screenShareStream?: any;
  networkQuality?: number; // 0 to 5 (5 is best)
}

export interface CallMessage {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  isSystem?: boolean;
}

export interface CallReaction {
  id: string;
  emoji: string;
  senderName: string;
  timestamp: number;
}

export interface CallState {
  participants: CallParticipant[];
  messages: CallMessage[];
  callDuration: number;
  layout: CallLayout;
  isConnected: boolean;
  spotlightId: string | null;
  isScreenSharing: boolean;
  selectedAudioDevice: AudioDevice;
}

export interface CallConfig {
  mode: CallMode;
  roomTitle: string;
  hostName: string;
  hostAvatar: string;
}

const AVATAR_POOL = [
  'https://i.pravatar.cc/300?img=1',
  'https://i.pravatar.cc/300?img=12',
  'https://i.pravatar.cc/300?img=33',
  'https://i.pravatar.cc/300?img=45',
  'https://i.pravatar.cc/300?img=56',
  'https://i.pravatar.cc/300?img=68',
  'https://i.pravatar.cc/300?img=75',
  'https://i.pravatar.cc/300?img=80',
];

const NAME_POOL = [
  'Aarav Sharma', 'Priya Patel', 'Rohan Mehta', 'Ananya Iyer',
  'Vikram Reddy', 'Sneha Gupta', 'Arjun Nair', 'Kavya Singh',
];

let timerInterval: ReturnType<typeof setInterval> | null = null;
let speakingInterval: ReturnType<typeof setInterval> | null = null;

export function buildLocalParticipant(user: User, role: CallRole): CallParticipant {
  return {
    id: user.id || (user as any)._id || 'local-user',
    name: 'You',
    avatarUrl: user.avatarUrl || '',
    role,
    isLocal: true,
    isMuted: false,
    isVideoOff: false,
    isHandRaised: false,
    isSpeaking: false,
    status: 'connected',
    joinedAt: new Date().toISOString(),
    networkQuality: 5,
  };
}

export function buildRemoteParticipant(
  user: { id: string; name: string; avatarUrl?: string },
  role: CallRole,
): CallParticipant {
  return {
    id: user.id,
    name: user.name || 'Participant',
    avatarUrl: user.avatarUrl || '',
    role,
    isLocal: false,
    isMuted: false,
    isVideoOff: false,
    isHandRaised: false,
    isSpeaking: false,
    status: 'connecting',
    joinedAt: new Date().toISOString(),
    networkQuality: 5,
  };
}

export function buildMockClassParticipants(_count: number): CallParticipant[] {
  // Mock participants removed — real-time peers are used exclusively
  return [];
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function startCallTimer(onTick: (duration: number) => void): void {
  let duration = 0;
  timerInterval = setInterval(() => {
    duration++;
    onTick(duration);
  }, 1000);
}

export function stopCallTimer(): void {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

export function startSpeakingSimulator(
  _participantIds: string[],
  _onUpdate: (speakingId: string | null) => void,
): void {
  // Simulated speaking removed for real-time audio
}

export function stopSpeakingSimulator(): void {
  if (speakingInterval) { clearInterval(speakingInterval); speakingInterval = null; }
}

export function generateCallMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateReactionId(): string {
  return `react-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
