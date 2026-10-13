/**
 * Single source of truth for mapping a Battle `topic` to the `Card.theme`
 * string actually stored in the DB (see /api/trivia/categories for the real values).
 *
 * WHY THIS EXISTS:
 * This map used to be duplicated across every battle-creating route. The bot routes
 * didn't have it at all and pulled cards with `{ active: true }` only - producing
 * battles labelled e.g. FILM that served SPORTS questions. Keep exactly one copy.
 *
 * When adding a new topic to the UI, add it here too. Callers must treat a missing
 * mapping as an error rather than falling back to another theme, otherwise the
 * label/question mismatch silently comes back.
 */
/**
 * OFFICIAL CATEGORIES (5 only):
 * - MUSIC
 * - SPORTS  
 * - MOVIES (includes TV Shows & Cinema)
 * - GAMING
 * - POLITIK
 */
export const TOPIC_TO_THEME: Record<string, string> = {
  // Mixed: questions from ALL themes. 'MIX' is the value getQuestionsForUser already
  // understands as "no theme filter"; routes that regenerate or generate questions
  // must special-case it (see isMixTheme).
  mixed: 'MIX',

  // Primary mappings
  sport: 'SPORTS',
  sports: 'SPORTS',
  music: 'MUSIC',
  film: 'TV & MOVIES',
  movies: 'TV & MOVIES',
  tv: 'TV & MOVIES',
  'tv shows': 'TV & MOVIES',
  'tv & movies': 'TV & MOVIES',
  cinema: 'TV & MOVIES',
  games: 'GAMING',
  gaming: 'GAMING',
  politik: 'POLITIK',
  politics: 'POLITIK',
  
  // Legacy mappings -> redirect to closest category
  culture: 'TV & MOVIES',
  fashion: 'TV & MOVIES',
  art: 'TV & MOVIES',
  food: 'TV & MOVIES',
  celebrities: 'TV & MOVIES',
  technology: 'GAMING',
};

/**
 * Resolve a topic to its Card theme. Returns null for unknown topics so callers
 * can fail loudly instead of serving questions from the wrong category.
 */
export function themeForTopic(topic: string): string | null {
  return TOPIC_TO_THEME[topic] ?? null;
}

/** The five real themes a Mixed battle draws from. */
export const REAL_THEMES = ['MUSIC', 'SPORTS', 'TV & MOVIES', 'GAMING', 'POLITIK'] as const;

export const isMixTheme = (theme: string | null | undefined) => theme === 'MIX';
