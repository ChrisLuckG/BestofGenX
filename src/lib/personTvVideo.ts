// Every person article brings a video for GenX TV: a long documentary about the person if YouTube has
// one, otherwise a long interview. It goes on top of the GenX TV banner (hero position 1) and pushes
// the others down - waterfall: the newest is always first, the third falls out of the banner (it stays
// in GenX TV). Called from POST /api/articles for every article with a personRef, so the Menschen
// button, Daily Auto and RIP all get it.
//
// Server-only (MongoDB, YouTube key). The decisions are pure functions so they can be tested
// (scripts/check-person-tv-video.ts).
import dbConnect from '@/lib/mongoose';
import { berlinDateAt } from '@/lib/berlinTime';
import TVVideo from '@/models/TVVideo';
import { Person } from '@/models/Almanac';

export interface VideoCandidate {
  videoId: string;
  title: string;
  description?: string;
  seconds: number;
  embeddable: boolean;
  isPublic: boolean;
  ageRestricted: boolean;
  /** YouTube's audio / metadata language, if the uploader set one ("en", "en-US", "de" ...) */
  language?: string;
}

export type VideoKind = 'documentary' | 'interview' | 'other';

/** GenX TV is English-only: a video YouTube marks as another language is skipped (no mark = accepted). */
export const isEnglish = (lang?: string) => !lang || /^en\b/i.test(lang);

/** GenX TV shows long films only: MORE than 20 minutes, never less (a documentary preferred). */
export const MIN_SECONDS = 1200;

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const words = (s: string) => fold(s).split(/[^a-z0-9]+/).filter(w => w.length >= 2);

export function videoKind(title: string): VideoKind {
  const t = fold(title);
  if (/\b(documentary|doku|dokumentation|biography|life story|the story of|full doc|untold story|the rise and fall)\b/.test(t)) return 'documentary';
  if (/\b(interview|podcast|in conversation|conversation with|talks|q&a|sit down)\b/.test(t)) return 'interview';
  return 'other';
}

const JUNK = /\b(#shorts|shorts|tiktok|reaction|reacts? to|tier list|top \d+|compilation|meme|asmr|fan edit|edit|highlights? reel|prank|trailer|teaser)\b/i;

/**
 * Is this video about THIS person? Every part of the surname and the first name must be in the title.
 * (The old documentary button accepted any 3-letter part of the name, so "Adam" alone could pass.)
 */
export function titleNamesPerson(title: string, firstname: string, lastname: string): boolean {
  const t = new Set(words(title));
  const need = [...words(firstname).slice(0, 1), ...words(lastname)];
  return need.length > 0 && need.every(w => t.has(w));
}

/** The best video, or null. Documentary > interview > other, then longer first; never a clip, never unplayable. */
export function pickBestVideo(cands: VideoCandidate[], firstname: string, lastname: string): (VideoCandidate & { kind: VideoKind }) | null {
  const rank: Record<VideoKind, number> = { documentary: 0, interview: 1, other: 2 };
  const ok = cands
    .filter(c => c.embeddable && c.isPublic && !c.ageRestricted && c.seconds > MIN_SECONDS && isEnglish(c.language) && !JUNK.test(c.title) && titleNamesPerson(c.title, firstname, lastname))
    .map(c => ({ ...c, kind: videoKind(c.title) }));
  ok.sort((a, b) => rank[a.kind] - rank[b.kind] || b.seconds - a.seconds);
  return ok[0] || null;
}

/**
 * The waterfall: the new video takes position 1, the others move down one, the third leaves the banner.
 * `top` = the ids on positions 1, 2, 3 now (null for an empty slot). Returns the ids for 1, 2, 3 after.
 */
export function waterfall(top: (string | null)[], newId: string): string[] {
  return [newId, ...top.filter((id): id is string => !!id && id !== newId)].slice(0, 3);
}

export function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

const isoSeconds = (iso?: string) => { const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); return m ? (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) : 0; };

/** YouTube: up to 3 searches (100 quota units each), stopping at the first documentary; one videos.list (1 unit). */
/** Set when YouTube refused for quota reasons (403/429): "no video" then means "not now", not "none exists". */
let quotaHit = false;

async function searchCandidates(name: string): Promise<VideoCandidate[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  // YouTube's "long" filter = over 20 minutes; a documentary first, then a biography, then an interview
  const plan: [string, 'long'][] = [[`"${name}" documentary`, 'long'], [`"${name}" biography`, 'long'], [`"${name}" interview`, 'long']];
  const seen = new Map<string, { title: string; description: string }>();
  for (const [q, duration] of plan) {
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&videoDuration=${duration}&relevanceLanguage=en&regionCode=US&q=${encodeURIComponent(q)}&key=${key}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) { console.warn('[GenX TV] YouTube search', res.status, q); if (res.status === 403 || res.status === 429) { quotaHit = true; break; } continue; }
      for (const it of (await res.json()).items || []) if (it?.id?.videoId) seen.set(it.id.videoId, { title: it.snippet?.title || '', description: it.snippet?.description || '' });
    } catch (e) { console.warn('[GenX TV] YouTube search failed', q, e); }
    if (Array.from(seen.values()).some(v => videoKind(v.title) === 'documentary')) break;
  }
  if (!seen.size) return [];
  const ids = Array.from(seen.keys()).slice(0, 50);
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,status,snippet&id=${ids.join(',')}&key=${key}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) { if (res.status === 403 || res.status === 429) quotaHit = true; return []; }
    // Deleted / private videos are simply missing from this answer, so they drop out here.
    return ((await res.json()).items || []).map((v: any) => ({
      videoId: v.id,
      title: seen.get(v.id)?.title || '',
      description: seen.get(v.id)?.description || '',
      seconds: isoSeconds(v.contentDetails?.duration),
      embeddable: v.status?.embeddable !== false,
      isPublic: v.status?.privacyStatus === 'public',
      ageRestricted: v.contentDetails?.contentRating?.ytRating === 'ytAgeRestricted',
      language: v.snippet?.defaultAudioLanguage || v.snippet?.defaultLanguage || undefined,
    }));
  } catch { return []; }
}

/** Searches and picks, writes nothing (also used by scripts to try it out without touching the banner). */
export async function findPersonVideo(firstname: string, lastname: string) {
  return pickBestVideo(await searchCandidates(`${firstname} ${lastname}`.trim()), firstname, lastname);
}

/** Like findPersonVideo, and tells whether a "nothing" was only the used-up YouTube quota. */
async function findPersonVideoReporting(firstname: string, lastname: string) {
  quotaHit = false;
  const best = await findPersonVideo(firstname, lastname);
  return { best, quota: quotaHit };
}

/**
 * Puts the given TV video on position 1 of the GenX TV SIDEBAR WIDGET and moves the rest down (see waterfall).
 * The widget has its own positions (widgetPosition); the big hero on the TV page (featuredPosition) stays
 * what the admin set by hand - the article videos show on the TV page in the "Todays Bogxers" row instead.
 */
export async function putOnTop(tvVideoId: string): Promise<void> {
  const top: (string | null)[] = [null, null, null];
  for (const v of await TVVideo.find({ widgetPosition: { $in: [1, 2, 3] } }).select('_id widgetPosition').lean<{ _id: any; widgetPosition: number }[]>()) top[v.widgetPosition - 1] = String(v._id);
  const next = waterfall(top, tvVideoId);
  // Out of the widget first, then the new order - never two videos on one position.
  await TVVideo.updateMany({ widgetPosition: { $in: [1, 2, 3] }, _id: { $nin: next } }, { $set: { widgetPosition: null } });
  for (let i = next.length - 1; i >= 0; i--) await TVVideo.updateOne({ _id: next[i] }, { $set: { widgetPosition: i + 1, active: true } });
}

/** The TV page row for the newest article videos: the admin's category with "today" in its name ("Todays Bogxers"). */
export async function todayCategory(): Promise<string> {
  const TVCategory = (await import('@/models/TVCategory')).default;
  const c = await TVCategory.findOne({ name: /today/i }).select('name').lean<{ name: string }>();
  return c?.name || 'Todays Bogxers';
}

/** "Todays Bogxers" holds TODAY's person videos (Berlin day), at most 8; older ones / the 9th move to their own category. */
export const TODAY_MAX = 8;

const SPORT = /football|soccer|hockey|boxing|basket|baseball|tennis|golf|cycl|athlet|swim|ski|racing|motor|formula|rugby|cricket|volley|handball|wrestl|mma|sport|skat|surf|olymp|darts|snooker|fencing|rowing|judo|karate/i;

/**
 * The person's own TV category - where the video lives once it is no longer one of today's 8.
 * Returns a name from `available` (the admin's TV categories), matched case-insensitively.
 * The deceased go to "Rip"; otherwise by profession (Actor/Comedy -> Tv & Cinema, Music, Politik -> Politics,
 * any sport -> Sport, the rest -> Lifestyle).
 */
export function tvCategoryForPerson(p: { profession?: string; subcategory?: string; died?: string | null }, available: string[]): string {
  const find = (...names: string[]) => { for (const n of names) { const hit = available.find(a => a.toLowerCase() === n.toLowerCase()); if (hit) return hit; } return null; };
  const prof = `${p.profession || ''} ${p.subcategory || ''}`;
  const pick =
    (String(p.died ?? '').trim() && find('Rip', 'RIP')) ||
    (/actor|actress|comed|film|cinema|tv|television|director/i.test(prof) && find('Tv & Cinema', 'Movies')) ||
    (/music|singer|band|rapper|dj/i.test(prof) && find('Music')) ||
    (/politi/i.test(prof) && find('Politics')) ||
    (SPORT.test(prof) && find('Sport')) ||
    find('Lifestyle', 'Documentaries');
  return pick || 'Documentaries';
}

/**
 * Which videos leave "Todays Bogxers": everything that entered BEFORE today (`since` = 00:00 Berlin) - a
 * birthday of three days ago is not today's - and, of today's, everything after the newest TODAY_MAX.
 */
export function overflowToday<T extends { _id: unknown; todayAt?: Date | string | null; createdAt?: Date | string | null }>(inToday: T[], max = TODAY_MAX, since?: Date): T[] {
  const t = (v: T) => new Date((v.todayAt || v.createdAt || 0) as any).getTime();
  const old = since ? inToday.filter(v => t(v) < since.getTime()) : [];
  const fresh = [...inToday].filter(v => !old.includes(v)).sort((a, b) => t(b) - t(a));
  return [...old, ...fresh.slice(max)];
}

/** Move what no longer belongs in "Todays Bogxers" (from an earlier day, or beyond the 8) to its own category. */
export async function expireToday(): Promise<number> {
  await dbConnect();
  const today = await todayCategory();
  const inToday = await TVVideo.find({ category: today }).select('_id todayAt createdAt homeCategory').lean<{ _id: any; todayAt?: Date; createdAt?: Date; homeCategory?: string }[]>();
  const out = overflowToday(inToday, TODAY_MAX, berlinDateAt(0, 0));
  // arriving in its own row = the newest there, so it is shown first, not at the end
  for (const v of out) await TVVideo.updateOne({ _id: v._id }, { $set: { category: v.homeCategory || 'Lifestyle', todayAt: null, categoryAt: new Date() } });
  return out.length;
}

/** Put a video into "Todays Bogxers" (remembering its own category) and move the 9th newest out to its own. */
async function enterToday(tvVideoId: string, home: string, at: Date = new Date()): Promise<void> {
  const today = await todayCategory();
  await TVVideo.updateOne({ _id: tvVideoId }, { $set: { category: today, homeCategory: home, todayAt: at, categoryAt: at, active: true } });
  await expireToday();
}

async function homeCategoryFor(person: any): Promise<string> {
  const TVCategory = (await import('@/models/TVCategory')).default;
  const names = (await TVCategory.find({}).select('name').lean<{ name: string }[]>()).map(c => c.name).filter(n => !/today/i.test(n));
  return tvCategoryForPerson(person, names);
}

/**
 * Any person video - from an article or from the Menschen "Add to GenX TV" dialog - goes into "Todays Bogxers"
 * and later into the person's own category. Its current category counts as home only if it is one of the
 * admin's categories (the dialog used to write "Documentaries" / "Music Videos", which have no row).
 */
export async function placePersonVideoInToday(tvVideoId: string): Promise<void> {
  await dbConnect();
  const v = await TVVideo.findById(tvVideoId).select('category homeCategory personRef').lean<{ category?: string; homeCategory?: string; personRef?: any }>();
  if (!v) return;
  const TVCategory = (await import('@/models/TVCategory')).default;
  const adminCats = (await TVCategory.find({}).select('name').lean<{ name: string }[]>()).map(c => c.name);
  const today = await todayCategory();
  const person = v.personRef ? await Person.findById(v.personRef).select('profession subcategory died').lean() : null;
  const home = (v.homeCategory && adminCats.includes(v.homeCategory) && v.homeCategory) ||
    (v.category && v.category !== today && adminCats.includes(v.category) && v.category) ||
    (person ? await homeCategoryFor(person) : 'Lifestyle');
  await enterToday(tvVideoId, home);
}

export type TvResult = { added: boolean; reused?: boolean; tvVideoId?: string; youtubeId?: string; title?: string; kind?: VideoKind; duration?: string; reason?: string;
  /** true = try again later (YouTube quota used up, network) - the article is marked 'pending' */
  retry?: boolean;
  /** false = found, but kept hidden until the article is published */
  shown?: boolean };

/**
 * Make sure the person has a GenX TV video and put it on top of the banner. A person who already has
 * one (an earlier article, or set by hand in Menschen) keeps it - it just moves to the top again.
 * Never throws: the article is the main thing, the video an extra.
 */
/** `articleDate`: the day of the article - a video fetched late for an older article does not count as today's. */
/**
 * `show` false = the article is still a draft (Daily Auto prepares it up to an hour ahead): the video is looked up and
 * kept hidden (active: false); showArticleTvVideo() puts it on the banner when the ARTICLE goes live.
 */
export async function ensurePersonTvVideo(personId: string, articleDate: Date = new Date(), show = true): Promise<TvResult> {
  try {
    await dbConnect();
    const person = await Person.findById(personId).select('firstname lastname profession subcategory died').lean<{ firstname: string; lastname?: string; profession?: string; subcategory?: string; died?: string }>();
    if (!person) return { added: false, reason: 'person not found' };
    const name = `${person.firstname} ${person.lastname || ''}`.trim();

    const existing = await TVVideo.findOne({ personRef: personId }).sort({ createdAt: -1 }).lean<{ _id: any; youtubeId: string; title: string }>();
    if (existing) {
      if (!show) return { added: true, reused: true, shown: false, tvVideoId: String(existing._id), youtubeId: existing.youtubeId, title: existing.title };
      await putOnTop(String(existing._id));
      const cur = await TVVideo.findById(existing._id).select('category homeCategory').lean<{ category?: string; homeCategory?: string }>();
      const today = await todayCategory();
      await enterToday(String(existing._id), cur?.homeCategory || (cur?.category && cur.category !== today ? cur.category : await homeCategoryFor(person)), articleDate);
      return { added: true, reused: true, tvVideoId: String(existing._id), youtubeId: existing.youtubeId, title: existing.title };
    }

    const { best, quota } = await findPersonVideoReporting(person.firstname, person.lastname || '');
    if (!best) return quota
      ? { added: false, retry: true, reason: 'the daily YouTube quota is used up - tried again automatically later' }
      : { added: false, reason: `no documentary or interview over 20 minutes about ${name} on YouTube` };

    const already = await TVVideo.findOne({ youtubeId: best.videoId }).lean<{ _id: any }>();
    const doc = already
      ? await TVVideo.findByIdAndUpdate(already._id, { $set: { personRef: personId, ...(show ? { active: true } : {}) } }, { new: true })
      : await TVVideo.create({
          title: name,
          description: best.title,
          youtubeUrl: `https://www.youtube.com/watch?v=${best.videoId}`,
          youtubeId: best.videoId,
          thumbnail: `https://img.youtube.com/vi/${best.videoId}/hqdefault.jpg`,
          category: await homeCategoryFor(person), // its own category; enterToday() below puts it into "Todays Bogxers" first
          duration: formatSeconds(best.seconds),
          language: 'en',
          featured: true,
          active: show, // a draft's video stays hidden until the article is live
          personRef: personId,
        });
    if (!show) return { added: true, shown: false, tvVideoId: String(doc!._id), youtubeId: best.videoId, title: best.title, kind: best.kind, duration: formatSeconds(best.seconds) };
    await putOnTop(String(doc!._id));
    // newest first in 'Todays Bogxers'; the 9th newest moves on to its own category
    const docCat = (await TVVideo.findById(doc!._id).select('category homeCategory').lean<{ category?: string; homeCategory?: string }>());
    const todayName = await todayCategory();
    await enterToday(String(doc!._id), docCat?.homeCategory || (docCat?.category && docCat.category !== todayName ? docCat.category : await homeCategoryFor(person)), articleDate);
    return { added: true, tvVideoId: String(doc!._id), youtubeId: best.videoId, title: best.title, kind: best.kind, duration: formatSeconds(best.seconds) };
  } catch (e) {
    console.error('[GenX TV] ensurePersonTvVideo failed:', e);
    return { added: false, retry: true, reason: e instanceof Error ? e.message : 'failed' };
  }
}

/** Where an article stands with its GenX TV video: 'added' | 'none' (YouTube has nothing) | 'pending' (try again). */
export function tvStatusOf(r: TvResult): 'added' | 'none' | 'pending' {
  return r.added ? 'added' : r.retry ? 'pending' : 'none';
}

/** Store the outcome on the article (raw collection: a hot-reloaded schema would drop the field). */
export async function markArticleTv(articleId: string, r: TvResult): Promise<void> {
  const mongoose = (await import('mongoose')).default;
  await mongoose.connection.db!.collection('articles').updateOne(
    { _id: new mongoose.Types.ObjectId(articleId) },
    { $set: { tvVideoStatus: tvStatusOf(r), tvVideoCheckedAt: new Date(), ...(r.youtubeId ? { tvYoutubeId: r.youtubeId } : {}), ...(r.tvVideoId ? { tvVideoId: r.tvVideoId, tvShown: r.shown !== false } : {}) } },
  );
}

/**
 * Articles whose video could not be looked for (quota used up) get it later: called from every Daily Auto
 * tick (every 5 minutes), oldest first - so the newest article still ends up on top of the banner.
 * Stops as soon as YouTube refuses again.
 */
/**
 * The video of an article that is NOW live goes on the banner (widget waterfall + "Todays Bogxers"). Until then it was
 * kept hidden - it must come WITH the article, not an hour before it (Daily Auto prepares a draft ahead of its slot).
 */
export async function showArticleTvVideo(articleId: string): Promise<boolean> {
  await dbConnect();
  const mongoose = (await import('mongoose')).default;
  const col = mongoose.connection.db!.collection('articles');
  const a: any = await col.findOne({ _id: new mongoose.Types.ObjectId(articleId), status: 'published', tvShown: false, tvVideoId: { $exists: true } }, { projection: { personRef: 1, tvVideoId: 1, publishedAt: 1 } });
  if (!a) return false;
  // claim it first: two callers (publish + the tick) must not both move the banner
  const claim = await col.updateOne({ _id: a._id, tvShown: false }, { $set: { tvShown: true } });
  if (!claim.modifiedCount) return false;
  const person = a.personRef ? await Person.findById(a.personRef).select('profession subcategory died').lean() : null;
  const v = await TVVideo.findById(a.tvVideoId).select('category homeCategory').lean<{ category?: string; homeCategory?: string }>();
  if (!v) return false;
  const today = await todayCategory();
  await putOnTop(String(a.tvVideoId));
  await enterToday(String(a.tvVideoId), v.homeCategory || (v.category && v.category !== today ? v.category : await homeCategoryFor(person || {})), new Date(a.publishedAt || Date.now()));
  return true;
}

/** Every tick: videos of articles that went live (by any route) and are still hidden. */
export async function showLiveTvVideos(): Promise<number> {
  await dbConnect();
  const mongoose = (await import('mongoose')).default;
  const ids = await mongoose.connection.db!.collection('articles').find({ status: 'published', tvShown: false }).sort({ publishedAt: 1 }).limit(10).project({ _id: 1 }).toArray();
  let n = 0;
  for (const a of ids) if (await showArticleTvVideo(String(a._id))) n++;
  return n;
}

export async function retryPendingTvVideos(limit = 3): Promise<{ tried: number; added: number }> {
  await dbConnect();
  const mongoose = (await import('mongoose')).default;
  const pending = await mongoose.connection.db!.collection('articles')
    .find({ tvVideoStatus: 'pending', personRef: { $exists: true, $ne: null } })
    .sort({ createdAt: 1 }).limit(limit).project({ personRef: 1, publishedAt: 1, createdAt: 1, status: 1 }).toArray();
  let added = 0, tried = 0;
  for (const a of pending) {
    tried++;
    const r = await ensurePersonTvVideo(String(a.personRef), new Date(a.publishedAt || a.createdAt || Date.now()), a.status === 'published');
    await markArticleTv(String(a._id), r);
    if (r.added) added++;
    if (r.retry) break; // quota still gone - the next tick tries again
  }
  return { tried, added };
}
