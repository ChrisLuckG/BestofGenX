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
export const TOPIC_TO_THEME: Record<string, string> = {
  sport: 'SPORTS',
  music: 'MUSIC',
  film: 'MOVIES',
  culture: 'CULTURE',
  fashion: 'FASHION',
  games: 'GAMING',
  tv: 'TV SHOWS',
  art: 'ART',
  food: 'FOOD',
};

/**
 * Resolve a topic to its Card theme. Returns null for unknown topics so callers
 * can fail loudly instead of serving questions from the wrong category.
 */
export function themeForTopic(topic: string): string | null {
  return TOPIC_TO_THEME[topic] ?? null;
}
