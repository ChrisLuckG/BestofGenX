// Asserts the RIP article (people who died on this day) and the date matching it needs.
//
// The people collection holds dates in TWO shapes ("1969-10-18" and "18.10.1969"); a search that
// knew only the first never saw 41% of the people who qualify. dayMatchers() covers both and is
// used by the birthday pick AND the RIP pick.
// Read-only against the database; no article is made. Needs no dev server.
//   npx tsx scripts/check-rip-article.ts
import fs from 'fs';
import mongoose from 'mongoose';

const env = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
for (const l of env.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }

let failed = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`}`); };

(async () => {
  const { dayMatchers, filterRipCandidates } = await import('../src/lib/dailyAuto');
  const { KIND_META, ALL_KINDS, ONCE_A_DAY, kindProblem, DEFAULT_SLOTS, slotTimes, berlinWallTime } = await import('../src/lib/dailyAutoSchedule');

  // ---------------------------------------------------------------- the two date shapes
  const oct18 = dayMatchers('2026-10-18');
  const yes = ['1969-10-18', '2025-10-18', '18.10.1969', '18.10.2018', '2018-10-18T00:00:00.000Z'];
  const no = ['1969-10-19', '1969-11-18', '19.10.1969', '18.11.1969', '18.10.', '1969-10-18x', 'http://www', '', '2018-1-18', '118.10.1969'];
  eq('18 Oct matches both shapes (and an ISO timestamp)', yes.map(s => oct18.day.test(s)), yes.map(() => true));
  eq('18 Oct does not match other days, months, garbage or half dates', no.map(s => oct18.day.test(s)), no.map(() => false));

  const may8 = dayMatchers('2026-05-08');
  eq('a leading zero is optional in the German shape: 8.5.1970 and 08.05.1970', ['8.5.1970', '08.05.1970', '8.05.1970', '08.5.1970', '1970-05-08'].map(s => may8.day.test(s)), [true, true, true, true, true]);
  eq('...but 18.5.1970 is not the 8th, and 8.10.1970 is not May', [may8.day.test('18.5.1970'), may8.day.test('8.10.1970'), may8.day.test('8.5.')], [false, false, false]);

  const dec1 = dayMatchers('2026-12-01');
  eq('day 10 does not match day 1 and vice versa (no prefix accident)', [dec1.day.test('10.12.1970'), dec1.day.test('1.12.1970'), dec1.day.test('01.12.1970'), dayMatchers('2026-12-10').day.test('1.12.1970')], [false, true, true, false]);
  eq('the month pattern: any day of October, either shape', ['1969-10-02', '2.10.1969', '31.10.1969', '1969-10-31'].every(s => oct18.month.test(s)), true);
  eq('...and no other month', ['1969-11-02', '2.11.1969', '1969-01-18', '18.1.1969', '18.01.1969'].some(s => oct18.month.test(s)), false);
  eq('January is not mistaken for October/November/December (no "1" prefix accident)', ['1969-01-05', '5.1.1969', '05.01.1969'].map(s => dayMatchers('2026-01-05').day.test(s)), [true, true, true]);
  eq('...and "5.10.1969" is not 5 January', dayMatchers('2026-01-05').day.test('5.10.1969'), false);

  // ---------------------------------------------------------------- who is a RIP candidate
  const rich = { _id: 'a', firstname: 'A', lastname: 'A', image: 'i.jpg', knownfor: 'x', subcat: 'y', profession: 'Politik', born: '1970-01-01', cityBorn: 'c', died: '2018-10-18' };
  const p = (id: string, extra: Record<string, unknown> = {}) => ({ ...rich, _id: id, ...extra }) as any;
  const ids = (list: any[]) => list.map(x => String(x._id));
  eq('a person with photo and score 70+ qualifies', ids(filterRipCandidates([p('a')], new Set(), new Set())), ['a']);
  eq('no photo: out (it becomes the cover)', ids(filterRipCandidates([p('a', { image: '' })], new Set(), new Set())), []);
  eq('score under 70: out', ids(filterRipCandidates([p('a', { knownfor: '', subcat: '', cityBorn: '' })], new Set(), new Set())), []);
  eq('already has a RIP article: out', ids(filterRipCandidates([p('a'), p('b')], new Set(['a']), new Set())), ['b']);
  eq('has an OLDER article but no RIP one (e.g. a birthday piece): still in - that is who gets remembered', ids(filterRipCandidates([p('a', { hasArticle: true, discoveredFor: 'birthday' })], new Set(), new Set())), ['a']);
  eq('a RIP piece from before articles knew their person (hasArticle + discoveredFor rip): out', ids(filterRipCandidates([p('a', { hasArticle: true, discoveredFor: 'rip' })], new Set(), new Set())), []);
  eq('already tried for this slot (Rerun / too short): out', ids(filterRipCandidates([p('a'), p('b')], new Set(), new Set(['b']))), ['a']);
  eq('Gen X only: born 1965 and 1980 are in, 1964 and 1981 out - in either date shape', ids(filterRipCandidates([
    p('y1965', { born: '1965-01-01' }), p('y1980', { born: '31.12.1980' }), p('y1964', { born: '1964-12-31' }), p('y1981', { born: '01.01.1981' }), p('nodate', { born: '' }), p('junk', { born: 'http://www' }),
  ], new Set(), new Set())), ['y1965', 'y1980']);

  // ---------------------------------------------------------------- birthdays are for the living
  const { filterBirthdayCandidates } = await import('../src/lib/dailyAuto');
  eq('birthday pick: a deceased person is NOT among today\'s birthdays (James Foley, died 2014) - either date shape', ids(filterBirthdayCandidates([p('alive', { died: undefined }), p('foley', { died: '2014-08-19' }), p('de', { died: '19.08.2014' }), p('blank', { died: '  ' })], new Set(), new Set())), ['alive', 'blank']);
  eq('...a deceased person is a RIP candidate instead', ids(filterRipCandidates([p('foley', { died: '2014-08-19' })], new Set(), new Set())), ['foley']);
  eq('birthday pick keeps its other rules (photo, already used, already tried)', ids(filterBirthdayCandidates([p('a', { died: undefined, image: '' }), p('b', { died: undefined }), p('c', { died: undefined })], new Set(['b']), new Set(['c']))), []);

  // ---------------------------------------------------------------- the slot type
  eq('RIP is a type with a label and an estimate', [ALL_KINDS.includes('rip'), KIND_META.rip.label, KIND_META.rip.estSec > 0], [true, 'RIP Article', true]);
  eq('RIP is once a day', ONCE_A_DAY.includes('rip'), true);
  eq('no default slot is RIP (it is picked in the dropdown)', DEFAULT_SLOTS.filter(s => s.kind === 'rip').length, 0);
  const slots = DEFAULT_SLOTS.map(s => ({ ...s }));
  eq('RIP can go on any hour while none exists', slots.every(s => kindProblem(slots, s.id, 'rip') === null), true);
  const withRip = slots.map(s => (s.id === '0700' ? { ...s, kind: 'rip' as const } : s));
  eq('a second RIP slot is refused and names the first', kindProblem(withRip, '1800', 'rip')?.includes('07:00'), true);
  eq('RIP does not block the other types elsewhere', ['bogx', 'bogx-rankroll', 'radio'].map(k => kindProblem(withRip, '1800', k as never)), [null, null, null]);
  eq('RIP generation never crosses midnight (first hour 06:00, lead 60 min)', slotTimes({ ...slots[0], kind: 'rip' }, '2026-10-18').genAt >= berlinWallTime('2026-10-18', '00:00'), true);

  // ---------------------------------------------------------------- the real data (read-only)
  const dbConnect = (await import('../src/lib/mongoose')).default;
  await dbConnect();
  const { Person } = await import('../src/models/Almanac');
  const { interestScore } = await import('../src/lib/personScore');
  const db = mongoose.connection.db!;
  const ripRefs = new Set((await db.collection('articles').distinct('personRef', { category: 'rip', personRef: { $exists: true, $ne: null } })).map(String));

  const day = '2026-10-18';
  const found = await Person.find({ died: dayMatchers(day).day, isRejected: { $ne: true } }).lean<any[]>();
  const shapes = new Set(found.map(x => (/^\d{4}-/.test(String(x.died)) ? 'iso' : 'de')));
  const candidates = filterRipCandidates(found, ripRefs, new Set());
  console.log(`     (18 Oct: ${found.length} people with that death day, ${candidates.length} qualify: ${candidates.map(c => `${c.firstname} ${c.lastname} [${c.died}]`).join(', ') || '-'})`);
  eq('the query finds deaths stored in BOTH shapes on the real data', [shapes.has('iso'), shapes.has('de')], [true, true]);
  eq('every found person really died on 18 Oct (no false match from the regex)', found.every(x => { const d = String(x.died); const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/) || d.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/); return !!m && (/^\d{4}-/.test(d) ? [m[2], m[3]] : [m[2].padStart(2, '0'), m[1].padStart(2, '0')]).join('-') === '10-18'; }), true);

  // how often the slot would have somebody, counted the old way (ISO only) and the new way
  const all = await Person.find({ died: { $exists: true, $nin: [null, ''] }, isRejected: { $ne: true } }).lean<any[]>();
  const ok = all.filter(x => !!x.image && interestScore(x) >= 70 && !ripRefs.has(String(x._id)));
  const dayOf = (s: string) => { const m = s.match(/^\d{4}-(\d{2})-(\d{2})/); const g = s.match(/^(\d{1,2})\.(\d{1,2})\.\d{4}/); return m ? `${m[1]}-${m[2]}` : g ? `${g[2].padStart(2, '0')}-${g[1].padStart(2, '0')}` : null; };
  const daysWith = (list: any[]) => new Set(list.map(x => dayOf(String(x.died))).filter(Boolean)).size;
  const isoOnly = ok.filter(x => /^\d{4}-/.test(String(x.died)));
  console.log(`     (days of the year with a candidate: ${daysWith(ok)} of 366 - an ISO-only search would see ${daysWith(isoOnly)})`);
  eq('both shapes together cover clearly more days than the ISO shape alone', daysWith(ok) > daysWith(isoOnly), true);

  // the birthday pick uses the same matcher now: Nelson Vivas (born 18.10.1969 in the German shape?) is findable either way
  const born = await Person.find({ born: dayMatchers(day).day, isRejected: { $ne: true } }).select('born image').lean<any[]>();
  const bornShapes = new Set(born.map(x => (/^\d{4}-/.test(String(x.born)) ? 'iso' : 'de')));
  console.log(`     (birthdays on 18 Oct: ${born.length} people, shapes: ${Array.from(bornShapes).join('+')})`);
  eq('the birthday search now sees BOTH shapes too (before: ISO only)', [bornShapes.has('iso'), bornShapes.has('de')], [true, true]);

  await mongoose.disconnect();
  console.log(failed ? `\n${failed} FAILED` : '\nall ok');
  process.exit(failed ? 1 : 0);
})();
