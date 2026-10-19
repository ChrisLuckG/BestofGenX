// Asserts the "new article" push: which article is pushed, to whom, and at most once.
//
// NEVER reaches a real device: the sender is a fake, and the run is restricted to the throwaway
// articles made here (`onlyIds`), so no real article is claimed. The real push subscribers are
// read (a fake sender sees their subscription objects) but nothing is sent to them.
// Needs the dev server for the settings API checks.
//   npx tsx scripts/check-article-push.ts
import fs from 'fs';
import mongoose from 'mongoose';

const env = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
for (const l of env.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }

let failed = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`}`); };

(async () => {
  const { buildArticlePushPayload, goLiveAt, planArticlePush, runArticlePush, PUSH_TAG, PUSH_WINDOW_MIN } = await import('../src/lib/articlePush');

  // ---------------------------------------------------------------- pure rules
  const NOW = new Date('2026-10-18T12:00:00Z');
  const ago = (min: number) => new Date(NOW.getTime() - min * 60_000);
  const art = (id: string, minAgo: number, extra: Record<string, unknown> = {}) => ({ _id: id, title: `Article ${id}`, status: 'published', contentType: 'article', publishedAt: ago(minAgo), createdAt: ago(minAgo + 30), ...extra });

  let plan = planArticlePush([art('a', 10)], NOW);
  eq('one fresh article is sent', [String(plan.send?._id), plan.skip.length], ['a', 0]);
  plan = planArticlePush([art('old', 50), art('new', 5), art('mid', 20)], NOW);
  eq('several unsent: only the NEWEST is pushed', String(plan.send?._id), 'new');
  eq('the others are marked handled, not pushed', plan.skip.map(a => String(a._id)).sort(), ['mid', 'old']);
  eq('older than the window is ignored (no back catalogue after a deploy)', planArticlePush([art('x', PUSH_WINDOW_MIN + 1)], NOW).send, null);
  eq('exactly at the window edge still counts', String(planArticlePush([art('x', PUSH_WINDOW_MIN)], NOW).send?._id), 'x');
  eq('a draft is never pushed', planArticlePush([art('d', 5, { status: 'draft' })], NOW).send, null);
  for (const t of ['rankroll', 'tv', 'radio', 'arcade', 'shop', 'music-community', 'banner-page']) {
    eq(`contentType "${t}" is not an article`, planArticlePush([art('c', 5, { contentType: t })], NOW).send, null);
  }
  eq('an article without a contentType is an article (old data)', String(planArticlePush([art('o', 5, { contentType: undefined })], NOW).send?._id), 'o');
  eq('scheduled for later: not live yet, not pushed', planArticlePush([art('s', 5, { scheduledAt: new Date(NOW.getTime() + 3600_000) })], NOW).send, null);
  eq('scheduledAt wins over publishedAt (the feed\'s go-live rule)', goLiveAt(art('s', 500, { scheduledAt: ago(5) })), ago(5).getTime());
  eq('...so an article scheduled into the window is pushed even if published long ago', String(planArticlePush([art('s', 500, { scheduledAt: ago(5) })], NOW).send?._id), 's');
  eq('without any date it cannot be judged: not pushed', planArticlePush([{ _id: 'n', title: 't', status: 'published' }], NOW).send, null);
  eq('no candidates', planArticlePush([], NOW), { send: null, skip: [] });

  const payload = buildArticlePushPayload({ _id: 'abc123', title: 'A'.repeat(300), status: 'published' });
  eq('payload opens the article IN the app (lib/appLinks.ts), not the standalone page', payload.url, '/?article=abc123');
  eq('payload uses ONE tag, so the phone replaces instead of stacking', [payload.tag, PUSH_TAG], ['new-article', 'new-article']);
  eq('a long title is cut', payload.body.length <= 120 && payload.body.endsWith('…'), true);
  eq('title is the same for every article', payload.title, '📰 New article');

  // ---------------------------------------------------------------- database, fake sender
  const dbConnect = (await import('../src/lib/mongoose')).default;
  await dbConnect();
  const Article = (await import('../src/models/Article')).default;
  const users = mongoose.connection.db!.collection('users');
  const sub = (n: string) => ({ endpoint: `https://example.invalid/zzpush-${n}`, keys: { p256dh: 'x', auth: 'y' } });
  const cleanup = async () => {
    await Article.deleteMany({ title: /^ZZPush/ });
    await users.deleteMany({ username: /^zzpush/ });
  };
  await cleanup();

  try {
    const nowReal = new Date();
    const mk = (t: string, minAgo: number, extra: Record<string, unknown> = {}) =>
      Article.collection.insertOne({ title: `ZZPush ${t}`, content: '<p>x</p>', status: 'published', contentType: 'article', category: 'lifestyle', publishedAt: new Date(nowReal.getTime() - minAgo * 60_000), createdAt: new Date(nowReal.getTime() - minAgo * 60_000), ...extra } as any);
    const idOf = (r: any) => String(r.insertedId);

    const on = await users.insertOne({ username: 'zzpush-on', email: 'zzpush-on@example.invalid', pushSubscription: sub('on') });
    const off = await users.insertOne({ username: 'zzpush-off', email: 'zzpush-off@example.invalid', pushSubscription: sub('off'), pushPrefs: { newArticle: false } });
    await users.insertOne({ username: 'zzpush-nosub', email: 'zzpush-nosub@example.invalid' });
    const onExplicit = await users.insertOne({ username: 'zzpush-on2', email: 'zzpush-on2@example.invalid', pushSubscription: sub('on2'), pushPrefs: { newArticle: true } });

    const expected = await users.countDocuments({ pushSubscription: { $exists: true, $ne: null }, 'pushPrefs.newArticle': { $ne: false } });
    const calls: { user: string; url?: string; tag?: string; source?: string }[] = [];
    const fake = async (_s: any, p: any, userId?: string, source?: string) => { calls.push({ user: String(userId), url: p.url, tag: p.tag, source }); return true; };

    const fresh = idOf(await mk('fresh', 5));
    const older = idOf(await mk('older', 40));
    const stale = idOf(await mk('stale', PUSH_WINDOW_MIN + 60));
    const draft = idOf(await mk('draft', 5, { status: 'draft' }));
    const rank = idOf(await mk('rankroll', 5, { contentType: 'rankroll' }));
    const ids = [fresh, older, stale, draft, rank];

    let r = await runArticlePush({ send: fake, onlyIds: ids });
    eq('run 1: the newest eligible article is the one pushed', r.article?.id, fresh);
    eq('run 1: everybody who has push and has not opted out got it (real subscribers included, via the fake)', [r.recipients, r.sent, r.failed], [expected, expected, 0]);
    eq('run 1: the opted-in test users were reached', [calls.some(c => c.user === String(on.insertedId)), calls.some(c => c.user === String(onExplicit.insertedId))], [true, true]);
    eq('run 1: the opted-OUT user was not', calls.some(c => c.user === String(off.insertedId)), false);
    eq('run 1: the user without a subscription was not', calls.some(c => c.user.length && c.user === 'zzpush-nosub'), false);
    eq('run 1: every send carries the article url, the shared tag and the source "new-article"', calls.every(c => c.url === `/?article=${fresh}` && c.tag === 'new-article' && c.source === 'new-article'), true);
    eq('run 1: the older unsent one was handled without a push', r.skipped, 1);

    const doc = async (id: string) => (await Article.collection.findOne({ _id: new mongoose.Types.ObjectId(id) } as any)) as any;
    eq('the pushed article is marked', !!(await doc(fresh)).pushSentAt, true);
    eq('the older one is marked as skipped', [!!(await doc(older)).pushSentAt, (await doc(older)).pushSkipped], [true, true]);
    eq('the one outside the window is left alone', (await doc(stale)).pushSentAt, undefined);
    eq('a draft and a rankroll are left alone', [(await doc(draft)).pushSentAt, (await doc(rank)).pushSentAt], [undefined, undefined]);

    const before = calls.length;
    r = await runArticlePush({ send: fake, onlyIds: ids });
    eq('run 2: nothing is sent twice', [r.article, calls.length - before], [null, 0]);

    // two runs at the same moment: only one of them may send
    const racer = idOf(await mk('racer', 3));
    const sendsRace: string[] = [];
    const fakeRace = async (_s: any, _p: any, userId?: string) => { sendsRace.push(String(userId)); return true; };
    const [a, b] = await Promise.all([runArticlePush({ send: fakeRace, onlyIds: [racer] }), runArticlePush({ send: fakeRace, onlyIds: [racer] })]);
    eq('two overlapping runs: exactly one sends', [sendsRace.length, [a.note, b.note].filter(n => n === 'already claimed' || n === 'nothing new').length >= 1], [expected, true]);

    // a failed send is counted, not fatal
    const failing = idOf(await mk('failing', 2));
    r = await runArticlePush({ send: async () => false, onlyIds: [failing] });
    eq('failed sends are counted', [r.sent, r.failed], [0, expected]);

    // ---------------------------------------------------------- the settings API (dev server)
    const U = 'http://localhost:3000/api/user/notifications';
    const post = async (body: unknown) => (await fetch(U, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    const get = async (id: string) => (await (await fetch(`${U}?userId=${id}`)).json()) as any;
    const uid = String(on.insertedId);
    eq('API: a user who never touched it is ON', (await get(uid)).push?.newArticle, true);
    let p: any = await post({ userId: uid, push: { newArticle: false } });
    eq('API: switching OFF succeeds', p.success, true);
    eq('API: and reads back OFF', (await get(uid)).push?.newArticle, false);
    eq('API: the database really holds false (not just the response)', ((await users.findOne({ _id: on.insertedId })) as any).pushPrefs?.newArticle, false);
    // the switch is honoured by the very next run
    const optout = idOf(await mk('optout', 1));
    const seen: string[] = [];
    await runArticlePush({ send: async (_s, _p, userId) => { seen.push(String(userId)); return true; }, onlyIds: [optout] });
    eq('after switching OFF the next push skips that user', seen.includes(uid), false);
    p = await post({ userId: uid, push: { newArticle: true } });
    eq('API: switching back ON reads back ON', [p.success, (await get(uid)).push?.newArticle], [true, true]);
    eq('API: a non-boolean value changes nothing', [(await post({ userId: uid, push: { newArticle: 'no' } })).success, (await get(uid)).push?.newArticle], [true, true]);
    const settingsNow = (await get(uid)).settings ?? {};
    eq('API: the other settings are still returned', ['battleResults', 'battleAccepted', 'ranking'].every(k => typeof settingsNow[k] === 'boolean'), true);
    p = await post({ userId: String(new mongoose.Types.ObjectId()), push: { newArticle: false } });
    eq('API: an unknown user is a 404-style failure', p.success, false);
    p = await post({ push: { newArticle: false } });
    eq('API: missing userId is refused', p.success, false);
  } finally {
    await cleanup();
    const left = (await Article.countDocuments({ title: /^ZZPush/ })) + (await users.countDocuments({ username: /^zzpush/ }));
    console.log('cleanup: leftovers =', left);
    await mongoose.disconnect();
  }
  console.log(failed ? `\n${failed} FAILED` : '\nall ok');
  process.exit(failed ? 1 : 0);
})();
