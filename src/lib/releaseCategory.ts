/**
 * Client-safe part of the Wikidata release verification.
 *
 * Kept in its own module on purpose: wikidataReleases.ts touches MongoDB for its
 * cache, and importing anything from there into a "use client" component drags the
 * mongodb driver into the browser bundle - which takes the whole app down with a
 * 500, and typechecking does not catch it.
 */

/**
 * Year window for "on this day" EVENTS (premieres, releases, matches).
 *
 * Distinct from the GenX BIRTH window (1965-1980) used for people: an event
 * qualifies when it happened during the GenX lifespan, not when someone was born.
 * Kept in one place because the range is referenced by the prompts, the proposal
 * validation and the Wikidata query - they must not drift apart.
 */
export const EVENT_ERA = { start: 1965, end: 2000 } as const;

/** Categories whose release date Wikidata models as publication date (P577). */
export type ReleaseCategory = 'movies-tv' | 'music' | 'gaming';

export function releaseCategoryFor(category?: string): ReleaseCategory | null {
  if (category === 'movies-tv' || category === 'music' || category === 'gaming') return category;
  return null;
}
