// Level System based on lifetime BOGX earned
// ═══════════════════════════════════════════════════════════════

export interface Level {
  name: string;
  minBogx: number;
  maxBogx: number;
  color: string;
}

export const LEVELS: Level[] = [
  { name: 'Rookie', minBogx: 0, maxBogx: 5, color: '#C4772A' },              // Dark Orange
  { name: 'Retro Fan', minBogx: 5, maxBogx: 25, color: '#D4873A' },          // Brand Orange
  { name: 'GenX Hero', minBogx: 25, maxBogx: 100, color: '#E5A55A' },        // Light Orange
  { name: 'Nostalgia Master', minBogx: 100, maxBogx: 500, color: '#D4873A' }, // Brand Orange
  { name: 'Top GenX', minBogx: 500, maxBogx: Infinity, color: '#FFB800' },    // Gold (special)
];

/**
 * Get user's current level based on lifetime BOGX
 */
export function getUserLevel(bogx: number): Level {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (bogx >= LEVELS[i].minBogx) {
      return LEVELS[i];
    }
  }
  return LEVELS[0];
}

/**
 * Get level index (0-4)
 */
export function getLevelIndex(bogx: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (bogx >= LEVELS[i].minBogx) {
      return i;
    }
  }
  return 0;
}

/**
 * Get progress to next level (0-100%)
 */
export function getLevelProgress(bogx: number): number {
  const level = getUserLevel(bogx);
  const levelIndex = getLevelIndex(bogx);
  
  // Already at max level
  if (levelIndex === LEVELS.length - 1) {
    return 100;
  }
  
  const nextLevel = LEVELS[levelIndex + 1];
  const progressInLevel = bogx - level.minBogx;
  const levelRange = nextLevel.minBogx - level.minBogx;
  
  return Math.min(100, Math.round((progressInLevel / levelRange) * 100));
}

/**
 * Get BOGX needed for next level
 */
export function getBogxToNextLevel(bogx: number): number {
  const levelIndex = getLevelIndex(bogx);
  
  // Already at max level
  if (levelIndex === LEVELS.length - 1) {
    return 0;
  }
  
  const nextLevel = LEVELS[levelIndex + 1];
  return Math.max(0, nextLevel.minBogx - bogx);
}

/**
 * Get next level name
 */
export function getNextLevelName(bogx: number): string | null {
  const levelIndex = getLevelIndex(bogx);
  
  if (levelIndex === LEVELS.length - 1) {
    return null; // Already at max
  }
  
  return LEVELS[levelIndex + 1].name;
}

/**
 * Get progress segments for UI (10 segments)
 */
export function getProgressSegments(bogx: number): number {
  const progress = getLevelProgress(bogx);
  return Math.round(progress / 10);
}
