/**
 * Shared YouTube search with duration preference.
 *
 * WHY THIS EXISTS
 * The same search-and-pick logic was copy-pasted across five API routes, and the
 * copies drifted: the editorial chat filtered for long videos while the history
 * endpoints had no duration filter at all, so "on this day" events ended up with
 * 40-second clips instead of documentaries.
 *
 * HOW DURATION IS HANDLED
 * YouTube's `videoDuration` parameter accepts exactly ONE value, so a single
 * request cannot express "long or medium". Instead the tiers are tried in order:
 *
 *   long   (> 20 min)  -> documentaries, full concerts, full matches
 *   medium (4 - 20 min) -> news segments, archive reports
 *   any                 -> only when a caller explicitly allows it
 *
 * The duration tier is the OUTER loop and the query variants the inner one: a
 * decent long video beats a perfectly-worded query that returns a short clip.
 * `short` (< 4 min) is never requested - falling back to it is what produced the
 * clip-length videos in the first place.
 */

export type DurationTier = 'long' | 'medium' | 'any';

/** Long first, then medium. Never short. Default for history/documentary use. */
export const PREFER_LONG: DurationTier[] = ['long', 'medium'];

/** Last resort for callers that would rather have any video than none. */
export const PREFER_LONG_THEN_ANY: DurationTier[] = ['long', 'medium', 'any'];

export interface YouTubeSearchOptions {
  /** Base search phrase, e.g. "Live Aid Wembley". */
  query: string;
  /** Event year - folded into the query variants when present. */
  year?: number;
  /** Never return this id (used by "find me a different video"). */
  excludeVideoId?: string;
  /** Never return any of these ids (used to avoid duplicates in articles). */
  excludeVideoIds?: Set<string>;
  /** Duration tiers in priority order. Defaults to PREFER_LONG. */
  tiers?: DurationTier[];
  /** Candidates fetched per request. */
  maxResults?: number;
  /** Extra query variants, tried after the built-in ones. */
  extraQueries?: string[];
  /**
   * The text the video will sit next to (section heading + paragraph, or an event
   * description). Checking the title against the actual passage is what stops a
   * video that merely matches the search phrase from illustrating the wrong thing.
   */
  context?: string;
  /**
   * Minimum share of the query that must appear in a candidate's title.
   * 0 disables the topical gate - only for callers that would rather have a loosely
   * related thumbnail than none (ranking tiles).
   */
  minRelevance?: number;
  /**
   * At most this many search.list calls (100 quota units EACH). Without it a miss costs tiers x variants =
   * up to 10 calls = 1,000 units for ONE article section - that is what emptied the daily 10,000 after
   * two or three articles (18./19.10.2026).
   */
  maxSearches?: number;
  /** Throw YouTubeQuotaError on 403/429 instead of answering "nothing found" - so the caller can retry later. */
  throwOnQuota?: boolean;
  /** Use exactly these query variants (in order) instead of the built-in "documentary / archive footage / full" ones. */
  queries?: string[];
}

/** YouTube refused for quota / rate reasons: "nothing found" would be wrong - it is "not now". */
export class YouTubeQuotaError extends Error {
  constructor(status: number) { super(`YouTube quota/rate limit (HTTP ${status})`); this.name = 'YouTubeQuotaError'; }
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  /** Which duration tier produced the hit - useful in logs. */
  tier: DurationTier;
  /** Which query variant produced the hit. */
  query: string;
}

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

// Titles that signal a clip/meme rather than real footage. Shorts leak through
// even with a duration filter because creators pad them to pass the threshold.
const JUNK_TITLE_RE =
  /\b(#shorts|shorts?\b|tiktok|reaction|reacts? to|tier list|top \d+|ranking every|fan edit|\bedit\b|compilation of|asmr|meme)\b/i;

// Formats that genuinely show the historical event.
const GOOD_TITLE_RE =
  /\b(documentary|docu|archive|archival|footage|full (concert|match|episode|show|speech|interview)|newsreel|retrospective|the story of|behind the scenes)\b/i;

/** Query variants, broad enough to survive a vague search term. */
function buildQueryVariants(query: string, year?: number, extra?: string[]): string[] {
  const y = year ? ` ${year}` : '';
  return [
    `${query}${y} documentary`,
    `${query}${y} archive footage`,
    `${query}${y} full`,
    `${query}${y}`,
    ...(extra || []),
    query,
  ]
    .map(q => q.replace(/\s+/g, ' ').trim())
    .filter((q, i, arr) => q.length > 0 && arr.indexOf(q) === i);
}

/** Prefers real documentary/archive material and pushes clip-bait down. */
function scoreCandidate(title: string): number {
  let score = 0;
  if (GOOD_TITLE_RE.test(title)) score += 3;
  if (JUNK_TITLE_RE.test(title)) score -= 5;
  return score;
}

// Words that say nothing about the subject when comparing a phrase to a title.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'from',
  'with', 'his', 'her', 'their', 'its', 'was', 'were', 'is', 'are', 'that',
  'this', 'it', 'as', 'by', 'but', 'not', 'all', 'official', 'video', 'full',
  'hd', 'documentary', 'archive', 'archival', 'footage', 'clip', 'clips',
  'scene', 'live', 'best', 'top', 'new', 'old', 'more', 'about', 'into',
  'when', 'who', 'what', 'how', 'why', 'would', 'could', 'had', 'has', 'have',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ') // section text arrives as HTML
    .replace(/[^a-z0-9äöüßà-ÿ\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * How much of `needle` appears in `haystack`, 0..1.
 *
 * Longer words weigh more (a shared "woodstock" says far more than a shared
 * "day") and a four-digit year counts triple because it pins down the event.
 */
function weightedOverlap(needle: string[], haystack: string): number {
  if (!needle.length) return 0;
  const hay = new Set(tokenize(haystack));
  if (!hay.size) return 0;

  let hit = 0;
  let total = 0;
  for (const t of needle) {
    const weight = /^\d{4}$/.test(t) ? 3 : t.length >= 6 ? 2 : 1;
    total += weight;
    if (hay.has(t)) hit += weight;
  }
  return total > 0 ? hit / total : 0;
}

// Thresholds tuned against real examples rather than guessed. At 0.4/0.5 a plainly
// correct pairing (a Woodstock '99 riot clip next to the Woodstock '99 paragraph)
// landed exactly on the line, so both were loosened until the good cases had
// headroom while the bad ones still failed clearly:
//   Korn "All In The Family" vs tattoo-artist paragraph -> query 0.10 / context 0.33
//   Woodstock riot clip      vs Woodstock paragraph     -> query 0.38 / context 0.50
/** Default floor for the query check. Below this the title shares almost nothing
 *  with what was searched for. */
const DEFAULT_MIN_RELEVANCE = 0.35;

/** A title whose own words are largely covered by the passage is on topic even if
 *  the search phrase was worded differently. */
const MIN_TITLE_IN_CONTEXT = 0.45;

/**
 * Is this candidate actually about the passage it would illustrate?
 *
 * Two independent ways to pass, because either signal alone produces mistakes:
 *  - the title covers enough of the search phrase, or
 *  - the title's own words appear in the surrounding text.
 *
 * Example of what this rejects: a paragraph about Fred Durst becoming a tattoo
 * artist and signing with Korn, next to a video titled "Korn - All In The Family".
 * "korn" alone is not enough overlap, and "family" appears nowhere in the passage.
 */
function relevance(
  title: string,
  description: string,
  queryTokens: string[],
  contextText: string | null
): { queryScore: number; contextScore: number } {
  const queryScore = Math.max(
    weightedOverlap(queryTokens, title),
    // A description hit is weaker evidence than a title hit.
    weightedOverlap(queryTokens, description) * 0.6
  );
  // Reverse direction on purpose: ask how much of the TITLE the passage covers.
  // Comparing passage-to-title would drown in the paragraph's other words.
  const contextScore = contextText ? weightedOverlap(tokenize(title), contextText) : 0;

  return { queryScore, contextScore };
}

/**
 * Searches YouTube, preferring longer videos.
 * Returns null when no acceptable video exists - callers should treat "no video"
 * as a valid outcome rather than falling back to a short clip.
 */
export async function searchYouTubeVideo(
  options: YouTubeSearchOptions
): Promise<YouTubeSearchResult | null> {
  const {
    query,
    year,
    excludeVideoId,
    excludeVideoIds,
    tiers = PREFER_LONG,
    maxResults = 8,
    extraQueries,
    context,
    minRelevance = DEFAULT_MIN_RELEVANCE,
    maxSearches = Infinity,
    throwOnQuota = false,
    queries,
  } = options;
  let searches = 0;

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('[YouTube] YOUTUBE_API_KEY not set, skipping video search');
    return null;
  }
  if (!query?.trim()) return null;

  const variants = queries?.length ? queries : buildQueryVariants(query, year, extraQueries);
  // Tokens come from the raw query, not from the padded variants: "documentary"
  // and "archive footage" are format words, not subject matter.
  const queryTokens = tokenize(year ? `${query} ${year}` : query);
  const contextText = context?.trim() || null;

  // Duration is the outer loop on purpose: a long video from a looser query is
  // worth more here than a short video from the perfect query.
  for (const tier of tiers) {
    for (const q of variants) {
      if (searches >= maxSearches) return null;
      searches++;
      const durationParam = tier === 'any' ? '' : `&videoDuration=${tier}`;
      const url =
        `https://www.googleapis.com/youtube/v3/search?part=snippet` +
        `&q=${encodeURIComponent(q)}&type=video&maxResults=${maxResults}` +
        `${durationParam}&key=${apiKey}`;

      let data: any;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) {
          console.error('[YouTube] API error', res.status, 'for', tier, q);
          // quota / rate limit: every further call fails too - stop here
          if (res.status === 403 || res.status === 429) {
            if (throwOnQuota) throw new YouTubeQuotaError(res.status);
            return null;
          }
          continue;
        }
        data = await res.json();
      } catch (err) {
        if (err instanceof YouTubeQuotaError) throw err;
        console.error('[YouTube] Request failed for', tier, q, err);
        continue;
      }

      const candidates = (data.items || [])
        .map((it: any) => ({
          videoId: it?.id?.videoId as string,
          title: (it?.snippet?.title as string) || '',
          description: (it?.snippet?.description as string) || '',
        }))
        .filter(
          (c: any) =>
            c.videoId &&
            VIDEO_ID_RE.test(c.videoId) &&
            c.videoId !== excludeVideoId &&
            !excludeVideoIds?.has(c.videoId)
        );

      if (!candidates.length) continue;

      const ranked = candidates
        .map((c: any, i: number) => {
          const { queryScore, contextScore } = relevance(c.title, c.description, queryTokens, contextText);
          const onTopic =
            minRelevance <= 0 ||
            queryScore >= minRelevance ||
            contextScore >= MIN_TITLE_IN_CONTEXT;
          return {
            ...c,
            i,
            queryScore,
            contextScore,
            onTopic,
            score: scoreCandidate(c.title) + queryScore * 5 + contextScore * 5,
          };
        })
        // Off-topic candidates are dropped entirely rather than ranked last:
        // "best of a bad field" is exactly how a wrong video got embedded before.
        .filter((c: any) => c.onTopic && scoreCandidate(c.title) >= 0)
        .sort((a: any, b: any) => b.score - a.score || a.i - b.i);

      if (!ranked.length) {
        console.log(`[YouTube] No on-topic candidate for "${q}" (${tier}); trying next variant`);
        continue;
      }

      const best = ranked[0];
      console.log(
        `[YouTube] Found (${tier}) "${best.title}" via "${q}" -> ${best.videoId}` +
          ` [query ${best.queryScore.toFixed(2)}, context ${best.contextScore.toFixed(2)}]`
      );
      return { videoId: best.videoId, title: best.title, tier, query: q };
    }
  }

  // No video is a valid, intended outcome: an unrelated embed next to a paragraph
  // is worse than no embed at all.
  console.log('[YouTube] No on-topic video found for:', query);
  return null;
}

/** Exported for tests: the relevance gate is the part most likely to need tuning. */
export function isOnTopic(
  title: string,
  description: string,
  query: string,
  context?: string,
  minRelevance: number = DEFAULT_MIN_RELEVANCE
): { onTopic: boolean; queryScore: number; contextScore: number } {
  const { queryScore, contextScore } = relevance(
    title,
    description,
    tokenize(query),
    context?.trim() || null
  );
  return {
    onTopic:
      minRelevance <= 0 || queryScore >= minRelevance || contextScore >= MIN_TITLE_IN_CONTEXT,
    queryScore,
    contextScore,
  };
}
