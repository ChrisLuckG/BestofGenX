// The YouTube videos INSIDE a person article (one per section), and filling them in later.
//
// When the daily YouTube quota is used up while an article is written, the section does not get "no video" -
// it gets an invisible marker at the exact spot (an HTML comment with the search). Every Daily Auto tick calls
// fillPendingArticleVideos(), which searches again once the quota is back and puts the video where the marker is
// (or removes the marker if YouTube really has nothing on topic). Before, every article written after the quota
// ran out (from the 2nd or 3rd of the day) stayed without videos for good.
//
// Server-only (YouTube key, MongoDB). The marker helpers are pure (scripts/check-article-videos.ts).
import { searchYouTubeVideo, YouTubeQuotaError } from '@/lib/youtubeSearch';

/** At most 2 searches per section (100 units each) instead of up to 10 - a miss used to cost 1,000 units. */
export const SECTION_MAX_SEARCHES = 2;

// EXACTLY the wrapper the editor writes (BlockEditor): ArticlePage unwraps "video-embed" and turns the iframe into
// a video card beside the text. A "youtube-embed" wrapper once left a video-sized hole in every section.
export function buildYoutubeIframe(videoId: string): string {
  return `<div class="video-embed" style="position:relative;width:100%;aspect-ratio:16/9;margin:24px 0;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.15);background:#000;"><iframe class="ql-video" frameborder="0" allowfullscreen="true" src="https://www.youtube.com/embed/${videoId}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe></div>`;
}

export type PendingVideo = { q: string; ctx: string; person?: string };
const MARKER_RE = /<!--video-pending:([A-Za-z0-9+/=]+)-->/g;

/** The invisible placeholder for a section video that could not be searched yet. */
export function pendingMarker(p: PendingVideo): string {
  return `<!--video-pending:${Buffer.from(JSON.stringify({ q: p.q, ctx: p.ctx.slice(0, 600), person: p.person }), 'utf8').toString('base64')}-->`;
}

export function readMarkers(html: string): { raw: string; data: PendingVideo }[] {
  const out: { raw: string; data: PendingVideo }[] = [];
  for (const m of Array.from(String(html).matchAll(MARKER_RE))) {
    try { out.push({ raw: m[0], data: JSON.parse(Buffer.from(m[1], 'base64').toString('utf8')) }); } catch { out.push({ raw: m[0], data: { q: '', ctx: '' } }); }
  }
  return out;
}

export const embeddedVideoIds = (html: string) => new Set(Array.from(String(html).matchAll(/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/g)).map(m => m[1]));

/**
 * One section's video: strict relevance (passage + query), never a video already in the article, and the person's
 * name must be in the title. Throws YouTubeQuotaError when YouTube refuses - the caller then writes a marker.
 */
export async function findSectionVideo(query: string, context: string, exclude: Set<string>, personName?: string): Promise<string | null> {
  // Two searches, any length: the plain phrase, then "... interview". (Two "long only" searches with
  // "documentary" / "archive footage" tacked on found nothing even for Trey Parker.)
  const hit = await searchYouTubeVideo({
    query, context, minRelevance: 0.5, maxResults: 15, excludeVideoIds: exclude,
    tiers: ['any'], queries: [query, `${query} interview`],
    maxSearches: SECTION_MAX_SEARCHES, throwOnQuota: true,
  });
  if (hit && personName) {
    const parts = personName.toLowerCase().split(' ').filter(p => p.length > 2);
    if (!parts.some(p => hit.title.toLowerCase().includes(p))) {
      console.log('[ArticleVideos] Rejecting video - person name not in title:', hit.title, 'vs', personName);
      return null;
    }
  }
  return hit?.videoId || null;
}

/**
 * Fills the markers of the newest articles first (readers see those). Stops as soon as YouTube refuses again;
 * at most `maxSearches` sections per call, so one tick does not use up the day's quota.
 */
export async function fillPendingArticleVideos(maxSections = 6): Promise<{ filled: number; removed: number; articles: number; quota?: boolean }> {
  const mongoose = (await import('mongoose')).default;
  const dbConnect = (await import('@/lib/mongoose')).default;
  await dbConnect();
  const col = mongoose.connection.db!.collection('articles');
  const list = await col.find({ content: /<!--video-pending:/ }).sort({ createdAt: -1 }).project({ content: 1 }).limit(20).toArray();
  let filled = 0, removed = 0, done = 0, articles = 0;
  for (const a of list) {
    let html = String(a.content);
    const used = embeddedVideoIds(html);
    let touched = false;
    for (const { raw, data } of readMarkers(html)) {
      if (done >= maxSections) break;
      done++;
      let id: string | null = null;
      try {
        id = data.q ? await findSectionVideo(data.q, data.ctx, used, data.person) : null;
      } catch (e) {
        if (e instanceof YouTubeQuotaError) {
          if (touched) await col.updateOne({ _id: a._id }, { $set: { content: html } });
          return { filled, removed, articles, quota: true };
        }
        throw e;
      }
      if (id) { used.add(id); html = html.replace(raw, buildYoutubeIframe(id)); filled++; }
      else { html = html.replace(raw, ''); removed++; } // YouTube has nothing on topic - an unrelated video would be worse
      touched = true;
    }
    if (touched) { await col.updateOne({ _id: a._id }, { $set: { content: html } }); articles++; }
    if (done >= maxSections) break;
  }
  return { filled, removed, articles };
}
