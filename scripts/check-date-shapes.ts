// Asserts the date-shape helpers and that the Menschen API month filters see BOTH shapes of date
// ("1969-10-18" and "18.10.1969"). The old filter pattern "-10-" matched only the first, so a month
// view showed about a third of the people and the "Deceased" view about a third of the deceased.
// Read-only. Needs the dev server for the API part.
//   npx tsx scripts/check-date-shapes.ts
import fs from 'fs';
import mongoose from 'mongoose';

const env = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
for (const l of env.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }

let failed = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`}`); };

(async () => {
  const { parseDateShape, monthMatcher, dayMatchers } = await import('../src/lib/dateShapes');

  // ---------------------------------------------------------------- parseDateShape
  eq('ISO', parseDateShape('1969-10-18'), { year: 1969, month: 10, day: 18 });
  eq('ISO with a time', parseDateShape('2018-10-18T00:00:00.000Z'), { year: 2018, month: 10, day: 18 });
  eq('German', parseDateShape('18.10.1969'), { year: 1969, month: 10, day: 18 });
  eq('German without leading zeros', parseDateShape('8.5.1970'), { year: 1970, month: 5, day: 8 });
  eq('surrounding spaces are fine', parseDateShape('  24.07.1999 '), { year: 1999, month: 7, day: 24 });
  eq('garbage, empty and wrong types give null (never a crash)', ['http://www', '', '   ', undefined, null, '1969', '1969-10', '18.10.', 'abc', '18/10/1969'].map(v => parseDateShape(v as never)), Array(10).fill(null));
  eq('impossible dates give null', ['1969-13-01', '1969-00-10', '1969-10-32', '32.10.1969', '10.13.1969', '0.5.1970'].map(v => parseDateShape(v)), Array(6).fill(null));

  // ---------------------------------------------------------------- monthMatcher
  const oct = monthMatcher(10);
  eq('October: any day, both shapes', ['1969-10-01', '1969-10-31', '1.10.1969', '01.10.1969', '31.10.1969'].every(s => oct.test(s)), true);
  eq('October: no other month - including the "1" prefix traps (January, November, December)', ['1969-01-10', '1969-11-10', '1969-12-10', '10.1.1969', '10.11.1969', '10.12.1969', '1.1.1969'].some(s => oct.test(s)), false);
  eq('January is January in both shapes, and not October', ['1969-01-05', '5.1.1969', '05.01.1969'].every(s => monthMatcher(1).test(s)) && !monthMatcher(1).test('5.10.1969') && !monthMatcher(1).test('1969-10-05'), true);
  eq('every month matches exactly itself, in both shapes', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].every(m => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].every(k => {
    const iso = `1970-${String(k).padStart(2, '0')}-15`, de = `15.${k}.1970`, de2 = `15.${String(k).padStart(2, '0')}.1970`;
    const hit = monthMatcher(m);
    return [iso, de, de2].every(s => hit.test(s) === (k === m));
  })), true);
  eq('garbage never matches', ['http://www', '', '10', '10.10', 'October'].some(s => oct.test(s)), false);
  eq('dayMatchers().month is the same pattern', dayMatchers('2026-10-18').month.source, oct.source);
  const { isGenXBirth } = await import('../src/lib/dateShapes');
  eq('Gen X = born 1965 to 1980, either shape', ['1965-01-01', '01.01.1965', '1980-12-31', '31.12.1980', '1972-06-15'].map(isGenXBirth), [true, true, true, true, true]);
  eq('...not 1964, not 1981, not garbage or empty', ['1964-12-31', '31.12.1964', '1981-01-01', '1.1.1981', 'http://www', '', undefined].map(v => isGenXBirth(v as never)), [false, false, false, false, false, false, false]);

  // ---------------------------------------------------------------- the Menschen API on the real data
  const dbConnect = (await import('../src/lib/mongoose')).default;
  await dbConnect();
  const col = mongoose.connection.db!.collection('people');
  const U = 'http://localhost:3000/api/almanac?type=people';
  const get = async (q: string) => (await (await fetch(`${U}&${q}`)).json()) as any;

  const expectedDeaths = await col.countDocuments({ died: monthMatcher(10) });
  const old = await col.countDocuments({ died: { $regex: '-10-' } });
  console.log(`     (deaths in October: ${expectedDeaths} in both shapes; the old "-10-" pattern found only ${old})`);
  const dead = await get('aliveStatus=deceased&deathMonth=10');
  eq('API deceased + October: success', dead.success, true);
  eq('API deceased + October: returns EVERY death of October (both shapes), not just the ISO ones', dead.data.length, expectedDeaths);
  eq('API: that is more than the old pattern found', dead.data.length > old, true);
  eq('API: both shapes are among them', [dead.data.some((p: any) => /^\d{4}-/.test(p.died)), dead.data.some((p: any) => /^\d{1,2}\./.test(p.died))], [true, true]);
  eq('API: every one of them really died in October', dead.data.every((p: any) => parseDateShape(p.died)?.month === 10), true);
  eq('API: nobody alive slipped into the deceased view', dead.data.every((p: any) => !!p.died), true);

  const expectedBorn = await col.countDocuments({ born: monthMatcher(10) });
  const born = await get('birthMonth=10&limit=3');
  eq('API birth month: the total counts both shapes', born.total, expectedBorn);
  eq('API birth month: and is more than the old pattern', born.total > (await col.countDocuments({ born: { $regex: '-10-' } })), true);

  const all = await get('aliveStatus=deceased&deathMonth=10');
  const order = all.data.map((p: any) => parseDateShape(p.born)).filter(Boolean);
  eq('API sort: people with a usable birth date come before those without (no NaN comparator)', (() => { const flags = all.data.map((p: any) => !!parseDateShape(p.born)); const firstBad = flags.indexOf(false); return firstBad === -1 || flags.slice(firstBad).every((f: boolean) => f === false); })(), true);
  eq('API sort: there were birth dates to sort', order.length > 0, true);

  await mongoose.disconnect();
  console.log(failed ? `\n${failed} FAILED` : '\nall ok');
  process.exit(failed ? 1 : 0);
})();
