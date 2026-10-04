import type { LucideIcon } from "lucide-react";
import { Dumbbell, Music, Film, Shirt, Gamepad2, Tv } from "lucide-react";
import { getTopicColor } from "@/lib/categories";

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
  creatorResults: { round: number; correct: boolean; timeMs: number; points: number; abandoned?: boolean; }[];
  opponentResults: { round: number; correct: boolean; timeMs: number; points: number; abandoned?: boolean; }[];
  creatorTotalPoints: number;
  opponentTotalPoints: number;
  winner?: string;
  forfeitedBy?: string;
  isPrivate?: boolean;
  challengedUser?: string;
}

export interface RoundResult {
  correct: boolean;
  timeMs: number;
  points: number;
  answerIndex?: number;
  /**
   * The round was opened but never answered - the player reloaded, lost their
   * connection or closed the tab. Scored as wrong, but flagged so the result view
   * can say why instead of showing it as a normal wrong answer.
   */
  abandoned?: boolean;
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
// Colours come from @/lib/categories - the same ids are rendered by
// BattlesPage.tsx and by the editorial surfaces, and inlining hex values here is
// what made one battle appear in two different colours.
export const TOPICS: TopicConfig[] = [
  { id: 'sport', label: 'Sport', icon: Dumbbell, color: getTopicColor('sport') },
  { id: 'music', label: 'Music', icon: Music, color: getTopicColor('music') },
  { id: 'film', label: 'Film', icon: Film, color: getTopicColor('film') },
  { id: 'fashion', label: 'Fashion', icon: Shirt, color: getTopicColor('fashion') },
  { id: 'games', label: 'Games', icon: Gamepad2, color: getTopicColor('games') },
  { id: 'tv', label: 'TV', icon: Tv, color: getTopicColor('tv') },
];

export const getTopicConfig = (topicId: string): TopicConfig => {
  return TOPICS.find(t => t.id === topicId) || TOPICS[0];
};

// ═══════════════════════════════════════════════════════════════
// WAGER CONFIG
// ═══════════════════════════════════════════════════════════════

// 3 rounds for ≤0.75 BOGX, 5 rounds for >0.75 BOGX
export const WAGERS = [
  { amount: 0.25, rounds: 3 },
  { amount: 0.50, rounds: 3 },
  { amount: 0.75, rounds: 3 },
  { amount: 1.00, rounds: 5 },
  { amount: 2.50, rounds: 5 },
  { amount: 5.00, rounds: 5 },
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

// Check if game is on break (9:55-10:00 CET - 5 minute daily reset)
export const isGameOnBreak = () => {
  const now = new Date();
  const germanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const hour = germanTime.getHours();
  const minute = germanTime.getMinutes();
  return hour === 9 && minute >= 55;
};
