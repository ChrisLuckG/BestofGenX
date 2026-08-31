/**
 * Date verification for "on this day" event proposals, backed by Wikidata.
 *
 * Why this exists: the event templates used to let the reporter recall a date from
 * memory, and the only check was the YEAR being inside the GenX era. A premiere
 * dated one day off (Dirty Dancing on 20 August instead of the documented
 * 21 August) passed silently, and so would a date months away.
 *
 * Two mechanisms, deliberately combined:
 *  1. fetchReleasePool()  - a verified list of things actually released on this
 *     day, injected into the prompt so the reporter picks instead of recalls.
 *  2. verifyRelease()     - checks the title the reporter returned against its own
 *     Wikidata entity, because a prompt instruction is not a guarantee.
 *
 * Both are best-effort: Wikidata coverage is good for films, albums and games and
 * poor for sports, so a failed lookup marks a proposal "unverified" rather than
 * rejecting it.
 */

import { EVENT_ERA, type ReleaseCategory } from './releaseCategory';

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const WD_API = 'https://www.wikidata.org/w/api.php';
const UA = 'BOGX-Newsroom/1.0 (editorial date verification)';

/** Wikidata class per category. Only types whose release date is P577 belong here:
 *  TV series carry a start time (P580) instead, so they are intentionally absent. */
const TYPE_QID: Record<ReleaseCategory, string> = {
  'movies-tv': 'wd:Q11424', // film
  music: 'wd:Q482994',      // album
  gaming: 'wd:Q7889',       // video game
};

/** Sitelink count as a notability floor - without it the pool fills up with
 *  obscure entries nobody in the audience recognises. */
const MIN_SITELINKS = 8;

export interface ReleaseItem {
  title: string;
  /** ISO date, e.g. "1987-08-21" */
  date: string;
  year: number;
  /** Number of Wikipedia language editions - a rough fame proxy. */
  sitelinks: number;
}

export interface ReleaseDate {
  date: string;
  country?: string;
}

export type ReleaseStatus =
  /** A documented release date falls on the requested day. */
  | 'verified'
  /** The title exists and has release dates, but none on the requested day. */
  | 'mismatch'
  /** No usable Wikidata entity or no release date at all - nothing proven either way. */
  | 'unverified';

export interface ReleaseCheck {
  status: ReleaseStatus;
  /** All documented release dates found, for showing the real date on a mismatch. */
  dates: ReleaseDate[];
  /** Wikidata label of the entity that was actually checked (catches wrong matches). */
  matchedLabel?: string;
  matchedId?: string;
}

// Caching is not an optimisation here, it is what makes the feature usable.
// Measured cold cost of the pool query on the public endpoint: 9s, 12s, 20s and
// once over 55s for the same query - the variance is endpoint load, not query
// shape (a version without the label service and without ORDER BY was slower and
// returned HTTP 504). Alternatives were measured and rejected, so instead the
// result is cached twice: in memory per process and in MongoDB across restarts.
//
// A pool is keyed by (category, month, day, era) and describes historical facts -
// what was released on 21 August within a fixed year range does not change - so it
// is refreshed only every few months to pick up newly added Wikidata entries.
const memCache = new Map<string, ReleaseItem[]>();
const DB_COLLECTION = 'wikidataReleaseCache';
const MAX_CACHE_AGE_DAYS = 90;

// The year window is part of the key: widening EVENT_ERA must not keep serving a
// pool that was built with the older, narrower range.
function cacheKey(category: ReleaseCategory, month: number, day: number): string {
  return `${category}-${month}-${day}-${EVENT_ERA.start}-${EVENT_ERA.end}`;
}

async function readDbCache(key: string): Promise<ReleaseItem[] | null> {
  try {
    const { default: clientPromise } = await import('@/lib/mongodb');
    const client = await clientPromise;
    const doc = await client.db('sporttock').collection(DB_COLLECTION).findOne({ key });
    if (!doc?.items) return null;
    const ageDays = (Date.now() - new Date(doc.fetchedAt || 0).getTime()) / 86400000;
    if (ageDays > MAX_CACHE_AGE_DAYS) return null;
    return doc.items as ReleaseItem[];
  } catch (err) {
    console.error('[wikidata] cache read failed:', err);
    return null;
  }
}

async function writeDbCache(key: string, items: ReleaseItem[]): Promise<void> {
  try {
    const { default: clientPromise } = await import('@/lib/mongodb');
    const client = await clientPromise;
    await client.db('sporttock').collection(DB_COLLECTION).updateOne(
      { key },
      { $set: { key, items, fetchedAt: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    console.error('[wikidata] cache write failed:', err);
  }
}

/**
 * Pool from cache only - never runs the slow SPARQL query.
 *
 * Used by the per-proposal verification, which runs once per reporter: triggering
 * a 15s query there would add minutes to a search with nine reporters.
 *
 * Returns null when nothing is cached, as opposed to an empty array meaning
 * "checked, and nothing notable was released on this day" - conflating the two
 * would re-run the slow query on every single search for such a day.
 */
export async function getPoolIfCached(
  month: number,
  day: number,
  category: ReleaseCategory
): Promise<ReleaseItem[] | null> {
  const key = cacheKey(category, month, day);
  const mem = memCache.get(key);
  if (mem !== undefined) return mem;
  const db = await readDbCache(key);
  if (db) {
    memCache.set(key, db);
    return db;
  }
  return null;
}

/**
 * Things released on `month`/`day` within EVENT_ERA according to Wikidata.
 *
 * Note the qualifier limitation: P577 often holds several national release dates
 * and asking for the country qualifier inside this query makes it exceed the
 * 60s SPARQL timeout. The country is therefore resolved only in verifyRelease(),
 * for the single title a reporter actually proposed.
 */
export async function fetchReleasePool(
  month: number,
  day: number,
  category: ReleaseCategory,
  limit = 40
): Promise<ReleaseItem[]> {
  const key = cacheKey(category, month, day);
  const cached = await getPoolIfCached(month, day, category);
  if (cached) return cached;

  const query = `
SELECT ?itemLabel ?date ?sitelinks WHERE {
  ?item wdt:P31/wdt:P279* ${TYPE_QID[category]} ;
        wdt:P577 ?date ;
        wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${MIN_SITELINKS})
  FILTER(MONTH(?date) = ${month} && DAY(?date) = ${day})
  FILTER(YEAR(?date) >= ${EVENT_ERA.start} && YEAR(?date) <= ${EVENT_ERA.end})
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?sitelinks)
LIMIT ${limit}`;

  // Two attempts: an aborted first try often warms Wikidata's own result cache,
  // so the retry tends to be far faster than the original.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`, {
        headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
        signal: AbortSignal.timeout(55000),
      });
      if (!res.ok) {
        console.error(`[wikidata] pool query attempt ${attempt} failed: HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const seen = new Set<string>();
      const items: ReleaseItem[] = [];
      for (const row of data.results?.bindings || []) {
        const title = row.itemLabel?.value;
        const date = row.date?.value?.slice(0, 10);
        if (!title || !date || seen.has(title)) continue;
        // An unresolved label stays a Q-id, which is useless in a prompt.
        if (/^Q\d+$/.test(title)) continue;
        seen.add(title);
        items.push({
          title,
          date,
          year: parseInt(date.slice(0, 4), 10),
          sitelinks: parseInt(row.sitelinks?.value || '0', 10),
        });
      }
      memCache.set(key, items);
      // Persist even an empty result: "nothing notable on this day" is a valid
      // answer and must not trigger the slow query again on every search.
      await writeDbCache(key, items);
      return items;
    } catch (err) {
      console.error(`[wikidata] pool query attempt ${attempt} error:`, err);
    }
  }
  return [];
}

interface EntityDates {
  id: string;
  label: string;
  description: string;
  dates: ReleaseDate[];
}

/** Category hints used to break ties between same-named entities: a search for
 *  "Blade" returns the 2000 video game before the 1998 film. */
const DESCRIPTION_HINT: Record<ReleaseCategory, RegExp> = {
  'movies-tv': /\b(film|movie|series|episode|television)\b/i,
  music: /\b(album|song|single|ep|soundtrack)\b/i,
  gaming: /\b(video game|game)\b/i,
};

/**
 * Checks whether the proposed title really was released on `month`/`day`.
 *
 * Disambiguation matters more than it looks: several unrelated entities share a
 * title, so the entity whose release year matches the claimed year wins, then one
 * matching the category description, and only then the first result. Without that,
 * a correct film proposal could be "refuted" by an unrelated game of the same name.
 */
export async function verifyRelease(
  title: string,
  claimedYear: number | undefined,
  month: number,
  day: number,
  category: ReleaseCategory | null
): Promise<ReleaseCheck> {
  const clean = title.trim();
  if (!clean) return { status: 'unverified', dates: [] };

  try {
    // Cheapest and most reliable path first: the pool is already filtered by type
    // AND date, so a hit there is proof. It also avoids the entity-search trap
    // where a title like "Blade" resolves to an unrelated game of the same name.
    // Cache-only on purpose - see getPoolIfCached.
    if (category) {
      const pool = (await getPoolIfCached(month, day, category)) || [];
      const hit = pool.find(i => sameTitle(i.title, clean));
      if (hit) {
        return {
          status: 'verified',
          dates: [{ date: hit.date }],
          matchedLabel: hit.title,
        };
      }
    }

    const ids = await searchEntityIds(clean);
    if (!ids.length) return { status: 'unverified', dates: [] };

    const entities = await fetchEntityDates(ids);
    const withDates = entities.filter(e => e.dates.length > 0);
    if (!withDates.length) return { status: 'unverified', dates: [] };

    const hint = category ? DESCRIPTION_HINT[category] : null;
    const chosen =
      (claimedYear
        ? withDates.find(e => e.dates.some(d => d.date.startsWith(String(claimedYear))))
        : undefined) ||
      (hint ? withDates.find(e => hint.test(e.description)) : undefined) ||
      withDates[0];

    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const hit = chosen.dates.some(d => d.date.slice(5) === `${mm}-${dd}`);

    return {
      status: hit ? 'verified' : 'mismatch',
      dates: chosen.dates,
      matchedLabel: chosen.label,
      matchedId: chosen.id,
    };
  } catch (err) {
    console.error('[wikidata] verify error:', err);
    return { status: 'unverified', dates: [] };
  }
}

/** Loose title comparison: punctuation and case differ between a reporter's
 *  wording and the Wikidata label ("Terminator 2: Judgment Day" vs "Terminator 2"). */
function sameTitle(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || x.startsWith(y) || y.startsWith(x);
}

async function searchEntityIds(title: string): Promise<string[]> {
  // 10 instead of a handful: for ambiguous titles the relevant entity (the 1998
  // film "Blade") can rank below characters, games and songs of the same name.
  const url = `${WD_API}?action=wbsearchentities&search=${encodeURIComponent(title)}&language=en&limit=10&format=json&origin=*`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.search || []).map((s: { id: string }) => s.id);
}

/** Reads P577 statements including the country qualifier (P291), resolving the
 *  country labels in one extra batched request. */
async function fetchEntityDates(ids: string[]): Promise<EntityDates[]> {
  const url = `${WD_API}?action=wbgetentities&ids=${ids.join('|')}&props=claims|labels|descriptions&languages=en&format=json&origin=*`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  const data = await res.json();

  const raw: Array<EntityDates & { countryIds: (string | undefined)[] }> = [];
  const countryIds = new Set<string>();

  for (const id of ids) {
    const ent = data.entities?.[id];
    if (!ent) continue;
    const dates: ReleaseDate[] = [];
    const cIds: (string | undefined)[] = [];
    for (const claim of ent.claims?.P577 || []) {
      const time: string | undefined = claim.mainsnak?.datavalue?.value?.time;
      if (!time) continue;
      const date = time.slice(1, 11);
      // Wikidata pads unknown month/day with 00 - such a date proves nothing.
      if (date.includes('-00')) continue;
      const cid: string | undefined = claim.qualifiers?.P291?.[0]?.datavalue?.value?.id;
      if (cid) countryIds.add(cid);
      dates.push({ date });
      cIds.push(cid);
    }
    raw.push({
      id,
      label: ent.labels?.en?.value || id,
      description: ent.descriptions?.en?.value || '',
      dates,
      countryIds: cIds,
    });
  }

  const labels = await fetchLabels(Array.from(countryIds));
  return raw.map(e => ({
    id: e.id,
    label: e.label,
    description: e.description,
    dates: e.dates.map((d, i) => {
      const cid = e.countryIds[i];
      return cid ? { ...d, country: labels[cid] || undefined } : d;
    }),
  }));
}

async function fetchLabels(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const url = `${WD_API}?action=wbgetentities&ids=${ids.join('|')}&props=labels&languages=en&format=json&origin=*`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return {};
  const data = await res.json();
  const out: Record<string, string> = {};
  for (const [qid, ent] of Object.entries<{ labels?: { en?: { value: string } } }>(data.entities || {})) {
    const label = ent.labels?.en?.value;
    if (label) out[qid] = label;
  }
  return out;
}

/** Formats dates for a UI hint: "21.08.1987 (United States)". */
export function formatReleaseDates(dates: ReleaseDate[], max = 3): string {
  return dates
    .slice(0, max)
    .map(d => {
      const [y, m, dd] = d.date.split('-');
      const human = `${dd}.${m}.${y}`;
      return d.country ? `${human} (${d.country})` : human;
    })
    .join(', ');
}
