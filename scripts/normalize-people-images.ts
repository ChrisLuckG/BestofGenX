/**
 * Replace Wikidata's `Special:FilePath` portrait URLs with real CDN thumbnails.
 *
 * Why: that URL is a rate-limited redirect to the full-size original (see
 * src/lib/wikimediaImage.ts). 20,969 people had it, and the admin list showed broken
 * images because Wikimedia answered most of the parallel requests with HTTP 429.
 *
 * Reversible: the previous URL is kept in `imageSource`, only `image` changes.
 *
 *   npx tsx scripts/normalize-people-images.ts                 dry run, 300 people
 *   npx tsx scripts/normalize-people-images.ts --limit 2000    dry run, more
 *   npx tsx scripts/normalize-people-images.ts --apply         write ALL of them
 *   npx tsx scripts/normalize-people-images.ts --revert        put the old URLs back
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import mongoose from 'mongoose';
import { resolveCommonsThumbs } from '../src/lib/wikimediaImage';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const revert = args.includes('--revert');
const limitArg = args.indexOf('--limit');
const limit = apply || revert ? Infinity : limitArg >= 0 ? parseInt(args[limitArg + 1], 10) : 300;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const people = mongoose.connection.db!.collection('people');

  if (revert) {
    const r = await people.updateMany({ imageSource: { $exists: true, $ne: '' } }, [{ $set: { image: '$imageSource' } }, { $unset: 'imageSource' }]);
    console.log(`reverted ${r.modifiedCount} people to their original image URL`);
    await mongoose.disconnect();
    return;
  }

  const filter = { image: /^https?:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//i };
  const total = await people.countDocuments(filter);
  console.log(`${total} people still have a Special:FilePath image.  ${apply ? 'APPLYING to all' : `dry run on ${Math.min(limit, total)}`}\n`);

  const cursor = people.find(filter).project({ image: 1 }).limit(Number.isFinite(limit) ? limit : 0);
  let chunk: { _id: any; image: string }[] = [];
  let seen = 0, updated = 0, unresolved = 0;
  const examples: string[] = [];

  const flush = async () => {
    if (!chunk.length) return;
    const map = await resolveCommonsThumbs(chunk.map(d => d.image));
    const ops: any[] = [];
    for (const d of chunk) {
      const thumb = map.get(d.image);
      if (!thumb) { unresolved++; continue; }
      if (examples.length < 3) examples.push(`${decodeURIComponent(d.image.split('/').pop() || '')}\n     -> ${thumb}`);
      ops.push({ updateOne: { filter: { _id: d._id, image: d.image }, update: { $set: { image: thumb, imageSource: d.image } } } });
    }
    if (apply && ops.length) await people.bulkWrite(ops, { ordered: false });
    updated += ops.length;
    seen += chunk.length;
    chunk = [];
    if (seen % 1000 < 200) console.log(`  ${seen}/${total}  ${apply ? 'written' : 'would update'} ${updated}, unresolved ${unresolved}`);
  };

  for await (const d of cursor as any) {
    chunk.push(d);
    if (chunk.length >= 200) await flush();
  }
  await flush();

  console.log(`\n${apply ? 'UPDATED' : 'would update'} ${updated} of ${seen}, could not resolve ${unresolved} (left as they were)`);
  examples.forEach(e => console.log('  e.g. ' + e));
  if (!apply) console.log('\nDry run only. Re-run with --apply to write.');
  await mongoose.disconnect();
}

main();
