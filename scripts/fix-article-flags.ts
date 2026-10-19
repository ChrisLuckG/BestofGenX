/**
 * Fills personCountryCode on person articles that have none, using countryCodeFor()
 * (country name, and the birth city of the linked person for Czechoslovakia / Soviet
 * Union / Yugoslavia). Only EMPTY codes are written.
 *
 *   npx tsx scripts/fix-article-flags.ts          dry run
 *   npx tsx scripts/fix-article-flags.ts --apply  writes + backup to F:/Projekte/_db-backups
 */
import fs from 'fs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { countryCodeFor } from '../src/lib/countryFlags';
dotenv.config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const arts = await db.collection('articles').find({
    personCountry: { $nin: [null, ''] },
    $or: [{ personCountryCode: { $exists: false } }, { personCountryCode: { $in: [null, ''] } }],
  }).project({ personName: 1, personCountry: 1, personRef: 1 }).toArray();

  const changes: { _id: string; personName?: string; personCountry: string; code: string }[] = [];
  let unresolved = 0;
  for (const a of arts) {
    let city = '';
    if (a.personRef && mongoose.isValidObjectId(String(a.personRef))) {
      const p: any = await db.collection('people').findOne({ _id: new mongoose.Types.ObjectId(String(a.personRef)) }, { projection: { cityBorn: 1 } });
      city = p?.cityBorn || '';
    }
    const code = countryCodeFor(a.personCountry, city);
    // old articles derive the flag from the name at render time anyway; only a code that
    // the name alone does NOT give is worth writing
    if (!code) { unresolved++; console.log(`  no flag: ${a.personName} (${a.personCountry}, ${city || 'no city'})`); continue; }
    changes.push({ _id: String(a._id), personName: a.personName, personCountry: a.personCountry, code });
  }
  console.log(`\n${arts.length} articles without a code: ${changes.length} resolvable, ${unresolved} not`);
  for (const c of changes) console.log(`  ${c.personName}: ${c.personCountry} -> ${c.code}`);

  if (APPLY && changes.length) {
    const file = `F:/Projekte/_db-backups/article-flags-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
    fs.writeFileSync(file, JSON.stringify(changes.map(c => c._id), null, 1));
    for (const c of changes) await db.collection('articles').updateOne({ _id: new mongoose.Types.ObjectId(c._id) }, { $set: { personCountryCode: c.code } });
    console.log(`\nAPPLIED. Undo: unset personCountryCode on the ids in ${file}`);
  } else if (!APPLY) console.log('\n(dry run - nothing written)');
  await mongoose.disconnect();
})();
