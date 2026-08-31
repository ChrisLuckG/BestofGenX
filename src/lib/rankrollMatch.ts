/**
 * Matches ranking items to videos from a single YouTube search pool.
 *
 * Why matching instead of searching per item:
 * a YouTube `search.list` call costs 100 of the 10.000 daily quota units, i.e.
 * 100 searches per DAY for the whole app. One search per ranking item, fanned
 * out over ~9 reporters, would burn the entire budget on a single topic. So the
 * pool is fetched ONCE per topic and each item is matched against it locally.
 */

export interface PoolVideo {
  videoId: string;
  title: string;
  thumbnail: string;
}

export interface MatchedItem {
  title: string;
  image: string;
  /** Absent when no video in the pool actually matches this item. */
  videoId?: string;
  /** True only for a real textual match. Never true without a videoId. */
  confident: boolean;
}

// Words that carry no signal when comparing a ranking item to a video title.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'from',
  'with', 'vs', 'v', 'his', 'her', 'their', 'it', 'is', 'was', 'that', 'this',
  'best', 'top', 'greatest', 'goal', 'goals', 'moment', 'moments', 'official',
  'hd', 'full', 'video', 'highlights', 'compilation', 'all',
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Overlap score between an item and a video title.
 *
 * Longer tokens weigh more (a shared "manchester" means far more than a shared
 * "one") and a 4-digit year counts double because it pins down the exact event.
 */
function score(itemTokens: string[], videoTitle: string): number {
  if (!itemTokens.length) return 0;
  const videoTokens = new Set(tokenize(videoTitle));
  if (!videoTokens.size) return 0;

  let hit = 0;
  let total = 0;
  for (const t of itemTokens) {
    const weight = /^\d{4}$/.test(t) ? 4 : Math.min(t.length, 8) / 4;
    total += weight;
    if (videoTokens.has(t)) hit += weight;
  }
  return total > 0 ? hit / total : 0;
}

/** Below this the overlap is noise rather than a real match. */
const MIN_SCORE = 0.34;

/**
 * Assigns each item its best matching video, never reusing a video.
 *
 * Assignment is greedy over the globally best pair rather than item-by-item, so
 * an early item cannot steal the video that a later item matches far better.
 *
 * An item without a real match gets NO video. This deliberately replaces an
 * earlier "fill up with leftover pool videos so the ranking stays complete"
 * behaviour: for an obscure subject the pool contains mostly unrelated uploads, so
 * filling produced rankings like a Spanish tennis match illustrated by a Brazilian
 * football clip - while the card still reported "10/10 videos". An incomplete
 * ranking is recoverable; a confidently wrong one is not.
 */
export function matchItemsToVideos(items: string[], pool: PoolVideo[]): MatchedItem[] {
  const tokens = items.map(tokenize);
  const pairs: Array<{ item: number; video: number; s: number }> = [];

  for (let i = 0; i < items.length; i++) {
    for (let v = 0; v < pool.length; v++) {
      const s = score(tokens[i], pool[v].title);
      if (s >= MIN_SCORE) pairs.push({ item: i, video: v, s });
    }
  }
  pairs.sort((a, b) => b.s - a.s);

  const itemToVideo = new Map<number, number>();
  const usedVideos = new Set<number>();
  for (const p of pairs) {
    if (itemToVideo.has(p.item) || usedVideos.has(p.video)) continue;
    itemToVideo.set(p.item, p.video);
    usedVideos.add(p.video);
  }

  return items.map((title, i) => {
    const matched = itemToVideo.get(i);
    if (matched !== undefined) {
      const v = pool[matched];
      return { title, image: v.thumbnail, videoId: v.videoId, confident: true };
    }
    return { title, image: '', confident: false };
  });
}

/**
 * Editorial headline patterns that describe a feeling instead of naming what is
 * being ranked. A rankroll title has to state the subject ("Top 10 Thierry Henry
 * Goals"); "Goals That Made Goalkeepers Cry" is an article headline and leaves
 * the user with nothing concrete to rank.
 */
const CLICKBAIT_RE = [
  /\bthat (made|left|broke|defied|destroyed|changed|shocked)\b/i,
  /\bwho (got|made|broke)\b/i,
  /\btimes? \w+ (made|left|broke)\b/i,
  /\bwill (make|leave|blow)\b/i,
  /\b(you won'?t believe|insane|unbelievable|jaw.?dropping|mind.?blowing)\b/i,
  /\bbroke the internet\b/i,
  /\bdefied physics\b/i,
  /\band fans? \w+\)/i,
];

/** True when the title reads like an article headline rather than a ranking. */
export function looksLikeClickbait(title: string): boolean {
  return CLICKBAIT_RE.some(re => re.test(title));
}

/**
 * Reads the editor's intent out of the raw Rankroll input.
 *
 * "Top 10 Goals Thierry Henry" is an explicit instruction, not a topic to
 * reinterpret: it fixes both the item count and the framing.
 */
export function parseRankingRequest(input: string): {
  subject: string;
  count: number;
  explicitCount: boolean;
} {
  const raw = input.trim();
  const m = raw.match(/\btop\s*(\d{1,2})\b/i);
  const count = m ? Math.min(Math.max(parseInt(m[1], 10), 3), 20) : 10;
  // Strip the leading "Top N" so the subject reads naturally in prompts.
  const subject = raw.replace(/^\s*top\s*\d{1,2}\s*/i, '').trim() || raw;
  return { subject, count, explicitCount: !!m };
}

// Ranking vocabulary that describes the FORMAT, not the subject. Left in a YouTube
// query it dominates the results: searching "Top 10 Alberto Martín Career Moments"
// returned Ayrton Senna, WWE and FIFA clips, while "Alberto Martin tennis" returned
// his actual ATP matches. Nouns that narrow the subject ("goals", "songs",
// "movies") are deliberately NOT stripped - they help the search.
const RANKING_FILLER_RE =
  /\b(top\s*\d{1,2}|top|best|greatest|career|moments?|highlights?|ever|of all time|all[- ]time|iconic|legendary|most|ranking|ranked|list)\b/gi;

/**
 * Turns a ranking request into a usable YouTube search phrase.
 *
 * The pool search must describe the SUBJECT, not the ranking format - see
 * RANKING_FILLER_RE for what that mistake produced.
 */
export function searchQueryForSubject(subject: string, extraHint?: string): string {
  const cleaned = subject
    .replace(RANKING_FILLER_RE, ' ')
    .replace(/\s+/g, ' ')
    // Stripping "Best moments" out of "Best moments of Ayrton Senna" leaves a
    // dangling "of", which YouTube treats as a search word.
    .replace(/^\s*(?:of|the|in|for|from|by|a|an|and)\b\s*/i, '')
    .replace(/\s*\b(?:of|the|in|for|from|by|and)\s*$/i, '')
    .replace(/^[\s\-–—:,]+|[\s\-–—:,]+$/g, '')
    .trim();
  // If filler was all there was, fall back to the original wording.
  const base = cleaned.length >= 3 ? cleaned : subject.trim();
  return extraHint ? `${base} ${extraHint}`.trim() : base;
}
