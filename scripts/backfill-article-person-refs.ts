/**
 * Backfill: link EXISTING articles back to their Almanac person.
 *
 * Why this is needed: the /api/articles POST route accepted `personRef` in the
 * body but `Article.create()` listed its fields explicitly and dropped it, so
 * no article ever persisted the reference. The Menschen tab's "already has an
 * article" marker therefore only lived in local state and vanished on reload.
 *
 * The script writes BOTH directions, because the admin reads both:
 *   - `article.personRef`  -> used by /api/articles?personRefs=true
 *   - `person.hasArticle` / `articleId` / `articleCreatedAt`
 *
 * MATCHING IS DELIBERATELY STRICT. A wrong link is worse than no link: it marks
 * a person as covered, which also makes the newsroom skip them next year. So:
 *   1. name + birth date both match      -> accept (strongest)
 *   2. name matches exactly ONE person   -> accept
 *   3. name matches several people       -> SKIP and report as ambiguous
 * Nothing is inferred from the headline or the body text.
 *
 * Dry run (default):  npx tsx scripts/backfill-article-person-refs.ts
 * Write:              npx tsx scripts/backfill-article-person-refs.ts --apply
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI!;
const APPLY = process.argv.includes('--apply');

/** Person.born is YYYY-MM-DD in some rows and DD.MM.YYYY in others. */
function normalizeDate(value?: string | null): string {
  if (!value) return '';
  const raw = value.trim();
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const german = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (german) return `${german[3]}-${german[2].padStart(2, '0')}-${german[1].padStart(2, '0')}`;
  return '';
}

/** Lowercase, strip accents and punctuation, collapse whitespace. */
function normalizeName(value?: string | null): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  if (!MONGODB_URI) throw new Error('MONGODB_URI missing in .env.local');

  console.log(`🔌 Connecting to MongoDB... (${APPLY ? 'APPLY' : 'DRY RUN'})`);
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected\n');

  const Articles = mongoose.connection.collection('articles');
  const People = mongoose.connection.collection('people');

  // Only articles that actually name a person and have no link yet.
  const articles = await Articles.find({
    personName: { $exists: true, $nin: [null, ''] },
    $or: [{ personRef: { $exists: false } }, { personRef: null }],
  }).project({ title: 1, personName: 1, personBirthday: 1, createdAt: 1 }).toArray();

  console.log(`📝 ${articles.length} article(s) with a personName but no personRef\n`);

  if (articles.length === 0) {
    console.log('Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  // One pass over the people collection, indexed in memory by normalized name.
  // 125k rows: a per-article query would be 125k index lookups for no gain.
  console.log('📚 Loading people index...');
  const people = await People.find(
    {},
    { projection: { firstname: 1, lastname: 1, born: 1, hasArticle: 1, articleId: 1 } }
  ).toArray();
  console.log(`   ${people.length} people loaded\n`);

  const byName = new Map<string, any[]>();
  for (const p of people) {
    const key = normalizeName(`${p.firstname || ''} ${p.lastname || ''}`);
    if (!key) continue;
    const list = byName.get(key);
    if (list) list.push(p);
    else byName.set(key, [p]);
  }

  let matchedByNameAndDate = 0;
  let matchedByNameOnly = 0;
  let ambiguous = 0;
  let notFound = 0;
  const ops: any[] = [];
  const personOps: any[] = [];

  for (const article of articles) {
    const nameKey = normalizeName(article.personName);
    const candidates = byName.get(nameKey) || [];

    if (candidates.length === 0) {
      notFound++;
      continue;
    }

    let person: any = null;

    const articleDate = normalizeDate(article.personBirthday);
    if (articleDate) {
      const dateHits = candidates.filter(c => normalizeDate(c.born) === articleDate);
      if (dateHits.length === 1) {
        person = dateHits[0];
        matchedByNameAndDate++;
      } else if (dateHits.length > 1) {
        // Same name AND same birthday on several rows: duplicates in the people
        // collection. Linking to an arbitrary one is a coin flip, so skip.
        ambiguous++;
        console.log(`  ? "${article.personName}" - ${dateHits.length} duplicates with the same birthday`);
        continue;
      }
    }

    if (!person) {
      if (candidates.length === 1) {
        person = candidates[0];
        matchedByNameOnly++;
      } else {
        ambiguous++;
        console.log(`  ? "${article.personName}" - ${candidates.length} people share this name, no birthday to disambiguate`);
        continue;
      }
    }

    ops.push({
      updateOne: {
        filter: { _id: article._id },
        update: { $set: { personRef: person._id } },
      },
    });

    // Leave an existing link alone - it may point at a better/earlier article.
    if (!person.hasArticle) {
      personOps.push({
        updateOne: {
          filter: { _id: person._id },
          update: {
            $set: {
              hasArticle: true,
              articleId: article._id,
              articleCreatedAt: article.createdAt || new Date(),
            },
          },
        },
      });
    }
  }

  console.log('\n--- Result ---');
  console.log(`✅ name + birthday : ${matchedByNameAndDate}`);
  console.log(`✅ unique name     : ${matchedByNameOnly}`);
  console.log(`?  ambiguous       : ${ambiguous} (skipped on purpose)`);
  console.log(`-  no person found : ${notFound}`);
  console.log(`\n→ ${ops.length} article(s) would get a personRef, ${personOps.length} person(s) a coverage flag`);

  if (!APPLY) {
    console.log('\nDRY RUN - nothing written. Re-run with --apply to write.');
    await mongoose.disconnect();
    return;
  }

  if (ops.length > 0) {
    const res = await Articles.bulkWrite(ops, { ordered: false });
    console.log(`\n💾 articles updated: ${res.modifiedCount}`);
  }
  if (personOps.length > 0) {
    const res = await People.bulkWrite(personOps, { ordered: false });
    console.log(`💾 people updated:   ${res.modifiedCount}`);
  }

  console.log('\n🎉 Done');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
