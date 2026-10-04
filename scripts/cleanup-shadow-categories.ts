// Removes dynamic Category rows that shadow a static category.
//
// POST /api/categories used to match only on `slug`, so a container renamed to
// "Sport" created a dynamic 'sport' next to the static 'sports' - two options
// with the identical label in every dropdown. findStaticCategory() now prevents
// new ones; this clears any already written.
//
// Reports what it would delete first and only deletes rows that resolve to a
// static category, so a genuine category is never removed.
import fs from 'fs';
import mongoose from 'mongoose';
import { findStaticCategory } from '../src/lib/categories';

// .env.local starts with a UTF-8 BOM (EF BB BF), so its FIRST key parses as
// "\uFEFFMONGODB_URI" rather than "MONGODB_URI". `next dev` tolerates this;
// dotenv and tsx's loader do not, so process.env.MONGODB_URI is undefined in
// scripts and mongoose falls back to localhost:27017 -> ECONNREFUSED. Strip the
// BOM and parse the one key we need instead of importing src/lib/mongoose,
// whose module-level `const MONGODB_URI = process.env.MONGODB_URI` is evaluated
// at IMPORT time - and ES imports are hoisted above any dotenv.config() call,
// so loading the env first in source order does not help.
function readMongoUri(): string {
  const envFile = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
  for (const line of envFile.split(/\r?\n/)) {
    const m = line.match(/^\s*MONGODB_URI\s*=\s*(.*)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('MONGODB_URI not found in .env.local');
}

const CategorySchema = new mongoose.Schema(
  { slug: String, label: String, color: String },
  { timestamps: true, collection: 'categories' }
);

async function main() {
  await mongoose.connect(readMongoUri());
  const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
  const all = (await Category.find().sort({ createdAt: 1 }).lean()) as unknown as {
    slug: string;
    label: string;
  }[];
  console.log(`${all.length} dynamic category row(s) in the DB:\n`);

  const shadows: typeof all = [];
  for (const c of all) {
    const stat = findStaticCategory(c.label);
    const shadow = !!stat;
    console.log(
      `  ${shadow ? 'SHADOW ' : 'keep   '}slug=${String(c.slug).padEnd(14)} label=${JSON.stringify(c.label).padEnd(16)}` +
        (stat ? ` -> shadows static '${stat.slug}' (${stat.label})` : '')
    );
    if (shadow) shadows.push(c);
  }

  // --slugs=a,b removes named rows in addition to the detected shadows. Needed
  // for rows the shadow heuristic correctly does NOT flag but which are still
  // unwanted - a junk row like 'fu-ball' (posted as "Fußball" through a shell
  // that mangled the ß), or a category being retired on purpose. Kept explicit
  // rather than widening the heuristic, which should stay precise enough to
  // trust.
  //
  // Merged BEFORE the empty check: an earlier version returned "Nothing to
  // clean up" whenever no shadow was detected, silently ignoring --slugs.
  const extraArg = process.argv.find(a => a.startsWith('--slugs='));
  const extra = extraArg ? extraArg.slice('--slugs='.length).split(',').map(s => s.trim()).filter(Boolean) : [];
  const slugs = Array.from(new Set([...shadows.map(s => s.slug), ...extra]));

  if (!slugs.length) {
    console.log('\nNothing to clean up.');
    return;
  }

  const missing = slugs.filter(s => !all.some(c => c.slug === s));
  if (missing.length) {
    console.log(`\nNote: not present in the DB, will be skipped: ${missing.join(', ')}`);
  }

  // Dry run unless --delete is passed. Deleting rows is irreversible and the
  // shadow detection depends on findStaticCategory's three-way match, so the
  // list gets reviewed before anything is removed.
  if (!process.argv.includes('--delete')) {
    console.log(`\nDRY RUN - would delete ${slugs.length} row(s): ${slugs.join(', ')}`);
    console.log('Re-run with --delete to actually remove them.');
    return;
  }

  const res = await Category.deleteMany({ slug: { $in: slugs } });
  console.log(`\nDeleted ${res.deletedCount} shadow row(s): ${slugs.join(', ')}`);
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
