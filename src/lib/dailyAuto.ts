// Daily Auto - server side. Reads/writes Mongo and drives the generators.
//
// The generators are the SAME routes the admin buttons use (/api/almanac/article,
// /api/generate-ranking, /api/articles, /api/polls, the History/Winners crons), called
// over HTTP, so a fix or refinement to "Create Article" / "Create Rankroll" applies to
// the automation as well. The pure timing rules live in dailyAutoSchedule.ts.
import OpenAI from 'openai';
import dbConnect from '@/lib/mongoose';
import { Person } from '@/models/Almanac';
import Article from '@/models/Article';
import Poll from '@/models/Poll';
import SongRequest from '@/models/SongRequest';
import PollVote from '@/models/PollVote';
import User from '@/models/User';
import { DailyAutoConfig, DailyAutoRun, type IDailyAutoRun } from '@/models/DailyAuto';
import { interestScore } from '@/lib/personScore';
import { dayMatchers, isGenXBirth } from '@/lib/dateShapes';
import { houseAuthor } from '@/lib/houseAuthor';
import { voiceForPerson, type VoiceId } from '@/lib/personVoice';
import { resolvePersonGender } from '@/lib/personGender';
import { buildRankrollCta } from '@/lib/rankrollCta';
import { RADIO_TAG, buildRadioPrompt, planRadio, radioSpotifyLinks, type RadioSong } from '@/lib/radioArticle';
import { ARTICLE_DEFAULT_OPTIONS, articleTagsForPerson, personFullName, rankrollTopicForPerson } from '@/lib/personContentDefaults';
import {
  DEFAULT_SLOTS, STALE_CLAIM_MIN, berlinCalendarDay, berlinWallTime, canStartGeneration, decideAction, kindProblem, slotTimes,
  type SlotConfig, type SlotKind,
} from '@/lib/dailyAutoSchedule';

/** Minimum Menschen score for an automatic article (same scale as the Menschen filter). */
export const MIN_PERSON_SCORE = 70;
/** How many candidates the "who is most famous" question is asked about. Deliberately
 *  large: on a typical day dozens of people tie on the same top score (85), so a short
 *  list cut by score is an arbitrary slice of the obscure ones. */
const FAME_SHORTLIST = 60;
/** An automatic article must be a real one: nobody reviews it before it goes live. Below
 *  this the person is skipped (thin source material -> the model writes a few sentences,
 *  e.g. 145 words) and the next-most-famous candidate is tried instead. */
export const MIN_ARTICLE_WORDS = 400;
const MAX_PERSON_ATTEMPTS = 3;
export const wordCount = (html: string) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

// ---------------------------------------------------------------- config

/** The hours come from DEFAULT_SLOTS; per slot the on/off switch AND the chosen type are stored. A
 *  stored type that is not allowed there any more (two History slots, Winners before 10:00 - e.g.
 *  after the rules changed) falls back to the default instead of breaking the schedule. */
export async function getSlots(): Promise<SlotConfig[]> {
  await dbConnect();
  const doc = await DailyAutoConfig.findOne({ key: 'default' }).lean();
  const stored = new Map((doc?.slots || []).map(s => [s.id, s]));
  const slots: SlotConfig[] = DEFAULT_SLOTS.map(d => {
    const st = stored.get(d.id);
    return { ...d, enabled: st ? !!st.enabled : d.enabled };
  });
  for (const slot of slots) {
    const kind = stored.get(slot.id)?.kind;
    if (kind && kind !== slot.kind && !kindProblem(slots, slot.id, kind as SlotKind)) slot.kind = kind as SlotKind;
  }
  return slots;
}

/** Change what a slot makes. Refused (with the reason) when that type cannot go there. */
export async function setSlotKind(slotId: string, kind: SlotKind): Promise<SlotConfig[]> {
  const slots = await getSlots();
  // The slot's current type is irrelevant to whether the new one fits, but a type that is
  // already ON this slot must not count as "another" slot
  const problem = kindProblem(slots, slotId, kind);
  if (problem) throw new Error(problem);
  const next = slots.map(s => (s.id === slotId ? { ...s, kind } : s));
  await DailyAutoConfig.findOneAndUpdate({ key: 'default' }, { $set: { slots: next } }, { upsert: true });
  return next;
}

/** The master switch. A missing field counts as ON (see the model).
 *
 *  Read and written through the raw collection, not the Mongoose model: the dev server
 *  keeps the model it compiled first (HMR), and a schema without `masterEnabled` strips
 *  the field from the $set - the switch then silently does nothing while the UI shows it
 *  as changed. For a switch whose OFF position must be trusted, that is not acceptable
 *  (same reason /api/articles/reorder bypasses the schema). */
export async function getMasterEnabled(): Promise<boolean> {
  await dbConnect();
  const doc = await DailyAutoConfig.collection.findOne({ key: 'default' }, { projection: { masterEnabled: 1 } });
  return doc?.masterEnabled !== false;
}

export async function setMasterEnabled(enabled: boolean): Promise<void> {
  await dbConnect();
  const res = await DailyAutoConfig.collection.updateOne({ key: 'default' }, { $set: { masterEnabled: enabled } }, { upsert: true });
  if (!res.acknowledged) throw new Error('Master switch was not saved');
  // Read it back: never report a position that is not what the cron will see
  if ((await getMasterEnabled()) !== enabled) throw new Error('Master switch did not persist');
}

export async function setSlotsEnabled(ids: string[] | 'all', enabled: boolean): Promise<SlotConfig[]> {
  const slots = (await getSlots()).map(s => (ids === 'all' || ids.includes(s.id) ? { ...s, enabled } : s));
  await DailyAutoConfig.findOneAndUpdate({ key: 'default' }, { $set: { slots } }, { upsert: true });
  return slots;
}

export async function getRuns(dayKey: string): Promise<Map<string, IDailyAutoRun>> {
  await dbConnect();
  const runs = await DailyAutoRun.find({ dayKey }).lean();
  return new Map(runs.map(r => [r.slotId, r as IDailyAutoRun]));
}

// ---------------------------------------------------------------- http helpers

async function callJson(origin: string, path: string, init?: RequestInit): Promise<any> {
  const secret = process.env.CRON_SECRET;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // The History/Winners routes are cron routes and check this header when a secret is set.
  if (secret && path.startsWith('/api/cron/')) headers.Authorization = `Bearer ${secret}`;
  const res = await fetch(`${origin}${path}`, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string>) } });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error(`${path} returned ${res.status}: ${text.slice(0, 160)}`); }
  if (!res.ok || data.success === false) throw new Error(`${path}: ${data.error || data.details || data.message || res.status}`);
  return data;
}

const post = (origin: string, path: string, body: unknown) =>
  callJson(origin, path, { method: 'POST', body: JSON.stringify(body) });

// ---------------------------------------------------------------- person selection

type PersonDoc = { _id: any; firstname: string; lastname: string; born?: string; image?: string; profession?: string; subcat?: string; knownfor?: string; [k: string]: any };

// The people collection stores dates in two shapes; dayMatchers() (lib/dateShapes.ts) understands both.
export { dayMatchers };

/**
 * Birthday candidates: ALIVE only, with a photo (it becomes the cover), no article yet, score 70+, Gen X.
 * Someone who has died is not celebrated on their birthday - they are remembered on the day they died
 * (the RIP slot, pickDeceased). This used to take "alive or dead", which put e.g. James Foley (died 2014)
 * among "today's birthdays".
 */
export function filterBirthdayCandidates(people: PersonDoc[], usedRefs: Set<string>, exclude: Set<string>): PersonDoc[] {
  return people.filter(p =>
    !String(p.died ?? '').trim() &&
    !!p.image && isGenXBirth(p.born) &&
    !usedRefs.has(String(p._id)) && !exclude.has(String(p._id)) &&
    interestScore(p as any) >= MIN_PERSON_SCORE);
}

async function eligiblePeople(born: RegExp, exclude: Set<string>): Promise<PersonDoc[]> {
  const usedRefs = new Set((await Article.distinct('personRef', { personRef: { $exists: true, $ne: null } })).map(String));
  const people = await Person.find({ born, isRejected: { $ne: true }, hasArticle: { $ne: true } }).lean<PersonDoc[]>();
  return filterBirthdayCandidates(people, usedRefs, exclude);
}

/** "Most famous" has no field in the data - the score measures completeness, not fame -
 *  so the shortlist (best-scored first) is put to the model. Falls back to the score. */
async function chooseMostFamous(candidates: PersonDoc[]): Promise<PersonDoc> {
  const shortlist = [...candidates].sort((a, b) => interestScore(b as any) - interestScore(a as any)).slice(0, FAME_SHORTLIST);
  if (shortlist.length === 1 || !process.env.OPENAI_API_KEY) return shortlist[0];
  try {
    const list = shortlist.map((p, i) => `${i}: ${personFullName(p)} - ${[p.profession, p.subcat].filter(Boolean).join(', ')}; known for: ${p.knownfor || 'n/a'}`).join('\n');
    const completion = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: `Which of these people is the most famous worldwide? Answer only from the list.\n${list}\n\nReturn JSON: {"index": <number>}` }],
    });
    const index = JSON.parse(completion.choices[0]?.message?.content || '{}').index;
    if (Number.isInteger(index) && shortlist[index]) return shortlist[index];
  } catch (e) {
    console.error('[DailyAuto] fame ranking failed, using score order:', e);
  }
  return shortlist[0];
}

/** Today's birthdays first; if nobody qualifies, anyone born this month. `exclude` holds
 *  people already tried for this slot. */
export async function pickPerson(dayKey: string, exclude: Set<string> = new Set()): Promise<PersonDoc> {
  await dbConnect();
  const [, mm, dd] = dayKey.split('-');
  const { day, month } = dayMatchers(dayKey);
  let candidates = await eligiblePeople(day, exclude);
  if (!candidates.length) candidates = await eligiblePeople(month, exclude);
  if (!candidates.length) throw new Error(`No eligible person for ${dd}.${mm}. (needs score ${MIN_PERSON_SCORE}+, a photo, and no article yet)`);
  return chooseMostFamous(candidates);
}

/**
 * RIP candidates: people who died on THIS day of the year (any year - the anniversary; this also
 * catches someone who died today). Same bar as the birthday pick (photo, score 70+), but "no article
 * yet" means no RIP article: a person who already had a birthday article is exactly who gets
 * remembered on the day they died. No month fallback - "who died today" has no month-wide
 * substitute; on a day with nobody, the slot is skipped (see nobodyToday below).
 */
export function filterRipCandidates(people: PersonDoc[], ripRefs: Set<string>, exclude: Set<string>): PersonDoc[] {
  return people.filter(p =>
    !!p.image &&
    isGenXBirth(p.born) && // Gen X: born 1965-1980 - they died young, and they are who this site remembers
    !ripRefs.has(String(p._id)) && !exclude.has(String(p._id)) &&
    !(p.hasArticle && p.discoveredFor === 'rip') && // a RIP piece from before articles knew their person
    interestScore(p as any) >= MIN_PERSON_SCORE);
}

/** Marks the "nobody qualifies today" case: normal on most days, so a skip - not an error. */
const nobodyToday = (message: string) => Object.assign(new Error(message), { nobodyToday: true });

export async function pickDeceased(dayKey: string, exclude: Set<string> = new Set()): Promise<PersonDoc> {
  await dbConnect();
  const [, mm, dd] = dayKey.split('-');
  const ripRefs = new Set((await Article.distinct('personRef', { category: 'rip', personRef: { $exists: true, $ne: null } })).map(String));
  const people = await Person.find({ died: dayMatchers(dayKey).day, isRejected: { $ne: true } }).lean<PersonDoc[]>();
  const candidates = filterRipCandidates(people, ripRefs, exclude);
  if (!candidates.length) throw nobodyToday(`nobody who died on ${dd}.${mm}. qualifies (needs score ${MIN_PERSON_SCORE}+, a photo, no RIP article yet)`);
  return chooseMostFamous(candidates);
}

/** Added to the article brief for a RIP piece. The voice stays the neutral one (never a comedic voice here). */
const RIP_BRIEF = 'This is a remembrance article (RIP) for someone who died on this day of the year. Be respectful and warm: honour the life and the work, say what they left behind. Never joke about the death or about the person, no sarcasm, no "fun facts" tone around the death. In ONE sentence, in the opening or the closing, say that today is the anniversary of their death and that BOGX remembers them today - the reader must know why we are writing about them today. Say it once only.';

// ---------------------------------------------------------------- generators

type Generated = { articleId?: string; pollId?: string; personName?: string; message?: string; live?: boolean };

/** Same steps as Menschen: AI article -> save; optionally the rankroll with CTAs both ways.
 *  `mode` 'rip' = the person is someone who died on this day (see pickDeceased): a remembrance
 *  article, filed under RIP, never with a rankroll; no candidate that day = skipped, not an error. */
export async function generateBogx(origin: string, withRankroll: boolean, dayKey: string, exclude: Set<string> = new Set(), mode: 'birthday' | 'rip' = 'birthday'): Promise<Generated> {
  // The most famous candidate first; a too-short result moves on to the next one.
  // `exclude` (Rerun: the person being replaced) counts as already tried.
  const tried = new Set<string>(exclude);
  const tooShort: string[] = [];
  let person!: PersonDoc, name = '', gen: any, content = '', voice: VoiceId = 'informative';
  for (let attempt = 1; attempt <= MAX_PERSON_ATTEMPTS; attempt++) {
    try { person = mode === 'rip' ? await pickDeceased(dayKey, tried) : await pickPerson(dayKey, tried); }
    catch (e) {
      if (tooShort.length) break; // nobody left: report the short results, not "no person"
      if ((e as { nobodyToday?: boolean }).nobodyToday) return { live: true, message: `Skipped: ${(e as Error).message}` };
      throw e;
    }
    tried.add(String(person._id));
    name = personFullName(person);
    // The author voice by person (lib/personVoice.ts): sport men Irvine Welsh, sport women Ephron/Drakulic, the rest by
    // kind; RIP stays informative. The gender comes from Wikidata once and is stored on the person.
    voice = voiceForPerson(person as any, await resolvePersonGender(person), mode === 'rip' ? 'rip' : 'birthday');
    const options = { ...ARTICLE_DEFAULT_OPTIONS, tone: voice, ...(mode === 'rip' ? { extra: RIP_BRIEF } : {}) };
    gen = await post(origin, '/api/almanac/article', { person: { ...person, _id: String(person._id) }, options });
    content = gen.content || gen.article || '';
    const words = wordCount(content);
    if (words >= MIN_ARTICLE_WORDS) { tooShort.length = 0; break; }
    tooShort.push(`${name} (${words} words)`);
    console.warn(`[DailyAuto] ${name}: only ${words} words (minimum ${MIN_ARTICLE_WORDS}) - trying the next person`);
  }
  if (tooShort.length) throw new Error(`No article reached ${MIN_ARTICLE_WORDS} words, nothing was published: ${tooShort.join(', ')}`);

  let pollId: string | undefined;
  if (withRankroll) {
    const { ranking } = await post(origin, '/api/generate-ranking', { topic: rankrollTopicForPerson(person) });
    const poll = await post(origin, '/api/polls', {
      title: ranking.title, subtitle: ranking.subtitle, image: person.image || ranking.items?.[0]?.image || '',
      type: 'ranking', items: ranking.items, category: 'ranking',
      // draft until the slot starts; goes 'active' together with the article
      status: 'draft', personRef: String(person._id),
    });
    pollId = String(poll.poll._id);
    // Article -> rankroll: the CTA block. Rankroll -> article: linkedArticleId below
    // (and /api/polls/[id] also finds the article through this very CTA's data-rankroll-id).
    content += `\n${buildRankrollCta(pollId, ranking.title)}`;
  }

  try {
    // Automatic articles are by Eastercorn (lib/houseAuthor.ts); without that account: "BOGX Team" as before
    const house = await houseAuthor();
    const saved = await post(origin, '/api/articles', {
      userId: house?.id || 'system',
      title: gen.title || `${name}: ${person.profession} Icon`,
      subtitle: gen.subtitle || `A look at the life and career of ${name}`,
      content,
      tags: (() => {
        const base: string[] = gen.tags?.length ? gen.tags : articleTagsForPerson(person);
        return mode === 'rip' && !base.some(t => t.toLowerCase() === 'rip') ? [...base, 'RIP'] : base;
      })(),
      // The route files a person by their own data (music, sports...), which is right for a birthday
      // piece. A remembrance piece belongs under RIP, whatever the profession was.
      category: mode === 'rip' ? 'rip' : gen.category || 'lifestyle',
      coverImage: person.image, thumbnailUrl: person.image, imagePosX: 50, imagePosY: 50,
      status: 'draft', contentType: 'article', autoGenerated: true,
      personRef: String(person._id),
      personCountry: person.countryBorn || person.nationality || '',
      personCityBorn: person.cityBorn || '',
      aiTone: voice, // the voice it was written in (lib/personVoice.ts) - the editor shows it
      personName: name, personBirthday: person.born,
    });
    const articleId = String(saved.article._id);
    // NO poll.linkedArticleId / article.linkedContentId, on purpose. ArticlePage looks for a
    // poll via /api/polls?articleId= (= linkedArticleId) and, when it finds one, embeds the
    // WHOLE rankroll list under the article. A person article has only the Vote CTA in its
    // text; the rankroll finds its article through that CTA's data-rankroll-id
    // (/api/polls/[id] -> linkedArticle). That is how every earlier person rankroll is built.
    return { articleId, pollId, personName: name, message: mode === 'rip' ? `RIP ${name} (died ${person.died})` : `${name}${pollId ? ' + rankroll' : ''}` };
  } catch (e) {
    // Do not leave a rankroll behind that no article points to.
    if (pollId) await Poll.deleteOne({ _id: pollId }).catch(() => {});
    throw e;
  }
}

/** Event titles of the History articles of the last 3 weeks, so the reporters are told what
 *  has been told already. The History modal keeps the same list in the browser (21 days,
 *  localStorage) - a multi-day event such as Woodstock must not be retold once per day. */
async function recentHistoryTitles(): Promise<string[]> {
  const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
  const articles = await Article.find({ category: 'history', createdAt: { $gte: since } }).select('content').lean<{ content?: string }[]>();
  const titles: string[] = [];
  for (const a of articles) {
    for (const h of (a.content || '').match(/<h2[^>]*>[^<]+<\/h2>/gi) || []) {
      // "<h2>October 14, 1985: Live Aid Rocks the World</h2>" -> "Live Aid Rocks the World"
      const t = h.replace(/<[^>]+>/g, '').replace(/^[A-Z][a-z]+ \d{1,2}(, \d{4})?:\s*/, '').trim();
      if (t) titles.push(t);
    }
  }
  return titles;
}

const HISTORY_MIN_EVENTS = 3;
/** Tries per reporter: an event the route rejects for lack of video is excluded and the
 *  reporter is asked for another one (the History modal's "re-roll"). */
export const HISTORY_EVENT_ATTEMPTS = 3;
/** This many reporters in a row that find nothing with a video = YouTube is down or out of
 *  quota; stop asking instead of burning model calls on a search that cannot succeed. */
const NO_VIDEO_ABORT_AFTER = 2;

/**
 * Ask the reporters for one event each, one after the other (each told what the others found).
 * `request` calls /api/editorial/history-event; it must throw when the route refuses. Kept
 * separate from the HTTP call so the retry and abort rules can be tested
 * (scripts/check-history-events.ts).
 */
export async function collectHistoryEvents(
  reporters: { id: string; name: string }[],
  exclude: string[],
  request: (reporterId: string, excludeEvents: string[]) => Promise<any>,
): Promise<{ events: any[]; failed: string[]; noVideoAbort: boolean }> {
  const found = [...exclude];
  const events: any[] = [];
  const failed: string[] = [];
  let dry = 0;
  for (const r of reporters) {
    const rejected: string[] = [];
    let lastMessage = '';
    let onlyNoVideo = true;
    let got = false;
    for (let attempt = 1; attempt <= HISTORY_EVENT_ATTEMPTS; attempt++) {
      try {
        const data = await request(r.id, [...found, ...rejected]);
        if (!data.event?.title) throw new Error('no event returned');
        found.push(data.event.title);
        events.push({ ...data.event, reporterId: r.id, reporterName: r.name });
        got = true;
        break;
      } catch (e) {
        lastMessage = e instanceof Error ? e.message : String(e);
        const noVideoFor = lastMessage.match(/No video found for "(.+?)"/);
        if (!noVideoFor) { onlyNoVideo = false; break; } // some other problem: retrying will not help
        rejected.push(noVideoFor[1]);
      }
    }
    if (got) { dry = 0; continue; }
    failed.push(`${r.name}: ${lastMessage}`);
    dry = onlyNoVideo ? dry + 1 : 0;
    if (dry >= NO_VIDEO_ABORT_AFTER) return { events, failed, noVideoAbort: true };
  }
  return { events, failed, noVideoAbort: false };
}
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * The History article, made the way it is made by hand in the History modal:
 *   1. every AI reporter proposes one event for today - one after the other, each told what the
 *      others already found, otherwise several come back with the same one
 *   2. a headline is chosen and the banner is generated (/api/editorial/history-banner returns both)
 *   3. the article is saved straight from those events
 * This replaces /api/cron/daily-facts-article, whose cover generation was refused three times
 * in a row ("Failed to generate AI cover image after 3 attempts") - the banner route builds
 * a different picture and gets through. Created as a draft, it goes live at the slot's start.
 */
export async function generateHistory(origin: string, dayKey: string, force = false): Promise<Generated> {
  const [, mm, dd] = dayKey.split('-');
  const todayLabel = `${MONTH_NAMES[Number(mm) - 1]} ${Number(dd)}`;

  // An article for today may already exist (written by hand in the History modal): use it
  // rather than telling the same day twice. Rerun skips this on purpose.
  if (!force) {
    const existing = await Article.findOne({
      category: 'history',
      title: { $regex: `^${todayLabel}:` },
      createdAt: { $gte: berlinWallTime(dayKey, '00:00') },
    }).select('title').lean<{ _id: any; title: string }>();
    if (existing) return { articleId: String(existing._id), message: `${existing.title} (existed already)` };
  }

  // 1. the reporters (the admin account "Eastercorn" is not one)
  const roster = await callJson(origin, '/api/admin/users?isAIReporter=true');
  const reporters: { id: string; name: string }[] = (roster.users || [])
    .filter((u: any) => u._id && u.username !== 'ai_eastercorn' && u.displayName !== 'Eastercorn')
    .map((u: any) => ({ id: String(u._id), name: u.displayName || u.username }));
  if (!reporters.length) throw new Error('No AI reporters are set up - nobody can propose an event');

  // Every event must come with a video: all earlier History articles have one per event, and
  // nobody is there to paste a link in afterwards. (The modal asks for allowWithoutVideo
  // because a person can fix that by hand; an automatic run cannot.)
  const { events, failed, noVideoAbort } = await collectHistoryEvents(
    reporters,
    await recentHistoryTitles(),
    (reporterId, excludeEvents) => post(origin, '/api/editorial/history-event', { reporterId, excludeEvents, allowWithoutVideo: false }),
  );
  if (noVideoAbort) {
    throw new Error(`No reporter found an event WITH a video - YouTube is probably out of search quota today (it resets at 09:00 Berlin). Nothing was published. ${failed.join('; ')}`);
  }
  if (events.length < HISTORY_MIN_EVENTS) {
    throw new Error(`Only ${events.length} of ${reporters.length} reporters found an event with a video (need ${HISTORY_MIN_EVENTS}): ${failed.join('; ')}`);
  }

  // 2. banner + headline
  const banner = await post(origin, '/api/editorial/history-banner', {
    events: events.map(e => ({ title: e.title, year: e.year, category: e.category })),
  });
  if (!banner.imageUrl) throw new Error(banner.error || 'The banner was not generated');
  let headline: string | undefined = banner.headline;
  if (!headline) {
    const h = await post(origin, '/api/editorial/history-headline', { events: events.map(e => ({ title: e.title, year: e.year })) }).catch(() => null);
    headline = h?.headline;
  }

  // 3. the article, straight from the events
  const compiled = await post(origin, '/api/editorial/history-compile', {
    events: events.map(e => ({
      title: e.title, year: e.year, date: e.date, description: e.description, category: e.category,
      youtubeSearch: e.youtubeSearch, youtubeVideoId: e.youtubeVideoId, reporterId: e.reporterId, reporterName: e.reporterName,
    })),
    bannerImage: banner.imageUrl,
    headline,
    draft: true,
    autoGenerated: true,
  });
  if (!compiled.articleId) throw new Error(compiled.error || 'The History article was not saved');
  return { articleId: String(compiled.articleId), message: `${compiled.title || headline} (${events.length} events)` };
}

/** Reports the ranking day that just ended; the route publishes on creation. */
async function generateWinners(origin: string, force = false): Promise<Generated> {
  const data = await callJson(origin, `/api/cron/daily-winners-article${force ? '?force=true' : ''}`);
  if (!data.articleId) return { live: true, message: data.message || 'Nothing to report' };
  return { articleId: String(data.articleId), live: true, message: data.title || data.message };
}

/**
 * The Community Radio article, made the way the Radio window makes it: the songs marked "Added"
 * go to a reporter through /api/editorial/chat (`articleMode`, `skipYoutube`, `spotifyLinks`), and
 * the article lands as a draft. It uses no YouTube search, so it costs none of the daily quota.
 *
 * Which songs: see planRadio. An automatic run only takes songs added since the previous radio
 * article, at most one article a week, and says "skipped" instead of repeating itself; Run now
 * and Rerun (`manual`) take everything marked "Added", like the window. Returning no articleId
 * is how a run says "nothing to make" - the slot then reads "Skipped" with the reason.
 */
export async function generateRadio(origin: string, manual: boolean, replacedArticleId?: string): Promise<Generated> {
  // The previous radio article: the ones Daily Auto tagged, plus the ones made in the window
  // before the tag existed (the chat route gives them community + playlist tags)
  const earlier = (await Article.find({
    category: 'music',
    $or: [{ tags: RADIO_TAG }, { tags: { $all: ['community', 'playlist'] } }],
  }).select('createdAt').sort({ createdAt: -1 }).lean<{ _id: any; createdAt: Date }[]>())
    .filter(a => String(a._id) !== replacedArticleId);

  const requests = await SongRequest.find({ status: 'added' })
    .select('username playlist band song link coverImage updatedAt')
    .lean<(RadioSong & { updatedAt?: Date })[]>();
  const plan = planRadio(requests, earlier[0]?.createdAt ?? null, new Date(), manual);
  if (plan.skip) return { live: true, message: `Skipped: ${plan.skip}` };

  // The reporters take turns, so the voice changes from one radio article to the next
  const roster = await callJson(origin, '/api/admin/users?isAIReporter=true');
  const reporters: { id: string; name: string }[] = (roster.users || [])
    .filter((u: any) => u._id && u.username !== 'ai_eastercorn' && u.displayName !== 'Eastercorn')
    .map((u: any) => ({ id: String(u._id), name: u.displayName || u.username }));
  if (!reporters.length) throw new Error('No AI reporters are set up - nobody can write the radio article');
  const reporter = reporters[earlier.length % reporters.length];

  const data = await post(origin, '/api/editorial/chat', {
    reporterUserId: reporter.id,
    message: buildRadioPrompt(plan.songs),
    articleMode: true,
    skipYoutube: true,
    spotifyLinks: radioSpotifyLinks(plan.songs),
    // autoPublish omitted: a draft, which goes live at the slot's start
  });
  const articleId = data.articleDraftId || data.articleId;
  if (!articleId) throw new Error(data.error || data.response || 'No radio article was returned');
  // Mark it (the next run measures from it) and file it as Music: the chat route falls back to
  // 'culture', which the category dropdown does not list
  await Article.updateOne({ _id: articleId }, { $addToSet: { tags: RADIO_TAG }, $set: { category: 'music' } });
  return { articleId: String(articleId), message: `${plan.songs.length} songs, written by ${reporter.name}` };
}

/** `replace` (Rerun): an article for this slot already exists, so skip the "already exists"
 *  shortcuts of History/Winners and keep the replaced person out. `manual` (Run now, Rerun): a person
 *  asked for it, so the Radio article uses every "Added" song like the window does. */
async function generateForSlot(
  slot: SlotConfig, origin: string, dayKey: string,
  replace?: { excludePersonIds: Set<string>; replacedArticleId?: string },
  manual = false,
): Promise<Generated> {
  switch (slot.kind) {
    case 'bogx': return generateBogx(origin, false, dayKey, replace?.excludePersonIds);
    case 'bogx-rankroll': return generateBogx(origin, true, dayKey, replace?.excludePersonIds);
    case 'history': return generateHistory(origin, dayKey, !!replace);
    case 'winners': return generateWinners(origin, !!replace);
    case 'radio': return generateRadio(origin, manual || !!replace, replace?.replacedArticleId);
    case 'rip': return generateBogx(origin, false, dayKey, replace?.excludePersonIds, 'rip');
  }
}

// ---------------------------------------------------------------- publish

/** Through the admin PUT route, not a raw update: first publication sets publishedAt
 *  and auto-places the article into the layout template.
 *
 *  `order: 0` on purpose: dragging ANY row in the Post Manager rewrites `order` for every
 *  article in the list - drafts included - and a lower number sorts higher. A draft that
 *  was written an hour before its slot would be pinned at its list index and go live
 *  somewhere in the middle instead of on top. 0 means "no manual position": it is
 *  ordered by date, i.e. newest first. */
async function publishRun(run: Pick<IDailyAutoRun, 'articleId' | 'pollId'>, origin: string): Promise<void> {
  if (run.articleId) {
    const admin = await User.findOne({ isAdmin: true }).select('_id').lean<{ _id: any }>();
    if (!admin) throw new Error('No admin user available to publish with');
    await callJson(origin, `/api/articles/${run.articleId}`, { method: 'PUT', body: JSON.stringify({ userId: String(admin._id), status: 'published', order: 0 }) });
  }
  if (run.pollId) await Poll.updateOne({ _id: run.pollId }, { $set: { status: 'active' } });
}

// ---------------------------------------------------------------- runs

async function claim(dayKey: string, slotId: string, force: boolean): Promise<boolean> {
  const fresh = { phase: 'generating' as const, claimedAt: new Date() };
  try {
    if (!force) { await DailyAutoRun.create({ dayKey, slotId, ...fresh }); return true; }
    const current = await DailyAutoRun.findOne({ dayKey, slotId }).lean();
    if (current?.phase === 'generating' && current.claimedAt && Date.now() - new Date(current.claimedAt).getTime() < STALE_CLAIM_MIN * 60000) return false;
    await DailyAutoRun.findOneAndUpdate(
      { dayKey, slotId },
      { $set: fresh, $unset: { articleId: 1, pollId: 1, personName: 1, message: 1 } },
      { upsert: true },
    );
    return true;
  } catch (e: any) {
    if (e?.code === 11000) return false; // another tick already holds this slot
    throw e;
  }
}

const finish = (dayKey: string, slotId: string, set: Partial<IDailyAutoRun>) =>
  DailyAutoRun.updateOne({ dayKey, slotId }, { $set: set });

/** Generate one slot; publish straight away when its start time has arrived (or `publishNow`). */
async function generateSlot(slot: SlotConfig, origin: string, dayKey: string, now: Date, publishNow: boolean): Promise<string> {
  try {
    const out = await generateForSlot(slot, origin, dayKey, undefined, publishNow);
    const due = publishNow || now >= slotTimes(slot, dayKey).startAt;
    const base = { articleId: out.articleId, pollId: out.pollId, personName: out.personName, message: out.message };
    if (out.live) { await finish(dayKey, slot.id, { ...base, phase: 'published' }); return `live: ${out.message || ''}`; }
    if (!due) { await finish(dayKey, slot.id, { ...base, phase: 'ready' }); return `ready: ${out.message || ''}`; }
    await publishRun(out, origin);
    await finish(dayKey, slot.id, { ...base, phase: 'published' });
    return `published: ${out.message || ''}`;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[DailyAuto] slot ${slot.id} failed:`, message);
    await finish(dayKey, slot.id, { phase: 'error', message });
    return `error: ${message}`;
  }
}

/** The hourly cron tick: publish what is ready and due, then generate what is due. */
export async function tickDailyAuto(origin: string, now: Date = new Date()) {
  const started = Date.now();
  const dayKey = berlinCalendarDay(now);
  // Master switch off = a full stop: no generation AND no publishing of finished drafts.
  if (!(await getMasterEnabled())) return { dayKey, log: [{ slot: '*', action: 'none', result: 'Daily Auto is switched off' }] };
  const slots = await getSlots();
  const runs = await getRuns(dayKey);
  const log: { slot: string; action: string; result: string }[] = [];

  for (const slot of slots) {
    const run = runs.get(slot.id) || null;
    const action = decideAction(slot, run, now, dayKey);
    if (action === 'mark-stale') {
      await finish(dayKey, slot.id, { phase: 'error', message: 'Generation timed out (no result after 10 minutes)' });
      log.push({ slot: slot.id, action, result: 'marked as error' });
    } else if (action === 'publish' && run) {
      try { await publishRun(run, origin); await finish(dayKey, slot.id, { phase: 'published' }); log.push({ slot: slot.id, action, result: 'published' }); }
      catch (e) { const message = e instanceof Error ? e.message : String(e); await finish(dayKey, slot.id, { phase: 'error', message }); log.push({ slot: slot.id, action, result: `error: ${message}` }); }
    }
  }

  const due = slots
    .filter(s => decideAction(s, runs.get(s.id) || null, now, dayKey) === 'generate')
    .sort((a, b) => slotTimes(a, dayKey).startAt.getTime() - slotTimes(b, dayKey).startAt.getTime());
  for (const slot of due) {
    // Not enough of the 300s left for this kind: it waits for the next tick (its window is an hour+)
    if (!canStartGeneration(Date.now() - started, slot.kind)) { log.push({ slot: slot.id, action: 'generate', result: 'deferred (time budget)' }); continue; }
    if (!(await claim(dayKey, slot.id, false))) { log.push({ slot: slot.id, action: 'generate', result: 'already claimed' }); continue; }
    log.push({ slot: slot.id, action: 'generate', result: await generateSlot(slot, origin, dayKey, now, false) });
  }
  return { dayKey, log };
}

/** Admin "Run now": generate and publish immediately, whatever the clock says. */
export async function runSlotNow(slotId: string, origin: string): Promise<string> {
  const slot = (await getSlots()).find(s => s.id === slotId);
  if (!slot) throw new Error(`Unknown slot ${slotId}`);
  const now = new Date();
  const dayKey = berlinCalendarDay(now);
  if (!(await claim(dayKey, slot.id, true))) throw new Error('This slot is already generating');
  return generateSlot(slot, origin, dayKey, now, true);
}

/** Delete what a run produced: the article (through the admin DELETE route, like the Post
 *  Manager), its rankroll with the votes, and the person's "has an article" marker. */
async function removeRunOutput(
  run: Pick<IDailyAutoRun, 'articleId' | 'pollId'>,
  personRef: string | undefined,
  origin: string,
): Promise<void> {
  if (run.articleId) {
    const admin = await User.findOne({ isAdmin: true }).select('_id').lean<{ _id: any }>();
    if (!admin) throw new Error('No admin user available to delete with');
    const res = await fetch(`${origin}/api/articles/${run.articleId}?userId=${String(admin._id)}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`Deleting the previous article failed (${res.status})`);
  }
  if (run.pollId) {
    await PollVote.deleteMany({ pollId: run.pollId });
    await Poll.deleteOne({ _id: run.pollId });
  }
  if (personRef) {
    // Only release the person when the marker still points at the article just removed
    const person = await Person.findById(personRef).select('articleId').lean<{ articleId?: any }>();
    if (person && String(person.articleId || '') === String(run.articleId || '')) {
      await Person.updateOne({ _id: personRef }, { $set: { hasArticle: false }, $unset: { articleId: 1, articleCreatedAt: 1, articleCreatedBy: 1 } });
    }
  }
}

/**
 * Admin "Rerun": replace this slot's article of today with a freshly generated one.
 *
 * The NEW one is created first and the old one removed only after that succeeded - a failed
 * generation leaves the existing article untouched. If the old one was live, the new one goes
 * live at once (the slot is never empty for long); if it was only a draft waiting for its
 * start time, the new one waits for it too. For Bogx slots the replaced person is skipped,
 * so the result is a different article about someone else.
 */
export async function rerunSlot(
  slotId: string,
  origin: string,
  /** Injectable for scripts/check-daily-auto-rerun.ts only; production passes nothing. */
  opts: { now?: Date; generate?: typeof generateForSlot } = {},
): Promise<string> {
  const slot = (await getSlots()).find(s => s.id === slotId);
  if (!slot) throw new Error(`Unknown slot ${slotId}`);
  const now = opts.now ?? new Date();
  const dayKey = berlinCalendarDay(now);
  const prev = await DailyAutoRun.findOne({ dayKey, slotId }).lean<IDailyAutoRun>();
  if (!prev?.articleId) return runSlotNow(slotId, origin); // nothing to replace

  if (prev.phase === 'generating' && prev.claimedAt && Date.now() - new Date(prev.claimedAt).getTime() < STALE_CLAIM_MIN * 60000) {
    throw new Error('This slot is already generating');
  }
  const prevArticle = await Article.findById(prev.articleId).select('autoGenerated tags personRef').lean<{ autoGenerated?: boolean; tags?: string[]; personRef?: any }>();
  // Never delete something an editor wrote: the run only records ids, and the History/Winners
  // routes may hand back an article that already existed.
  if (prevArticle && !prevArticle.autoGenerated && !(prevArticle.tags || []).includes('daily-winners')) {
    throw new Error('The current article was not generated automatically - delete it by hand in the Post Manager.');
  }
  const personRef = prevArticle?.personRef ? String(prevArticle.personRef) : undefined;
  const wasLive = prev.phase === 'published';

  // Keep the old ids on the record while generating: if anything fails they are put back.
  await DailyAutoRun.updateOne({ dayKey, slotId }, { $set: { phase: 'generating', claimedAt: new Date() } });
  let out: Generated | undefined;
  let oldRemoved = false;
  try {
    out = await (opts.generate ?? generateForSlot)(slot, origin, dayKey, { excludePersonIds: new Set(personRef ? [personRef] : []), replacedArticleId: prev.articleId }, true);
    if (!out.articleId || out.articleId === prev.articleId) {
      throw new Error(out.articleId ? 'The generator returned the current article again - nothing was replaced' : (out.message || 'Nothing new was generated'));
    }
    await removeRunOutput(prev, personRef, origin);
    oldRemoved = true;
    const due = wasLive || now >= slotTimes(slot, dayKey).startAt;
    const base = { articleId: out.articleId, pollId: out.pollId, personName: out.personName, message: out.message };
    if (out.live || due) {
      if (!out.live) await publishRun(out, origin);
      await finish(dayKey, slotId, { ...base, phase: 'published' });
      return `replaced and live: ${out.message || ''}`;
    }
    await finish(dayKey, slotId, { ...base, phase: 'ready' });
    return `replaced, goes live ${slot.start}: ${out.message || ''}`;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (oldRemoved && out?.articleId) {
      // The old article is already gone: point the record at the replacement and show the error
      await finish(dayKey, slotId, { articleId: out.articleId, pollId: out.pollId, personName: out.personName, phase: 'error', message: `Replacement created but not published: ${message}` });
    } else {
      // Nothing was replaced: remove a half-made replacement (never the current article) and
      // put the record back as it was
      if (out?.articleId && out.articleId !== prev.articleId) {
        const made = await Article.findById(out.articleId).select('personRef').lean<{ personRef?: any }>();
        await removeRunOutput(out, made?.personRef ? String(made.personRef) : undefined, origin).catch(() => {});
      }
      await DailyAutoRun.updateOne({ dayKey, slotId }, { $set: { phase: prev.phase, message: prev.message } });
    }
    throw e;
  }
}
