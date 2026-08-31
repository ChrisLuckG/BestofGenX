import { NextRequest, NextResponse } from 'next/server';

/**
 * Bulk YouTube search for Rankroll items.
 *
 * QUOTA IS THE CONSTRAINT HERE, NOT SPEED.
 * A YouTube `search.list` call costs 100 quota units and the default project
 * allowance is 10.000 units/day — that is only 100 searches PER DAY for the
 * whole app. The newsroom fans one request out to ~9 reporters at once, so
 * every extra query variant multiplies into dozens of calls and burns the
 * daily budget in a handful of clicks (that is exactly what happened).
 *
 * Therefore:
 *  - ONE search per topic, never a list of query variants.
 *  - maxResults is raised instead (same 100 units for up to 50 results).
 *  - Results are cached per topic for the rest of the day, so all reporters
 *    asking for the same topic share a single API call.
 *  - A 429 is reported as `quotaExceeded` so the UI can say so instead of
 *    silently claiming "no videos found".
 */

interface CachedVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

// Module-level cache: topic (lowercased) -> videos. Cleared on server restart,
// which is fine — it only exists to collapse the reporter fan-out.
const cache = new Map<string, { videos: CachedVideo[]; at: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

// Junk that signals a clip/meme rather than real footage.
const JUNK_TITLE_RE = /#shorts|\btiktok\b|reaction|reacts? to|tier list|fan edit|\basmr\b/i;

/**
 * Drops ids that cannot actually be played in an embed.
 *
 * `videoEmbeddable=true` on the search is not enough: the search index lags behind
 * deletions and says nothing about region blocks, which is how a ranking ended up
 * with a "Video nicht verfügbar" tile. `videos.list` costs 1 quota unit for up to
 * 50 ids - next to nothing compared with the 100 units a search costs - so this
 * check is essentially free.
 */
async function keepPlayableIds(ids: string[], apiKey: string, region = 'DE'): Promise<Set<string>> {
  const playable = new Set<string>();
  if (!ids.length) return playable;

  try {
    const url =
      `https://www.googleapis.com/youtube/v3/videos?part=status,contentDetails` +
      `&id=${ids.slice(0, 50).join(',')}&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.error('[YouTube] videos.list check failed:', res.status);
      // Cannot verify -> keep everything rather than emptying the pool.
      return new Set(ids);
    }
    const data = await res.json();
    for (const v of data.items || []) {
      const status = v.status || {};
      if (status.privacyStatus !== 'public') continue;
      if (status.embeddable === false) continue;
      if (status.uploadStatus && status.uploadStatus !== 'processed') continue;

      const restriction = v.contentDetails?.regionRestriction;
      if (restriction?.blocked?.includes(region)) continue;
      if (restriction?.allowed && !restriction.allowed.includes(region)) continue;

      playable.add(v.id);
    }
    const dropped = ids.length - playable.size;
    if (dropped > 0) console.log(`[YouTube] Dropped ${dropped} unplayable video(s) from the pool`);
    return playable;
  } catch (err) {
    console.error('[YouTube] videos.list check error:', err);
    return new Set(ids);
  }
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*\|.*$/, '')          // "Title | Channel" -> "Title"
    .replace(/\s*-\s*YouTube.*$/i, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
    .slice(0, 80);
}

export async function POST(request: NextRequest) {
  try {
    const { topic, count = 10 } = await request.json();

    if (!topic?.trim()) {
      return NextResponse.json({ success: false, error: 'Missing topic' }, { status: 400 });
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'YOUTUBE_API_KEY not configured', configError: true },
        { status: 500 }
      );
    }

    const cacheKey = topic.trim().toLowerCase();
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        videos: hit.videos.slice(0, count),
        count: Math.min(hit.videos.length, count),
        cached: true,
      });
    }

    // Single call. Over-fetch (same quota cost) so one search can feed every reporter.
    const url =
      `https://www.googleapis.com/youtube/v3/search?part=snippet` +
      `&q=${encodeURIComponent(topic.trim())}&type=video&videoEmbeddable=true` +
      `&maxResults=50&key=${apiKey}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (res.status === 429 || res.status === 403) {
      const body = await res.json().catch(() => ({}));
      const reason = body?.error?.errors?.[0]?.reason || '';
      const isQuota = res.status === 429 || /quota|rateLimit/i.test(reason);
      console.error('[YouTube] Quota/permission failure:', res.status, reason);
      return NextResponse.json(
        {
          success: false,
          quotaExceeded: isQuota,
          error: isQuota
            ? 'YouTube API daily search quota exceeded (100 searches/day). Resets at midnight Pacific Time.'
            : body?.error?.message || 'YouTube API request denied',
        },
        { status: 200 } // 200 so the client reads the flag instead of throwing
      );
    }

    if (!res.ok) {
      console.error('[YouTube] API error', res.status);
      return NextResponse.json({ success: false, error: `YouTube API error ${res.status}` });
    }

    const data = await res.json();
    const seen = new Set<string>();
    const candidates: CachedVideo[] = [];

    for (const item of data.items || []) {
      const videoId = item?.id?.videoId;
      const rawTitle = item?.snippet?.title || '';
      if (!videoId || seen.has(videoId)) continue;
      if (JUNK_TITLE_RE.test(rawTitle)) continue;

      seen.add(videoId);
      candidates.push({
        videoId,
        title: cleanTitle(rawTitle),
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        channelTitle: item.snippet?.channelTitle || '',
      });
    }

    // Keep only videos that really play in an embed (deleted/private/region-blocked
    // ones still show up in search results).
    const playable = await keepPlayableIds(candidates.map(v => v.videoId), apiKey);
    const videos = candidates.filter(v => playable.has(v.videoId));

    cache.set(cacheKey, { videos, at: Date.now() });

    return NextResponse.json({
      success: true,
      videos: videos.slice(0, count),
      count: Math.min(videos.length, count),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('YouTube bulk search error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
