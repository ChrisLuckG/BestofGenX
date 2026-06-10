// Tracks how many times the logged-in user has played each game so that
// the per-game intro modal only auto-opens for first-timers. The help
// (`?`) button in every game header lets users re-open the intro anytime.

const STORAGE_PREFIX = "bogx_played_";
const AUTO_INTRO_THRESHOLD = 2;

function key(gameId: string): string {
  return `${STORAGE_PREFIX}${gameId}`;
}

export function getGamePlayCount(gameId: string): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(key(gameId));
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

export function incrementGamePlayCount(gameId: string): number {
  if (typeof window === "undefined") return 0;
  const next = getGamePlayCount(gameId) + 1;
  try {
    localStorage.setItem(key(gameId), String(next));
  } catch {
    // localStorage may be unavailable (private mode, etc.)
  }
  return next;
}

/**
 * Whether the intro modal should auto-open for this user. Guests and
 * first-timers always see it; users who have played enough times skip it
 * and can re-open it via the `?` button in the header.
 */
export function shouldAutoShowIntro(gameId: string, isLoggedIn: boolean): boolean {
  if (!isLoggedIn) return true;
  return getGamePlayCount(gameId) < AUTO_INTRO_THRESHOLD;
}
