import { rankingDayKey } from '../src/lib/berlinTime';

// Berlin wall-clock -> expected ranking-day key.
// CEST = UTC+2 (summer), CET = UTC+1 (winter).
const cases: [string, string, string][] = [
  ['2026-09-02T07:59:00Z', '2.9. 09:59 CEST (vor dem Cut)', '2026-09-01'],
  ['2026-09-02T08:00:00Z', '2.9. 10:00 CEST (Cut)',         '2026-09-02'],
  ['2026-09-02T12:00:00Z', '2.9. 14:00 CEST',               '2026-09-02'],
  ['2026-09-02T22:00:00Z', '3.9. 00:00 CEST (Kalendertag)', '2026-09-02'],
  ['2026-09-02T23:00:00Z', '3.9. 01:00 CEST (alter UTC-Reset)', '2026-09-02'],
  ['2026-09-03T07:59:00Z', '3.9. 09:59 CEST',               '2026-09-02'],
  ['2026-09-03T08:00:00Z', '3.9. 10:00 CEST',               '2026-09-03'],
  // Monatsgrenze
  ['2026-10-01T07:59:00Z', '1.10. 09:59 CEST',              '2026-09-30'],
  // Winterzeit (DST endet 25.10.2026)
  ['2026-11-02T08:59:00Z', '2.11. 09:59 CET',               '2026-11-01'],
  ['2026-11-02T09:00:00Z', '2.11. 10:00 CET',               '2026-11-02'],
  // Jahresgrenze
  ['2027-01-01T08:59:00Z', '1.1.2027 09:59 CET',            '2026-12-31'],
];

let failed = 0;
for (const [iso, label, expected] of cases) {
  const got = rankingDayKey(new Date(iso));
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${label.padEnd(34)} -> ${got}  (erwartet ${expected})`);
}
console.log(failed === 0 ? '\nAlle Randfaelle korrekt.' : `\n${failed} Faelle falsch!`);
process.exit(failed === 0 ? 0 : 1);
