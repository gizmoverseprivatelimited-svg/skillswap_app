import type { User } from '../types';

export type CallRole = 'host' | 'guest' | 'teacher' | 'student';
export type CallMode = 'video' | 'voice';
export type ParticipantStatus = 'connecting' | 'connected' | 'disconnected' | 'hand_raised' | 'muted' | 'video_off';
export type CallLayout = 'grid' | 'spotlight' | 'speaker';

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
}

export interface CallMessage {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  isSystem?: boolean;
}

export interface CallState {
  participants: CallParticipant[];
  messages: CallMessage[];
  callDuration: number;
  layout: CallLayout;
  isConnected: boolean;
  spotlightId: string | null;
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
  };
}

export function buildMockClassParticipants(count: number): CallParticipant[] {
  const result: CallParticipant[] = [];
  const usedNames = new Set<number>();
  for (let i = 0; i < Math.min(count, 8); i++) {
    let idx = Math.floor(Math.random() * NAME_POOL.length);
    while (usedNames.has(idx)) idx = (idx + 1) % NAME_POOL.length;
    usedNames.add(idx);
    result.push({
      id: `mock-student-${i}`,
      name: NAME_POOL[idx],
      avatarUrl: AVATAR_POOL[idx],
      role: 'student',
      isLocal: false,
      isMuted: Math.random() > 0.4,
      isVideoOff: Math.random() > 0.5,
      isHandRaised: Math.random() > 0.85,
      isSpeaking: false,
      status: Math.random() > 0.15 ? 'connected' : 'connecting',
      joinedAt: new Date(Date.now() - Math.random() * 120000).toISOString(),
    });
  }
  return result;
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
  participantIds: string[],
  onUpdate: (speakingId: string | null) => void,
): void {
  speakingInterval = setInterval(() => {
    if (participantIds.length === 0) return;
    if (Math.random() > 0.3) {
      const idx = Math.floor(Math.random() * participantIds.length);
      onUpdate(participantIds[idx]);
    } else {
      onUpdate(null);
    }
  }, 2500);
}

export function stopSpeakingSimulator(): void {
  if (speakingInterval) { clearInterval(speakingInterval); speakingInterval = null; }
}

export function generateCallMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
