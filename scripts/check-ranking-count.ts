/**
 * Asserts the invariant "a count stated in a ranking title equals the number of
 * items delivered". The admin shipped a "Top 10 ..." headline above 9 entries,
 * so this covers the reconciliation in /api/generate-ranking.
 *
 * Run: npx tsx scripts/check-ranking-count.ts
 */
export {};

// Mirrors the detection in src/app/api/generate-ranking/route.ts
function detectRequestedCount(topic: string): number | null {
  const m = topic.match(/\b(?:top|best|greatest)\s+(\d{1,2})\b/i);
  const n = m ? parseInt(m[1], 10) : NaN;
  return Number.isFinite(n) && n >= 2 && n <= 20 ? n : null;
}

// Mirrors the reconciliation in the route
function reconcile(ranking: { title: string; items: unknown[] }, requestedCount: number | null) {
  if (Array.isArray(ranking.items) && ranking.items.length > 0) {
    if (requestedCount && ranking.items.length > requestedCount) {
      ranking.items = ranking.items.slice(0, requestedCount);
    }
    const stated = typeof ranking.title === 'string'
      ? ranking.title.match(/\b(top|best|greatest)\s+(\d{1,2})\b/i)
      : null;
    if (stated && parseInt(stated[2], 10) !== ranking.items.length) {
      ranking.title = ranking.title.replace(stated[0], `${stated[1]} ${ranking.items.length}`);
    }
  }
  return ranking;
}

const items = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `item ${i + 1}` }));

let failed = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(52)} ${JSON.stringify(actual)}${ok ? '' : `  expected ${JSON.stringify(expected)}`}`);
};

console.log('\n--- count detected from the topic ---');
check('"Top 10 moments by X"', detectRequestedCount('Top 10 moments by X'), 10);
check('"best 5 songs"', detectRequestedCount('best 5 songs'), 5);
check('"Greatest 3 fights"', detectRequestedCount('Greatest 3 fights'), 3);
check('no number -> model decides', detectRequestedCount('Iconic moments by X'), null);
check('"Top 99" out of range -> ignored', detectRequestedCount('Top 99 things'), null);
check('"Top 1" below minimum -> ignored', detectRequestedCount('Top 1 thing'), null);
check('year is not a count', detectRequestedCount('Iconic 1999 moments'), null);

console.log('\n--- the reported bug: "Top 10" over 9 items ---');
check(
  'title corrected to the real count',
  reconcile({ title: 'Top 10 Iconic Moments by Mauro Camoranesi', items: items(9) }, 10).title,
  'Top 10 Iconic Moments by Mauro Camoranesi'.replace('Top 10', 'Top 9'),
);

console.log('\n--- surplus items are truncated, not advertised ---');
const over = reconcile({ title: 'Top 10 Songs', items: items(14) }, 10);
check('14 items requested 10 -> 10 items', over.items.length, 10);
check('14 items requested 10 -> title intact', over.title, 'Top 10 Songs');

console.log('\n--- cases that must stay untouched ---');
const exact = reconcile({ title: 'Top 10 Songs', items: items(10) }, 10);
check('matching count -> title unchanged', exact.title, 'Top 10 Songs');
check('matching count -> items unchanged', exact.items.length, 10);

const free = reconcile({ title: 'Iconic Moments by X', items: items(7) }, null);
check('no number in title -> unchanged', free.title, 'Iconic Moments by X');
check('no number in title -> all items kept', free.items.length, 7);

const selfStated = reconcile({ title: 'Top 12 Goals', items: items(7) }, null);
check('model stated 12, delivered 7 -> corrected', selfStated.title, 'Top 7 Goals');

check('"Best 5" wording preserved', reconcile({ title: 'Best 5 Films', items: items(4) }, null).title, 'Best 4 Films');

console.log('\n--- empty list must not be rewritten ---');
const empty = reconcile({ title: 'Top 10 Songs', items: [] }, 10);
check('no items -> title untouched', empty.title, 'Top 10 Songs');

console.log(failed === 0 ? '\nAll checks passed.\n' : `\n${failed} check(s) FAILED.\n`);
process.exit(failed === 0 ? 0 : 1);
