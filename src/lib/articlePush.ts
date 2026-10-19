// Push notification "new article".
//
// Delivered by a cron (/api/cron/article-push, every 5 minutes) instead of from the places that
// publish. Articles go live in many ways - the admin's Publish, Daily Auto, the Trivia Winner and
// History routes, the History window - and none of them should wait for hundreds of sends or be
// the one that has to remember the push. The cron looks at what went live recently instead.
//
//  - only real articles (contentType "article"), only what is live: published, and its go-live time
//    (scheduledAt > publishedAt > createdAt, the same rule the feed sorts by) has passed
//  - only the last PUSH_WINDOW_MIN minutes: a deploy, or an outage of the cron, must never push the
//    back catalogue
//  - ONE push per run, for the newest article; older unsent ones in the window are marked handled
//    without a push. Several articles in a row would all carry the same tag (the phone shows one
//    notification, replaced each time), so sending them all would only ring the phone repeatedly
//  - each article is claimed with an atomic update (`pushSentAt`) BEFORE sending: at most once, even
//    if two runs overlap. A run that dies mid-send does not send again - a missed push is better
//    than a double one
//  - recipients: a push subscription AND not opted out (`pushPrefs.newArticle !== false`, the "New Article"
//    switch in the notification settings; missing = on). sendPushNotification enforces the same switch
//    again for every message, so this query is only the cheap pre-filter
//
// The user collection and the article's `pushSentAt` are read and written through the raw
// collections, not the Mongoose models: the dev server keeps the schema it compiled first (HMR), and
// a schema without the field silently drops it from a filter or $set - which here would mean sending
// to people who opted out. (Same reason as the Daily Auto master switch.)
import dbConnect from '@/lib/mongoose';
import { appLink } from '@/lib/appLinks';
import Article from '@/models/Article';
import User from '@/models/User';
import { sendPushNotification, type PushPayload } from '@/lib/webpush';

/** Only articles that went live this recently are pushed. */
export const PUSH_WINDOW_MIN = 120;
/** Same tag for every article: the phone shows one notification and replaces it. */
export const PUSH_TAG = 'new-article';
const LOOKBACK_MS = 48 * 60 * 60 * 1000;
const BATCH = 10;

export interface PushCandidate {
  _id: unknown;
  title: string;
  subtitle?: string;
  contentType?: string;
  status?: string;
  scheduledAt?: Date | string | null;
  publishedAt?: Date | string | null;
  createdAt?: Date | string | null;
}

const ms = (d?: Date | string | null) => (d ? new Date(d).getTime() : NaN);

/** When the article is (or was) visible to readers - the feed's go-live rule. */
export function goLiveAt(a: PushCandidate): number {
  for (const d of [a.scheduledAt, a.publishedAt, a.createdAt]) if (!Number.isNaN(ms(d))) return ms(d);
  return NaN;
}

/** Which article gets the push, and which unsent ones are only marked as handled. */
export function planArticlePush(
  candidates: PushCandidate[],
  now: Date,
): { send: PushCandidate | null; skip: PushCandidate[] } {
  const live = candidates
    .filter(a => a.status === 'published' && (a.contentType || 'article') === 'article')
    .map(a => ({ a, at: goLiveAt(a) }))
    .filter(x => !Number.isNaN(x.at) && x.at <= now.getTime() && now.getTime() - x.at <= PUSH_WINDOW_MIN * 60_000)
    .sort((x, y) => y.at - x.at);
  return { send: live[0]?.a ?? null, skip: live.slice(1).map(x => x.a) };
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function buildArticlePushPayload(a: PushCandidate): PushPayload {
  return {
    title: '📰 New article',
    body: clip(a.title || 'A new article is online', 120),
    url: appLink.article(String(a._id)),
    tag: PUSH_TAG,
    category: 'newArticle',
    icon: '/images/genxlogo1.png',
    badge: '/images/genxlogo1.png',
    type: 'general',
  };
}

type Sender = (sub: any, payload: PushPayload, userId?: string, source?: string) => Promise<boolean>;

export interface ArticlePushResult {
  article: { id: string; title: string } | null;
  recipients: number;
  sent: number;
  failed: number;
  skipped: number;
  note?: string;
}

/**
 * One run of the cron. `send` and `onlyIds` exist for scripts/check-article-push.ts only:
 * a test must be able to run without reaching real devices and without claiming real articles.
 */
export async function runArticlePush(opts: { now?: Date; send?: Sender; onlyIds?: string[] } = {}): Promise<ArticlePushResult> {
  const now = opts.now ?? new Date();
  const send = opts.send ?? sendPushNotification;
  await dbConnect();
  const articles = Article.collection;

  const filter: Record<string, unknown> = {
    status: 'published',
    $or: [{ contentType: 'article' }, { contentType: { $exists: false } }],
    pushSentAt: { $exists: false },
    createdAt: { $gte: new Date(now.getTime() - LOOKBACK_MS) },
  };
  if (opts.onlyIds) filter._id = { $in: opts.onlyIds.map(id => new (Article.base.Types.ObjectId)(id)) };
  const candidates = (await articles
    .find(filter, { projection: { title: 1, subtitle: 1, contentType: 1, status: 1, scheduledAt: 1, publishedAt: 1, createdAt: 1 } })
    .toArray()) as unknown as PushCandidate[];

  const plan = planArticlePush(candidates, now);
  if (plan.skip.length) {
    await articles.updateMany(
      { _id: { $in: plan.skip.map(a => a._id) }, pushSentAt: { $exists: false } } as any,
      { $set: { pushSentAt: now, pushSkipped: true } },
    );
  }
  if (!plan.send) return { article: null, recipients: 0, sent: 0, failed: 0, skipped: plan.skip.length, note: 'nothing new' };

  const article = { id: String(plan.send._id), title: plan.send.title };
  // Claim it first: whoever flips pushSentAt sends, nobody else does
  const claim = await articles.updateOne({ _id: plan.send._id, pushSentAt: { $exists: false } } as any, { $set: { pushSentAt: now } });
  if (claim.modifiedCount !== 1) return { article, recipients: 0, sent: 0, failed: 0, skipped: plan.skip.length, note: 'already claimed' };

  const users = await User.collection
    .find({ pushSubscription: { $exists: true, $ne: null }, 'pushPrefs.newArticle': { $ne: false } }, { projection: { pushSubscription: 1 } })
    .toArray();

  const payload = buildArticlePushPayload(plan.send);
  let sent = 0, failed = 0;
  for (let i = 0; i < users.length; i += BATCH) {
    const results = await Promise.allSettled(
      users.slice(i, i + BATCH).map(u => send((u as any).pushSubscription, payload, String(u._id), 'new-article')),
    );
    for (const r of results) r.status === 'fulfilled' && r.value ? sent++ : failed++;
  }
  await articles.updateOne({ _id: plan.send._id } as any, { $set: { pushRecipients: sent } });
  return { article, recipients: users.length, sent, failed, skipped: plan.skip.length };
}
