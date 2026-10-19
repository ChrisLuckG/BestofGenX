// Asserts the push switches: every message belongs to a category, a switched-off category is blocked
// for EVERY sender, and the settings API stores and reports it.
//
// 1. static: every sendPushNotification() call in src/ names a category from lib/pushCategories.ts,
//    so no message can exist that has no switch (the reason the old switches did nothing)
// 2. the real sender, on throwaway users: a switched-off category is blocked and logged; everything
//    else is attempted - at https://example.invalid, so NO real device is ever reached
// 3. the settings API (dev server)
//   npx tsx scripts/check-push-prefs.ts
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

const env = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
for (const l of env.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }

let failed = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`}`); };

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

(async () => {
  const cats = await import('../src/lib/pushCategories');
  const { PUSH_CATEGORIES, PUSH_CATEGORY_KEYS, pushAllowed, resolvePushPrefs, isPushCategory, pushCategoryLabel } = cats;

  // ---------------------------------------------------------------- 1. the catalog
  eq('seven categories', PUSH_CATEGORY_KEYS.length, 7);
  eq('there is no "Daily Game" category any more (removed on purpose)', PUSH_CATEGORY_KEYS.includes('gameReminder' as never), false);
  eq('keys are unique', new Set(PUSH_CATEGORY_KEYS).size, PUSH_CATEGORY_KEYS.length);
  eq('every category has a label, a description and the messages behind it', PUSH_CATEGORIES.every(c => c.label && c.description && c.messages.length > 0), true);
  eq('missing prefs = everything allowed', PUSH_CATEGORY_KEYS.every(k => pushAllowed(undefined, k) && pushAllowed(null, k) && pushAllowed({}, k)), true);
  eq('only an explicit false blocks', [pushAllowed({ battleResult: false }, 'battleResult'), pushAllowed({ battleResult: 0 }, 'battleResult'), pushAllowed({ battleResult: null }, 'battleResult')], [false, true, true]);
  eq('one category off does not touch the others', pushAllowed({ battleResult: false }, 'battleRequest'), true);
  const resolved = resolvePushPrefs({ commentLike: false });
  eq('resolvePushPrefs lists every category', Object.keys(resolved).sort(), [...PUSH_CATEGORY_KEYS].sort());
  eq('...on unless switched off', [resolved.commentLike, resolved.newArticle], [false, true]);
  eq('isPushCategory', [isPushCategory('newArticle'), isPushCategory('nope'), isPushCategory(undefined)], [true, false, false]);
  eq('label lookup (and a safe fallback)', [pushCategoryLabel('battleResult'), pushCategoryLabel('zzz')], ['Battle Result', 'zzz']);

  // ---------------------------------------------------------------- 2. every sender names a category
  const files = walk('src').filter(f => !f.endsWith(path.join('lib', 'webpush.ts')) && !f.includes(path.join('api', 'test-push')));
  const problems: string[] = [];
  let calls = 0;
  const used = new Set<string>();
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    let at = -1;
    while ((at = text.indexOf('sendPushNotification(', at + 1)) !== -1) {
      const lineStart = text.lastIndexOf('\n', at) + 1;
      const line = text.slice(lineStart, text.indexOf('\n', at));
      if (/^\s*import /.test(line) || /^\s*(\/\/|\*|\/\*)/.test(line)) continue; // imports and comments that merely mention it
      calls++;
      // the payload object: first { after the call, matched to its closing }
      const open = text.indexOf('{', at);
      let depth = 0, close = -1;
      for (let i = open; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) { close = i; break; } }
      const payload = text.slice(open, close + 1);
      const m = payload.match(/category:\s*'([A-Za-z]+)'/);
      const where = `${file.replace(/\\/g, '/')}:${text.slice(0, at).split('\n').length}`;
      if (!m) problems.push(`${where} has no category`);
      else if (!isPushCategory(m[1])) problems.push(`${where} uses unknown category "${m[1]}"`);
      else used.add(m[1]);
    }
  }
  eq(`all ${calls} sendPushNotification() calls name a valid category`, problems, []);
  eq('there are calls to check (the scan is not empty)', calls >= 20, true);
  // "Daily Game" was removed completely: no reminder cron, no start push (the game-start cron still creates the game)
  eq('the game-reminder cron is gone', fs.existsSync('src/app/api/cron/game-reminder/route.ts'), false);
  eq('...and its schedule', fs.readFileSync('vercel.json', 'utf8').includes('game-reminder'), false);
  eq('game-start no longer pushes, but still creates the game', [fs.readFileSync('src/app/api/cron/game-start/route.ts', 'utf8').includes('sendPushNotification'), fs.readFileSync('src/app/api/cron/game-start/route.ts', 'utf8').includes('Game.findOneAndUpdate')], [false, true]);
  const { buildArticlePushPayload } = await import('../src/lib/articlePush');
  eq('the New Article payload carries its category too', buildArticlePushPayload({ _id: 'x', title: 't' }).category, 'newArticle');
  used.add('newArticle');
  eq('every category in the catalog is used by some sender (no dead switch)', PUSH_CATEGORY_KEYS.filter(k => !used.has(k)), []);

  // ---------------------------------------------------------------- 3. the real sender (nothing reaches a device)
  const dbConnect = (await import('../src/lib/mongoose')).default;
  await dbConnect();
  const { sendPushNotification } = await import('../src/lib/webpush');
  const users = mongoose.connection.db!.collection('users');
  const logs = mongoose.connection.db!.collection('notificationlogs');
  const sub = (n: string) => ({ endpoint: `https://example.invalid/zzprefs-${n}`, keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' } });
  const cleanup = async () => {
    const ids = (await users.find({ username: /^zzprefs/ }).project({ _id: 1 }).toArray()).map(u => String(u._id));
    if (ids.length) await logs.deleteMany({ userId: { $in: ids } });
    await users.deleteMany({ username: /^zzprefs/ });
  };
  await cleanup();

  try {
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      console.log('SKIP the sender checks: VAPID keys are not configured, so sendPushNotification returns before the gate');
    } else {
      const off = await users.insertOne({ username: 'zzprefs-off', email: 'zzprefs-off@example.invalid', pushSubscription: sub('off'), pushPrefs: { battleResult: false, dailyResults: false } });
      const fresh = await users.insertOne({ username: 'zzprefs-fresh', email: 'zzprefs-fresh@example.invalid', pushSubscription: sub('fresh') });
      const offId = String(off.insertedId);
      const lastLog = async (uid: string) => (await logs.find({ userId: uid }).sort({ createdAt: -1 }).limit(1).toArray())[0] as any;
      const payload = (category?: string) => ({ title: 'ZZ test', body: 'zz', ...(category ? { category } : {}) }) as any;

      // switched off, sender knows the user id
      let r = await sendPushNotification(sub('off') as any, payload('battleResult'), offId);
      let log = await lastLog(offId);
      eq('blocked: returns false', r, false);
      eq('blocked: logged as blocked, with its category', [log.success, String(log.error).startsWith('blocked'), log.category], [false, true, 'battleResult']);

      // switched off, sender does NOT know the user id (the daily crons): found by the subscription
      await logs.deleteMany({ userId: offId });
      r = await sendPushNotification(sub('off') as any, payload('dailyResults'));
      log = await lastLog(offId);
      eq('blocked without a userId: the user is found by the subscription', [r, log?.category, String(log?.error).startsWith('blocked'), log?.userId], [false, 'dailyResults', true, offId]);

      // a category that is NOT off is attempted (and fails at the unreachable host, not at the gate)
      await logs.deleteMany({ userId: offId });
      r = await sendPushNotification(sub('off') as any, payload('battleRequest'), offId);
      log = await lastLog(offId);
      eq('another category of the same user is attempted, not blocked', [r, String(log?.error).startsWith('blocked'), log?.category], [false, false, 'battleRequest']);
      eq('...and that attempt really went out (failed on the network, not on a switch)', typeof log?.error === 'string' && log.error.length > 0, true);

      // a user with no prefs at all gets everything through the gate
      const freshId = String(fresh.insertedId);
      r = await sendPushNotification(sub('fresh') as any, payload('battleResult'), freshId);
      log = await lastLog(freshId);
      eq('no prefs stored = nothing is blocked', String(log?.error).startsWith('blocked'), false);

      // a message with no category (a test push) is never blocked, whatever the user switched off
      await logs.deleteMany({ userId: offId });
      await sendPushNotification(sub('off') as any, payload(), offId);
      log = await lastLog(offId);
      eq('uncategorised (test push) is never blocked', String(log?.error).startsWith('blocked'), false);

      // an unknown subscription (no such user): nothing to look up, so nothing blocks it
      r = await sendPushNotification(sub('nobody') as any, payload('battleResult'));
      eq('unknown subscription is attempted, not blocked', r, false);
      eq('...and leaves no log row (no user to attribute it to)', await logs.countDocuments({ title: 'ZZ test', userId: { $nin: [offId, freshId] }, 'tag': { $exists: false }, username: { $exists: true } }), 0);
    }

    // ------------------------------------------------------------ 4. the settings API (dev server)
    const U = 'http://localhost:3000/api/user/notifications';
    const post = async (body: unknown) => (await fetch(U, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json() as Promise<any>;
    const get = async (id: string, extra = '') => (await (await fetch(`${U}?userId=${id}${extra}`)).json()) as any;
    const api = await users.insertOne({ username: 'zzprefs-api', email: 'zzprefs-api@example.invalid', pushSubscription: sub('api') });
    const uid = String(api.insertedId);

    let g = await get(uid);
    eq('API: a fresh user has all seven switches ON', [Object.keys(g.push).length, Object.values(g.push).every(v => v === true)], [7, true]);
    let p = await post({ userId: uid, push: { battleResult: false, commentLike: false } });
    eq('API: switching two OFF succeeds', p.success, true);
    g = await get(uid);
    eq('API: they read back OFF, the rest stay ON', [g.push.battleResult, g.push.commentLike, g.push.battleRequest, g.push.newArticle], [false, false, true, true]);
    eq('API: the database holds them (not just the response)', ((await users.findOne({ _id: api.insertedId })) as any).pushPrefs, { battleResult: false, commentLike: false });
    p = await post({ userId: uid, push: { battleResult: true } });
    g = await get(uid);
    eq('API: switching one back ON leaves the other OFF', [g.push.battleResult, g.push.commentLike], [true, false]);
    p = await post({ userId: uid, push: { bogus: false, battleRequest: 'no', dailyResults: false } });
    eq('API: an unknown category and a non-boolean are ignored and reported', [p.success, p.ignored], [true, ['bogus', 'battleRequest']]);
    g = await get(uid);
    eq('API: ...while the valid one in the same request applied', [g.push.dailyResults, g.push.battleRequest], [false, true]);
    eq('API: the older settings are still returned', ['battleResults', 'battleAccepted', 'ranking'].every(k => typeof g.settings?.[k] === 'boolean'), true);
    eq('API: unknown user is refused', (await post({ userId: String(new mongoose.Types.ObjectId()), push: { battleResult: false } })).success, false);
    eq('API: missing userId is refused', (await post({ push: { battleResult: false } })).success, false);
    eq('API: a malformed userId is refused, not a 500', (await (await fetch(`${U}?userId=nope`)).json()).success, false);

    // the recent-messages list: what was sent, and what the switches stopped
    if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      await sendPushNotification(sub('api') as any, { title: 'ZZ blocked one', body: 'x', category: 'commentLike' } as any, uid);
      await sendPushNotification(sub('api') as any, { title: 'ZZ attempted one', body: 'y', category: 'battleRequest' } as any, uid);
      g = await get(uid, '&log=1');
      const byTitle = Object.fromEntries((g.recent || []).map((m: any) => [m.title, m]));
      eq('recent: the blocked message shows as blocked, with its label', [byTitle['ZZ blocked one']?.status, byTitle['ZZ blocked one']?.categoryLabel], ['blocked', 'Comment Like']);
      eq('recent: the attempted one shows as failed (unreachable host), with its label', [byTitle['ZZ attempted one']?.status, byTitle['ZZ attempted one']?.categoryLabel], ['failed', 'Battle Request']);
      eq('recent: newest first', (g.recent || [])[0]?.title, 'ZZ attempted one');
      eq('recent: only asked for with log=1', (await get(uid)).recent, undefined);
    }
  } finally {
    await cleanup();
    const left = await users.countDocuments({ username: /^zzprefs/ });
    console.log('cleanup: leftovers =', left);
    await mongoose.disconnect();
  }
  console.log(failed ? `\n${failed} FAILED` : '\nall ok');
  process.exit(failed ? 1 : 0);
})();
