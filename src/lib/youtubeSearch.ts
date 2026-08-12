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
  /** Duration tiers in priority order. Defaults to PREFER_LONG. */
  tiers?: DurationTier[];
  /** Candidates fetched per request. */
  maxResults?: number;
  /** Extra query variants, tried after the built-in ones. */
  extraQueries?: string[];
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
    tiers = PREFER_LONG,
    maxResults = 8,
    extraQueries,
  } = options;

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('[YouTube] YOUTUBE_API_KEY not set, skipping video search');
    return null;
  }
  if (!query?.trim()) return null;

  const variants = buildQueryVariants(query, year, extraQueries);

  // Duration is the outer loop on purpose: a long video from a looser query is
  // worth more here than a short video from the perfect query.
  for (const tier of tiers) {
    for (const q of variants) {
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
          continue;
        }
        data = await res.json();
      } catch (err) {
        console.error('[YouTube] Request failed for', tier, q, err);
        continue;
      }

      const candidates = (data.items || [])
        .map((it: any) => ({
          videoId: it?.id?.videoId as string,
          title: (it?.snippet?.title as string) || '',
        }))
        .filter(
          (c: any) =>
            c.videoId &&
            VIDEO_ID_RE.test(c.videoId) &&
            c.videoId !== excludeVideoId
        );

      if (!candidates.length) continue;

      // Highest scoring candidate, original ranking as the tie-breaker.
      const best = candidates
        .map((c: any, i: number) => ({ ...c, score: scoreCandidate(c.title), i }))
        .sort((a: any, b: any) => b.score - a.score || a.i - b.i)[0];

      // Obvious clip-bait is rejected so the next tier/variant gets a chance.
      if (best.score < 0) {
        console.log('[YouTube] Rejected clip-bait:', best.title);
        continue;
      }

      console.log(
        `[YouTube] Found (${tier}) "${best.title}" via "${q}" -> ${best.videoId}`
      );
      return { videoId: best.videoId, title: best.title, tier, query: q };
    }
  }

  console.log('[YouTube] No suitable long/medium video for:', query);
  return null;
}
