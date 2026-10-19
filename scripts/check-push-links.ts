// Every push notification leads INTO the app (lib/appLinks.ts): "/?..." -> the device redirect keeps the
// parameters -> /mobile or /desktop opens the screen (an article in the app, the battles, the radio...).
// Before: "/article/<id>" opened the bare standalone page, "/battles" and "/notifications" were 404s,
// "/mobile?..." put desktop users into the phone layout. Static scan + pure checks.
//   npx tsx scripts/check-push-links.ts
import fs from 'fs';
import path from 'path';

let failed = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${ok ? '' : `\n       got  ${JSON.stringify(got, null, 1)}\n       want ${JSON.stringify(want)}`}`); };
const read = (f: string) => fs.readFileSync(f, 'utf8');
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

(async () => {
  const { appLink } = await import('../src/lib/appLinks');
  eq('links', [appLink.article('abc'), appLink.battle('b1'), appLink.battles(), appLink.notifications(), appLink.rankings(), appLink.radio(), appLink.home()],
    ['/?article=abc', '/?battle=b1', '/?tab=battles', '/?tab=notifications', '/?tab=rankings', '/?tab=radio', '/']);
  eq('ids are encoded', appLink.article('a b&c'), '/?article=a%20b%26c');

  // every push sender: an in-app link
  const senders = [...walk('src/app/api'), ...walk('src/lib')].filter(f => f.endsWith('.ts') && /sendPushNotification|buildArticlePushPayload/.test(read(f)));
  const bad: string[] = [];
  for (const f of senders) {
    read(f).split('\n').forEach((l, i) => {
      const m = l.match(/\burl:\s*(['`])(\/[^'`]*)\1/);
      if (!m) return;
      const u = m[2];
      if (!(u === '/' || u.startsWith('/?') || u === '/admin')) bad.push(`${f.replace(/\\/g, '/')}:${i + 1} ${u}`);
    });
  }
  console.log(`     (${senders.length} sender files scanned)`);
  eq('every push url is an in-app link ("/?..."; "/admin" for admins) - no /mobile, /battles, /notifications, /article/', bad, []);
  eq('the new-article push opens the article in the app', /url: appLink\.article\(/.test(read('src/lib/articlePush.ts')), true);
  const { buildArticlePushPayload } = await import('../src/lib/articlePush');
  eq('...the payload says so', buildArticlePushPayload({ _id: 'x1', title: 't' } as any).url, '/?article=x1');

  // the chain: redirect keeps the query, both apps read it, the service worker falls back to the redirect
  eq('the device redirect (app/page.tsx) passes the query on', /searchParams/.test(read('src/app/page.tsx')) && /\? `\?\$\{query\}`|query \? `\?\$\{query\}`/.test(read('src/app/page.tsx')), true);
  const mobile = read('src/app/mobile/page.tsx'), desktop = read('src/app/desktop/page.tsx');
  eq('mobile opens ?article= in the app', /params\.get\('article'\)[\s\S]{0,300}setOpenArticleId\(articleParam\)/.test(mobile), true);
  eq('mobile knows the tabs the pushes use', ['notifications', 'battles', 'rankings', 'radio', 'arcade'].every(t => mobile.includes(`tab === '${t}'`)), true);
  eq('mobile applies the same link when the app is already open (service worker postMessage)', /NOTIFICATION_NAVIGATE[\s\S]{0,900}applyDeepLinkParams/.test(mobile), true);
  eq('desktop opens ?article= in the app', /searchParams\.get\('article'\)[\s\S]{0,200}setOpenArticleId\(articleId\)/.test(desktop), true);
  eq('desktop knows the tabs and ?battle=', ['notifications', 'battles', 'rankings', 'radio', 'arcade'].every(t => desktop.includes(`tab === '${t}'`)) && desktop.includes("searchParams.get('battle')"), true);
  eq('desktop does not put the welcome page over a linked article', /deepLink = \/\[\?&\]\(article\|tab\|battle\)=\//.test(desktop), true);
  const sw = read('public/sw.js');
  eq('service worker: the fallback is the device redirect, not the phone app', [sw.includes("url: data.url || '/'"), sw.includes("event.notification.data?.url || '/'"), sw.includes("|| '/mobile'")], [true, true, false]);

  console.log(failed ? `\n${failed} FAILED` : '\nall ok');
  process.exit(failed ? 1 : 0);
})();
