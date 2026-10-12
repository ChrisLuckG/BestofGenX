/**
 * READ-ONLY: how many people in the bestofgenx database are genuinely missing
 * from sporttock?
 *
 * The naive comparison on the raw `born` string is WRONG and produced a 12.1%
 * "unique" rate that does not exist. The two databases store the same date in
 * different shapes, and sporttock itself is mixed:
 *
 *   bestofgenx  David Beckham  02.05.1975   (DD.MM.YYYY)
 *   sporttock   David Beckham  1975-05-02   (YYYY-MM-DD)
 *
 * Both are the same person. Importing on the raw string would have inserted
 * thousands of duplicates of people who are already there.
 *
 * Run: npx tsx scripts/compare-people-dbs.ts
 */
export {};

import fs from 'fs';
import mongoose from 'mongoose';

function readEnv(key: string): string {
  // .env.local carries a UTF-8 BOM (see AGENTS.md).
  const env = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error(`${key} not found in .env.local`);
}

/** Any supported shape -> YYYY-MM-DD, or '' when no usable date. */
export function normaliseBorn(value: unknown): string {
  const v = String(value ?? '').trim();
  if (!v) return '';
  let m = v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); // DD.MM.YYYY
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); // YYYY-MM-DD(THH..)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); // D.M.YYYY
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = v.match(/^(\d{4})$/); // year only
  if (m) return `${m[1]}-00-00`;
  return `raw:${v.toLowerCase()}`;
}

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const keyOf = (p: any) => `${norm(p.firstname)}|${norm(p.lastname)}|${normaliseBorn(p.born)}`;
const nameKeyOf = (p: any) => `${norm(p.firstname)}|${norm(p.lastname)}`;

(async () => {
  const conn = await mongoose.createConnection(readEnv('MONGODB_URI')).asPromise();
  const client = conn.getClient();
  const bogx = client.db('bestofgenx').collection('people');
  const spt = client.db('sporttock').collection('people');

  const sptKeys = new Set<string>();
  const sptNames = new Set<string>();
  for await (const p of spt.find({}, { projection: { firstname: 1, lastname: 1, born: 1 } })) {
    sptKeys.add(keyOf(p));
    sptNames.add(nameKeyOf(p));
  }

  let total = 0;
  let sameNameAndDate = 0;
  let sameNameOnly = 0;
  let trulyNew = 0;
  const newExamples: string[] = [];
  const bogxKeys = new Set<string>();
  let dupWithinSource = 0;

  for await (const p of bogx.find({}, { projection: { firstname: 1, lastname: 1, born: 1, profession: 1, subcat: 1 } })) {
    total++;
    const k = keyOf(p);
    if (bogxKeys.has(k)) dupWithinSource++;
    bogxKeys.add(k);

    if (sptKeys.has(k)) {
      sameNameAndDate++;
    } else if (sptNames.has(nameKeyOf(p))) {
      sameNameOnly++;
    } else {
      trulyNew++;
      if (newExamples.length < 20) {
        newExamples.push(`${p.firstname} ${p.lastname} | ${p.profession || '-'} / ${p.subcat || '-'} | ${p.born || '-'}`);
      }
    }
  }

  console.log(`\nsporttock people          : ${sptKeys.size}`);
  console.log(`bestofgenx people         : ${total}`);
  console.log(`duplicates within source  : ${dupWithinSource}`);
  console.log(`\n--- matched against sporttock (dates normalised) ---`);
  console.log(`same name AND same date   : ${sameNameAndDate}  (${((sameNameAndDate / total) * 100).toFixed(1)}%)`);
  console.log(`same name, OTHER date     : ${sameNameOnly}  (${((sameNameOnly / total) * 100).toFixed(1)}%)`);
  console.log(`name not in sporttock     : ${trulyNew}  (${((trulyNew / total) * 100).toFixed(1)}%)`);

  console.log(`\n--- examples of names not present at all ---`);
  newExamples.forEach(e => console.log(`  ${e}`));

  console.log(`
Reading: only the last group is unambiguously new. "same name, OTHER date" needs
a decision - it is either a second person with that name, or the same person with
a wrong/missing date in one of the two databases.`);

  await conn.close();
  process.exit(0);
})().catch(e => {
  console.error(e?.message || e);
  process.exit(1);
});
