import type { LucideIcon } from "lucide-react";
import { Dumbbell, Music, Film, Shirt, Gamepad2, Tv } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// BATTLE TYPES - Shared across all battle components
// ═══════════════════════════════════════════════════════════════

export interface BattleUser {
  _id: string;
  username: string;
  avatar: string;
  country: string;
  countryFlag: string;
  points: number;
  isBot?: boolean;
}

export interface Battle {
  _id: string;
  creator: BattleUser;
  opponent?: BattleUser;
  topic: string;
  wager: number;
  rounds: number;
  status: 'open' | 'active' | 'completed' | 'cancelled';
  questions: {
    cardId?: string;
    question: string;
    answers: string[]; 
    correctIndex: number;
    points: number;
  }[];
  creatorResults: { round: number; correct: boolean; timeMs: number; points: number; }[];
  opponentResults: { round: number; correct: boolean; timeMs: number; points: number; }[];
  creatorTotalPoints: number;
  opponentTotalPoints: number;
  winner?: string;
  isPrivate?: boolean;
  challengedUser?: string;
}

export interface RoundResult {
  correct: boolean;
  timeMs: number;
  points: number;
  answerIndex?: number;
}

export type GameScreen = 'setup' | 'pool' | 'intro' | 'countdown' | 'quiz' | 'inter' | 'result' | 'loading';

// ═══════════════════════════════════════════════════════════════
// TOPIC CONFIG
// ═══════════════════════════════════════════════════════════════

export interface TopicConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

// NOTE: culture, art, food removed - not enough DB questions for these themes yet
export const TOPICS: TopicConfig[] = [
  { id: 'sport', label: 'Sport', icon: Dumbbell, color: '#22C55E' },    // Green
  { id: 'music', label: 'Music', icon: Music, color: '#8B5CF6' },       // Purple
  { id: 'film', label: 'Film', icon: Film, color: '#3B82F6' },          // Blue
  { id: 'fashion', label: 'Fashion', icon: Shirt, color: '#EC4899' },   // Pink
  { id: 'games', label: 'Games', icon: Gamepad2, color: '#10B981' },    // Emerald
  { id: 'tv', label: 'TV', icon: Tv, color: '#EF4444' },                // Red
];

export const getTopicConfig = (topicId: string): TopicConfig => {
  return TOPICS.find(t => t.id === topicId) || TOPICS[0];
};

// ═══════════════════════════════════════════════════════════════
// WAGER CONFIG
// ═══════════════════════════════════════════════════════════════

export const WAGERS = [
  { amount: 0.10, rounds: 3 },
  { amount: 0.25, rounds: 3 },
  { amount: 0.50, rounds: 5 },
  { amount: 0.75, rounds: 5 },
  { amount: 1.00, rounds: 5 },
];

// ═══════════════════════════════════════════════════════════════
// GAME TYPES
// ═══════════════════════════════════════════════════════════════

export const GAME_TYPES = [
  { id: 'quiz', label: 'Quiz Battle', icon: '⚡', available: true },
  { id: 'poker', label: 'Poker', icon: '🃏', available: false },
  { id: 'rps', label: 'Rock Paper Scissors', icon: '✊', available: false },
  { id: 'dice', label: 'Dice Duel', icon: '🎲', available: false },
];

// ═══════════════════════════════════════════════════════════════
// FLAG MAPPING
// ═══════════════════════════════════════════════════════════════

export const FLAG_MAP: Record<string, string> = {
  'DE': '🇩🇪', 'US': '🇺🇸', 'GB': '🇬🇧', 'UK': '🇬🇧', 'FR': '🇫🇷', 'ES': '🇪🇸',
  'IT': '🇮🇹', 'JP': '🇯🇵', 'BR': '🇧🇷', 'NL': '🇳🇱', 'SE': '🇸🇪', 'PL': '🇵🇱',
  'AT': '🇦🇹', 'CH': '🇨🇭', 'CA': '🇨🇦', 'AU': '🇦🇺', 'MX': '🇲🇽', 'AR': '🇦🇷',
  'PT': '🇵🇹', 'BE': '🇧🇪', 'NO': '🇳🇴', 'DK': '🇩🇰', 'FI': '🇫🇮', 'IE': '🇮🇪',
  'KR': '🇰🇷', 'IN': '🇮🇳', 'RU': '🇷🇺', 'CN': '🇨🇳', 'ZA': '🇿🇦', 'TR': '🇹🇷',
};

export const getFlag = (flag: string | undefined): string => {
  if (!flag) return '🇩🇪';
  // If already an emoji (longer than 2 chars), return as is
  if (flag.length > 2) return flag;
  // Look up in map
  const code = flag.toUpperCase();
  return FLAG_MAP[code] || '🏳️';
};

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// All wagers are stored directly in BOGX coins (0.10, 0.25, 0.50, ...)
export const toBOGX = (wager: number) => wager;

// Check if game is on break (9:00-10:00 CET - daily reset period)
export const isGameOnBreak = () => {
  const now = new Date();
  const germanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const hour = germanTime.getHours();
  return hour >= 9 && hour < 10;
};
