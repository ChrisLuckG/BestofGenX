// Asserts the guard of the two cron routes that GitHub Actions calls from outside. The repository is
// public, so the route names are public: the secret is the only protection against anybody starting
// a (paid) generation by opening a URL.
//   npx tsx scripts/check-cron-auth.ts
import fs from 'fs';

let failed = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`}`); };

(async () => {
  const { cronAuthError } = await import('../src/lib/cronAuth');
  const req = (auth?: string) => new Request('http://x/api/cron/daily-auto', auth === undefined ? {} : { headers: { authorization: auth } });
  const status = (r: Response | null) => (r ? r.status : null);

  const prod = { CRON_SECRET: 's3cret-value', NODE_ENV: 'production' };
  eq('production, right secret: allowed', status(cronAuthError(req('Bearer s3cret-value'), prod)), null);
  eq('production, no header: 401', status(cronAuthError(req(), prod)), 401);
  eq('production, wrong secret: 401', status(cronAuthError(req('Bearer nope'), prod)), 401);
  eq('production, secret without "Bearer ": 401', status(cronAuthError(req('s3cret-value'), prod)), 401);
  eq('production, a longer header must not throw (timingSafeEqual needs equal lengths): 401', status(cronAuthError(req('Bearer s3cret-value-and-more'), prod)), 401);
  eq('production, a shorter header: 401', status(cronAuthError(req('Bearer s'), prod)), 401);
  eq('production, empty header: 401', status(cronAuthError(req(''), prod)), 401);
  eq('the 401 body does not reveal anything', await cronAuthError(req('Bearer nope'), prod)!.json(), { error: 'Unauthorized' });

  // the dangerous case: no secret configured. Production must stay SHUT (503), not open.
  eq('production WITHOUT a configured secret: shut (503), whatever the header says', [status(cronAuthError(req('Bearer anything'), { NODE_ENV: 'production' })), status(cronAuthError(req(), { CRON_SECRET: '', NODE_ENV: 'production' }))], [503, 503]);
  eq('...and "Bearer undefined" does not get in', status(cronAuthError(req('Bearer undefined'), { NODE_ENV: 'production' })), 503);
  eq('local development without a secret stays open (like the rest of the dev setup)', status(cronAuthError(req(), { NODE_ENV: 'development' })), null);
  eq('local development WITH a secret enforces it', [status(cronAuthError(req(), { CRON_SECRET: 'x', NODE_ENV: 'development' })), status(cronAuthError(req('Bearer x'), { CRON_SECRET: 'x', NODE_ENV: 'development' }))], [401, null]);

  // both routes really use the guard, and nothing else decides
  for (const route of ['daily-auto', 'article-push']) {
    const text = fs.readFileSync(`src/app/api/cron/${route}/route.ts`, 'utf8');
    eq(`${route}: uses cronAuthError`, text.includes('cronAuthError(request)'), true);
    eq(`${route}: no older, weaker check left`, /process\.env\.CRON_SECRET/.test(text), false);
  }

  // Hobby: every cron expression may run once a day at most, or the deployment fails
  const crons: { path: string; schedule: string }[] = JSON.parse(fs.readFileSync('vercel.json', 'utf8')).crons;
  const subDaily = crons.filter(c => { const [min, hour] = c.schedule.split(' '); return !/^\d+$/.test(min) || !/^\d+$/.test(hour); });
  eq('vercel.json has no sub-daily cron (Hobby would REFUSE the deployment)', subDaily, []);
  eq('the two routes are not in vercel.json (GitHub triggers them)', crons.filter(c => /daily-auto|article-push/.test(c.path)), []);

  // the workflow calls exactly those two routes, with the secret, and never prints a response body
  eq("the workflow is NOT active in the project repository (a private repo gets only 2000 free Actions minutes)", fs.existsSync('.github/workflows'), false);
  const wf = fs.readFileSync('ops/bogx-cron/.github/workflows/cron.yml', 'utf8');
  eq('workflow: every 5 minutes', wf.includes("cron: '*/5 * * * *'"), true);
  eq('workflow: calls both routes', ['/api/cron/daily-auto', '/api/cron/article-push'].every(r => wf.includes(r)), true);
  eq('workflow: sends the secret from the repository secret', wf.includes('secrets.CRON_SECRET') && wf.includes('Authorization: Bearer $CRON_SECRET'), true);
  eq('workflow: the response body goes to /dev/null (the Action logs of a public repo are public)', (wf.match(/-o \/dev\/null/g) || []).length, 2);
  eq('workflow: fails on a non-2xx answer (so GitHub mails about it)', (wf.match(/\[ "\$code" -ge 200 \] && \[ "\$code" -lt 300 \]/g) || []).length, 2);
  eq('workflow: runs of one job never overlap', (wf.match(/cancel-in-progress: false/g) || []).length, 2);
  eq('workflow: a weekly keepalive commit, so GitHub does not switch it off after 60 days', [wf.includes("cron: '17 3 * * 1'"), wf.includes("github.event.schedule == '17 3 * * 1'"), wf.includes('--allow-empty'), wf.includes('contents: write')], [true, true, true, true]);
  eq('workflow: the keepalive does not touch the secret', /keepalive:[\s\S]*$/.exec(wf)![0].includes('CRON_SECRET'), false);

  console.log(failed ? `\n${failed} FAILED` : '\nall ok');
  process.exit(failed ? 1 : 0);
})();
