// Delete Person rows whose data-completeness score is below a threshold.
//
// The score is NOT stored - MenschenTab.tsx's interestScore() computes it in the
// browser from the fields that are present. This script replicates that exact
// formula as an aggregation so the same number comes out, then deletes the rows
// below the cutoff.
//
// DRY RUN BY DEFAULT. Pass --delete to actually remove rows.
//   npx tsx scripts/cleanup-low-score-people.ts              (count only)
//   npx tsx scripts/cleanup-low-score-people.ts --min=40     (different cutoff)
//   npx tsx scripts/cleanup-low-score-people.ts --delete
import fs from 'fs';
import mongoose from 'mongoose';

function readMongoUri(): string {
  const env = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*MONGODB_URI\s*=\s*(.*)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('MONGODB_URI not found in .env.local');
}

// Mirrors interestScore() in src/components/admin/MenschenTab.tsx exactly.
// A non-empty string counts; '' and null/missing do not - same as JS truthiness.
const nonEmpty = (f: string) => ({
  $and: [{ $ne: [`$${f}`, null] }, { $ne: [`$${f}`, ''] }],
});

const SCORE_EXPR = {
  $min: [
    100,
    {
      $add: [
        { $cond: [nonEmpty('knownfor'), 25, 0] },
        { $cond: [nonEmpty('subcat'), 10, 0] },
        {
          $cond: [
            { $and: [nonEmpty('profession'), { $ne: ['$profession', 'Other'] }] },
            10,
            0,
          ],
        },
        {
          $cond: [
            { $and: [nonEmpty('nationality'), { $ne: ['$nationality', '$countryBorn'] }] },
            5,
            0,
          ],
        },
        { $cond: [nonEmpty('image'), 15, 0] },
        { $cond: [nonEmpty('born'), 15, 0] },
        { $cond: [nonEmpty('cityBorn'), 10, 0] },
        // The three death fields only count when `died` is set, matching the
        // nested `if (p.died)` in interestScore().
        {
          $cond: [
            nonEmpty('died'),
            {
              $add: [
                { $cond: [nonEmpty('causeOfDeath'), 5, 0] },
                { $cond: [nonEmpty('countryDied'), 5, 0] },
                { $cond: [nonEmpty('cityDied'), 5, 0] },
              ],
            },
            0,
          ],
        },
      ],
    },
  ],
};

async function main() {
  const args = process.argv.slice(2);
  const doDelete = args.includes('--delete');
  const minArg = args.find(a => a.startsWith('--min='));
  const minScore = minArg ? parseInt(minArg.split('=')[1], 10) : 40;

  if (!Number.isFinite(minScore) || minScore < 0 || minScore > 100) {
    throw new Error(`--min must be 0-100, got ${minScore}`);
  }

  await mongoose.connect(readMongoUri());
  const people = mongoose.connection.collection('people');

  const total = await people.countDocuments({});

  // Distribution, so the cutoff is a decision and not a guess.
  const dist = await people
    .aggregate([
      { $addFields: { _score: SCORE_EXPR } },
      { $group: { _id: '$_score', n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  console.log(`${total.toLocaleString('en-US')} person row(s) total\n`);
  console.log('score  count      cumulative');
  let cum = 0;
  for (const row of dist) {
    cum += row.n;
    console.log(
      `${String(row._id).padStart(5)}  ${String(row.n).padStart(9)}  ${String(cum).padStart(9)}`
    );
  }

  const below = await people
    .aggregate([
      { $addFields: { _score: SCORE_EXPR } },
      { $match: { _score: { $lt: minScore } } },
      { $count: 'n' },
    ])
    .toArray();
  const nBelow = below[0]?.n ?? 0;
  const pct = total ? ((nBelow / total) * 100).toFixed(1) : '0.0';

  console.log(
    `\n${nBelow.toLocaleString('en-US')} row(s) score < ${minScore}  (${pct}% of the collection)`
  );
  console.log(
    `${(total - nBelow).toLocaleString('en-US')} row(s) would remain\n`
  );

  // Rows that are referenced by an article must not be deleted - the article
  // keeps personRef/personName and would point at nothing.
  const articles = mongoose.connection.collection('articles');
  const refs = (await articles.distinct('personRef', { personRef: { $ne: null } })) as unknown[];
  const refIds = refs.filter(Boolean).map(r => new mongoose.Types.ObjectId(String(r)));
  console.log(`${refIds.length} person row(s) are referenced by an article`);

  const protectedBelow = refIds.length
    ? await people
        .aggregate([
          { $match: { _id: { $in: refIds } } },
          { $addFields: { _score: SCORE_EXPR } },
          { $match: { _score: { $lt: minScore } } },
          { $count: 'n' },
        ])
        .toArray()
    : [];
  const nProtected = protectedBelow[0]?.n ?? 0;
  if (nProtected) {
    console.log(
      `  ${nProtected} of them score < ${minScore} and will be KEPT (an article links to them)`
    );
  }

  const sample = await people
    .aggregate([
      { $addFields: { _score: SCORE_EXPR } },
      { $match: { _score: { $lt: minScore } } },
      { $limit: 8 },
      { $project: { firstname: 1, lastname: 1, profession: 1, born: 1, _score: 1 } },
    ])
    .toArray();
  console.log('\nsample of rows that would go:');
  for (const p of sample) {
    console.log(
      `  ${String(p._score).padStart(3)}  ${`${p.firstname} ${p.lastname}`.padEnd(32)} ${p.profession || '-'}  ${p.born || '-'}`
    );
  }

  if (!doDelete) {
    console.log('\nDRY RUN - nothing deleted. Re-run with --delete to apply.');
    await mongoose.disconnect();
    return;
  }

  const ids = (
    await people
      .aggregate([
        { $addFields: { _score: SCORE_EXPR } },
        { $match: { _score: { $lt: minScore } } },
        { $project: { _id: 1 } },
      ])
      .toArray()
  ).map(d => d._id);

  const refSet = new Set(refIds.map(String));
  const toDelete = ids.filter(id => !refSet.has(String(id)));

  console.log(`\nDeleting ${toDelete.length.toLocaleString('en-US')} row(s)...`);
  const res = await people.deleteMany({ _id: { $in: toDelete } });
  console.log(`Deleted ${res.deletedCount.toLocaleString('en-US')} row(s).`);
  console.log(`${(await people.countDocuments({})).toLocaleString('en-US')} row(s) remain.`);

  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
