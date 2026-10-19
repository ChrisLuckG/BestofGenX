// Asserts how Daily Auto collects the History events: every event must come with a video, a
// rejected one is re-rolled, and a YouTube outage stops the run instead of publishing a
// History article without videos. Uses a fake event requester - no model, no YouTube.
//   npx tsx scripts/check-history-events.ts
import { collectHistoryEvents, HISTORY_EVENT_ATTEMPTS } from '../src/lib/dailyAuto';

let failed = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`}`); };

const R = ['Anna', 'Ben', 'Cleo', 'Dan'].map(n => ({ id: `id-${n}`, name: n }));
const ok = (title: string) => ({ event: { title, year: 1990, youtubeVideoId: 'abcdefghijk' } });
const noVideo = (title: string) => new Error(`/api/editorial/history-event: No video found for "${title}". Reporter must find an event with available video footage.`);

(async () => {
  // all four find an event with a video straight away
  let calls = 0;
  let r = await collectHistoryEvents(R, [], async (id) => ok(`event ${id} #${++calls}`));
  eq('four reporters -> four events', r.events.length, 4);
  eq('no failures, no abort', [r.failed.length, r.noVideoAbort], [0, false]);
  eq('reporter id and name are attached', [r.events[0].reporterId, r.events[0].reporterName], ['id-Anna', 'Anna']);

  // each reporter is told what the others found (and what was used in earlier days)
  const seen: string[][] = [];
  await collectHistoryEvents(R, ['old event'], async (id) => { seen.push([]); const t = `ev-${id}`; seen[seen.length - 1] = [t]; return ok(t); });
  const excludes: string[][] = [];
  await collectHistoryEvents(R.slice(0, 3), ['old event'], async (id, ex) => { excludes.push(ex); return ok(`ev-${id}`); });
  eq('1st reporter is told the earlier days', excludes[0], ['old event']);
  eq('2nd reporter also hears the 1st one', excludes[1], ['old event', 'ev-id-Anna']);
  eq('3rd reporter hears both', excludes[2], ['old event', 'ev-id-Anna', 'ev-id-Ben']);

  // an event without video is rejected -> the reporter is asked again, WITHOUT that event
  const asked: string[][] = [];
  let n = 0;
  r = await collectHistoryEvents(R.slice(0, 1), [], async (_id, ex) => {
    asked.push(ex);
    if (++n === 1) throw noVideo('Obscure Thing');
    return ok('Famous Thing');
  });
  eq('re-rolled once and got an event', [r.events.length, r.events[0].title], [1, 'Famous Thing']);
  eq('the rejected event is excluded on the retry', asked, [[], ['Obscure Thing']]);

  // a reporter that never finds a video is skipped after the allowed attempts
  let tries = 0;
  r = await collectHistoryEvents([R[0], R[1], R[2]], [], async (id) => {
    if (id === 'id-Anna') { tries++; throw noVideo(`nothing ${tries}`); }
    return ok(`ev-${id}`);
  });
  eq('tries per reporter are capped', tries, HISTORY_EVENT_ATTEMPTS);
  eq('the others still deliver', r.events.map(e => e.reporterName), ['Ben', 'Cleo']);
  eq('the failure is reported by name', r.failed.length === 1 && r.failed[0].startsWith('Anna:'), true);
  eq('one dry reporter is not an outage', r.noVideoAbort, false);

  // YouTube down: nothing has a video -> stop after two dry reporters, do not ask the rest
  let asks = 0;
  r = await collectHistoryEvents(R, [], async () => { asks++; throw noVideo('x'); });
  eq('outage: aborts', r.noVideoAbort, true);
  eq('outage: stops after 2 reporters x attempts, not 4', asks, 2 * HISTORY_EVENT_ATTEMPTS);
  eq('outage: no events', r.events.length, 0);

  // a dry reporter followed by a good one resets the outage counter
  r = await collectHistoryEvents(R, [], async (id) => {
    if (id === 'id-Anna' || id === 'id-Cleo') throw noVideo(`n-${id}`);
    return ok(`ev-${id}`);
  });
  eq('dry, good, dry, good -> no abort', [r.noVideoAbort, r.events.length], [false, 2]);

  // any other error is not retried and does not count as an outage
  let hits = 0;
  r = await collectHistoryEvents([R[0]], [], async () => { hits++; throw new Error('OpenAI key not configured'); });
  eq('a non-video error is not retried', hits, 1);
  eq('and is not mistaken for an outage', [r.noVideoAbort, r.failed.length], [false, 1]);
  r = await collectHistoryEvents(R.slice(0, 2), [], async () => { throw new Error('boom'); });
  eq('two broken reporters (not video) -> no abort', r.noVideoAbort, false);

  // a response without an event counts as a failure
  r = await collectHistoryEvents([R[0]], [], async () => ({}));
  eq('empty response -> failure', [r.events.length, r.failed.length], [0, 1]);

  console.log(failed ? `\n${failed} FAILED` : '\nall ok');
  process.exit(failed ? 1 : 0);
})();
