/**
 * Guards the two silent-failure modes of the standalone History flow
 * (src/components/admin/HistoryModal.tsx):
 *
 *  1. the admin account "Eastercorn" must NOT be asked for a historical event.
 *     It is returned by /api/admin/users?isAIReporter=true alongside the four
 *     reporters, and its writingStyle is not one of the four defined voices.
 *  2. the 21-day "already used" memory must share the conference's localStorage
 *     key, otherwise multi-day events (Woodstock, 15-18 Aug 1969) resurface on
 *     every single day of their span.
 *
 * Run: npx tsx scripts/check-history-roster.ts
 */
export {};

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const HISTORY_USED_KEY = 'newsroom-historyUsed';
const USED_TITLE_TTL_MS = 21 * 24 * 60 * 60 * 1000;

let failed = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(50)} ${JSON.stringify(actual)}${ok ? '' : `  expected ${JSON.stringify(expected)}`}`);
};

// Mirrors the roster filter in HistoryModal
const toRoster = (users: any[]) =>
  users
    .filter(u => u._id && u.username !== 'ai_eastercorn' && u.displayName !== 'Eastercorn')
    .map(u => ({ id: String(u._id), name: u.displayName || u.username }));

// Mirrors the memory helpers in HistoryModal, against an in-memory store
const store = new Map<string, string>();
const recentlyUsedTitles = (): string[] => {
  try {
    const raw = JSON.parse(store.get(HISTORY_USED_KEY) || '[]') as Array<{ title: string; at: number }>;
    const cutoff = Date.now() - USED_TITLE_TTL_MS;
    return raw.filter(e => e.at > cutoff).map(e => e.title);
  } catch { return []; }
};
const rememberTitle = (title: string) => {
  if (!title) return;
  try {
    const raw = JSON.parse(store.get(HISTORY_USED_KEY) || '[]') as Array<{ title: string; at: number }>;
    const cutoff = Date.now() - USED_TITLE_TTL_MS;
    const next = raw.filter(e => e.at > cutoff && e.title !== title);
    next.push({ title, at: Date.now() });
    store.set(HISTORY_USED_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
};

async function main() {
  console.log('\n--- roster: the admin account must be excluded ---');
  const res = await fetch(`${BASE}/api/admin/users?isAIReporter=true`);
  const data = await res.json();
  if (!data.success) {
    console.log('FAIL could not load reporters:', data.error);
    process.exit(1);
  }
  const all = data.users || [];
  const roster = toRoster(all);

  console.log(`     endpoint returned ${all.length}: ${all.map((u: any) => u.displayName).join(', ')}`);
  console.log(`     roster  is       ${roster.length}: ${roster.map(r => r.name).join(', ')}`);

  check('Eastercorn present in raw response', all.some((u: any) => u.displayName === 'Eastercorn'), true);
  check('Eastercorn absent from roster', roster.some(r => r.name === 'Eastercorn'), false);
  check('roster has 4 reporters', roster.length, 4);
  check('every roster entry has an id', roster.every(r => r.id && r.id.length === 24), true);

  console.log('\n--- 21-day memory uses the conference key ---');
  store.clear();
  check('empty store -> no titles', recentlyUsedTitles(), []);

  rememberTitle('Woodstock opens');
  check('remembered title is returned', recentlyUsedTitles(), ['Woodstock opens']);
  check('stored under the conference key', store.has(HISTORY_USED_KEY), true);

  rememberTitle('Woodstock opens');
  check('same title is not duplicated', recentlyUsedTitles().length, 1);

  rememberTitle('Berlin Wall falls');
  check('second title is added', recentlyUsedTitles().length, 2);

  // An entry older than 21 days must drop out
  store.set(HISTORY_USED_KEY, JSON.stringify([
    { title: 'too old', at: Date.now() - USED_TITLE_TTL_MS - 60_000 },
    { title: 'still fresh', at: Date.now() - 60_000 },
  ]));
  check('expired entry is dropped', recentlyUsedTitles(), ['still fresh']);

  store.set(HISTORY_USED_KEY, 'not json');
  check('corrupt store does not throw', recentlyUsedTitles(), []);

  console.log('\n--- cross-day: what a conference session wrote is honoured ---');
  store.clear();
  // Simulate the conference having used a title earlier
  store.set(HISTORY_USED_KEY, JSON.stringify([{ title: 'Woodstock opens', at: Date.now() - 24 * 60 * 60 * 1000 }]));
  check('yesterday\'s title still excluded today', recentlyUsedTitles(), ['Woodstock opens']);

  console.log(failed === 0 ? '\nAll checks passed.\n' : `\n${failed} check(s) FAILED.\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
