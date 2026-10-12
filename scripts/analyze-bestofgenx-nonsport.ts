/**
 * READ-ONLY analysis: which NON-SPORT people in the bestofgenx database would
 * reach a data score of >= 70 in sporttock, and how many are new?
 *
 * Writes nothing. Run this before any import.
 *
 * The score is computed in the BROWSER (MenschenTab.interestScore), so it is
 * rebuilt here as an aggregation:
 *   knownfor 25 | subcat 10 | profession != 'Other' 10 | nationality != countryBorn 5
 *   image 15 | born 15 | cityBorn 10 | (died: causeOfDeath 5, countryDied 5, cityDied 5)
 * A LIVING person therefore caps at 90, and 70 needs several fields at once.
 *
 * Run: npx tsx scripts/analyze-bestofgenx-nonsport.ts
 */
export {};

import fs from 'fs';
import mongoose from 'mongoose';

function readEnv(key: string): string {
  // .env.local carries a UTF-8 BOM, which makes dotenv name the first key
  // "\uFEFFMONGODB_URI" and every script fall back to localhost (see AGENTS.md).
  const env = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error(`${key} not found in .env.local`);
}

// Sport professions/subcats as they appear in bestofgenx - the import must skip
// every one of them ("KEIN Sport").
const SPORT_WORDS = [
  'football', 'soccer', 'tennis', 'basketball', 'ice-hockey', 'icehockey', 'hockey',
  'american-football', 'baseball', 'golf', 'motorsport', 'formula', 'rugby', 'cricket',
  'handball', 'boxing', 'boxer', 'volleyball', 'table-tennis', 'badminton', 'darts',
  'snooker', 'cycling', 'athletics', 'swimming', 'ski', 'skiing', 'snowboard',
  'wrestling', 'mma', 'ufc', 'olympic', 'athlete', 'sport', 'sports', 'esports',
  'gymnast', 'gymnastics', 'rowing', 'sailing', 'surfing', 'skateboard', 'equestrian',
  'fencing', 'judo', 'karate', 'taekwondo', 'triathlon', 'marathon', 'biathlon',
  'curling', 'bobsleigh', 'luge', 'speedway', 'nascar', 'rally',
];

const scoreExpr = {
  $min: [
    100,
    {
      $add: [
        { $cond: [{ $and: [{ $ne: ['$knownfor', null] }, { $ne: ['$knownfor', ''] }] }, 25, 0] },
        { $cond: [{ $and: [{ $ne: ['$subcat', null] }, { $ne: ['$subcat', ''] }] }, 10, 0] },
        { $cond: [{ $and: [{ $ne: ['$profession', null] }, { $ne: ['$profession', ''] }, { $ne: ['$profession', 'Other'] }] }, 10, 0] },
        { $cond: [{ $and: [{ $ne: ['$nationality', null] }, { $ne: ['$nationality', ''] }, { $ne: ['$nationality', '$countryBorn'] }] }, 5, 0] },
        { $cond: [{ $and: [{ $ne: ['$image', null] }, { $ne: ['$image', ''] }] }, 15, 0] },
        { $cond: [{ $and: [{ $ne: ['$born', null] }, { $ne: ['$born', ''] }] }, 15, 0] },
        { $cond: [{ $and: [{ $ne: ['$cityBorn', null] }, { $ne: ['$cityBorn', ''] }] }, 10, 0] },
        { $cond: [{ $and: [{ $ne: ['$died', null] }, { $ne: ['$died', ''] }, { $ne: ['$causeOfDeath', null] }, { $ne: ['$causeOfDeath', ''] }] }, 5, 0] },
        { $cond: [{ $and: [{ $ne: ['$died', null] }, { $ne: ['$died', ''] }, { $ne: ['$countryDied', null] }, { $ne: ['$countryDied', ''] }] }, 5, 0] },
        { $cond: [{ $and: [{ $ne: ['$died', null] }, { $ne: ['$died', ''] }, { $ne: ['$cityDied', null] }, { $ne: ['$cityDied', ''] }] }, 5, 0] },
      ],
    },
  ],
};

(async () => {
  const uri = readEnv('MONGODB_URI');
  const srcUri = uri.replace(/\/[^/?]+(\?|$)/, '/bestofgenx$1');

  const src = await mongoose.createConnection(srcUri).asPromise();
  const dst = await mongoose.createConnection(uri).asPromise();

  const srcPeople = src.db!.collection('people');
  const dstPeople = dst.db!.collection('people');

  console.log(`\nsource : ${src.db!.databaseName}.people`);
  console.log(`target : ${dst.db!.databaseName}.people`);
  console.log(`source total : ${await srcPeople.countDocuments({})}`);
  console.log(`target total : ${await dstPeople.countDocuments({})}\n`);

  console.log('--- professions in the source ---');
  const profs = await srcPeople
    .aggregate([{ $group: { _id: '$profession', n: { $sum: 1 } } }, { $sort: { n: -1 } }])
    .toArray();
  for (const p of profs) {
    const name = String(p._id ?? '(none)');
    const isSport = SPORT_WORDS.some(w => name.toLowerCase().includes(w));
    console.log(`  ${isSport ? 'SPORT ' : '      '} ${name.padEnd(24)} ${p.n}`);
  }

  // Non-sport filter: neither profession nor subcat may contain a sport word.
  const sportRe = new RegExp(SPORT_WORDS.join('|'), 'i');
  const nonSport = {
    $nor: [
      { profession: { $regex: sportRe } },
      { subcat: { $regex: sportRe } },
    ],
  };

  console.log('\n--- non-sport, score distribution ---');
  const dist = await srcPeople
    .aggregate([
      { $match: nonSport },
      { $addFields: { score: scoreExpr } },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $gte: ['$score', 90] }, then: '90-100' },
                { case: { $gte: ['$score', 80] }, then: '80-89' },
                { case: { $gte: ['$score', 70] }, then: '70-79' },
                { case: { $gte: ['$score', 50] }, then: '50-69' },
              ],
              default: '< 50',
            },
          },
          n: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ])
    .toArray();
  dist.forEach(d => console.log(`  ${String(d._id).padEnd(8)} ${d.n}`));

  const qualified = await srcPeople
    .aggregate([{ $match: nonSport }, { $addFields: { score: scoreExpr } }, { $match: { score: { $gte: 70 } } }, { $count: 'n' }])
    .toArray();
  const qualifiedCount = qualified[0]?.n || 0;
  console.log(`\nnon-sport with score >= 70 : ${qualifiedCount}`);

  console.log('\n--- what those qualified people are (profession) ---');
  const qProfs = await srcPeople
    .aggregate([
      { $match: nonSport },
      { $addFields: { score: scoreExpr } },
      { $match: { score: { $gte: 70 } } },
      { $group: { _id: '$profession', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 25 },
    ])
    .toArray();
  qProfs.forEach(p => console.log(`  ${String(p._id ?? '(none)').padEnd(24)} ${p.n}`));

  // How many are already in sporttock? Matched on firstname+lastname+born, the
  // same triple the existing import uses, so the number is comparable.
  console.log('\n--- duplicate check against the target ---');
  const candidates = await srcPeople
    .aggregate([
      { $match: nonSport },
      { $addFields: { score: scoreExpr } },
      { $match: { score: { $gte: 70 } } },
      { $project: { firstname: 1, lastname: 1, born: 1, profession: 1, subcat: 1, score: 1 } },
    ])
    .toArray();

  let existing = 0;
  const seen = new Set<string>();
  let dupInSource = 0;
  for (const c of candidates) {
    const key = `${(c.firstname || '').toLowerCase()}|${(c.lastname || '').toLowerCase()}|${c.born || ''}`;
    if (seen.has(key)) dupInSource++;
    seen.add(key);
  }
  // Single query instead of one per person
  const names = candidates.map(c => ({
    firstname: c.firstname,
    lastname: c.lastname,
    born: c.born,
  }));
  const CHUNK = 500;
  for (let i = 0; i < names.length; i += CHUNK) {
    const chunk = names.slice(i, i + CHUNK);
    const found = await dstPeople.countDocuments({ $or: chunk.map(n => ({ firstname: n.firstname, lastname: n.lastname, born: n.born })) });
    existing += found;
  }
  console.log(`  candidates              : ${candidates.length}`);
  console.log(`  duplicates within source: ${dupInSource}`);
  console.log(`  already in target       : ~${existing}`);
  console.log(`  would be NEW            : ~${candidates.length - dupInSource - existing}`);

  console.log('\n--- 15 example candidates ---');
  candidates.slice(0, 15).forEach(c =>
    console.log(`  ${String(c.score).padStart(3)}  ${c.firstname} ${c.lastname} | ${c.profession || '-'} / ${c.subcat || '-'} | born ${c.born || '-'}`)
  );

  await src.close();
  await dst.close();
  process.exit(0);
})().catch(e => {
  console.error(e?.message || e);
  process.exit(1);
});
