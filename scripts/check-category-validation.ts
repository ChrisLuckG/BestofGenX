// Verifies that Article.category accepts dynamically created slugs.
//
// It used to be a Mongoose enum of the twelve static slugs, so assigning a new
// category ('eishockey') failed validation on save - surfacing as a generic 500
// from the article API with nothing pointing at the category field.
//
// Uses validateSync() so nothing is written: this checks the SCHEMA, which is
// what the enum constrained, without creating throwaway articles.
import fs from 'fs';
import mongoose from 'mongoose';

// .env.local carries a UTF-8 BOM, so its first key parses as
// "\uFEFFMONGODB_URI". See scripts/cleanup-shadow-categories.ts.
function readMongoUri(): string {
  const env = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*MONGODB_URI\s*=\s*(.*)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('MONGODB_URI not found in .env.local');
}

async function main() {
  await mongoose.connect(readMongoUri());
  const { default: Article } = await import('../src/models/Article');

  const cases = [
    ['sports', true],
    ['history', true],
    ['eishockey', true], // dynamic - used to FAIL
    ['fussball', true], // dynamic - used to FAIL
    ['tv', true], // dynamic - used to FAIL
  ] as const;

  let failures = 0;
  for (const [category, shouldPass] of cases) {
    const doc = new Article({
      title: 'validation probe',
      content: 'probe',
      mainCategory: 'articles',
      category,
      author: new mongoose.Types.ObjectId(),
    });
    const err = doc.validateSync();
    const categoryErr = err?.errors?.category;
    const passed = !categoryErr;
    if (passed !== shouldPass) failures++;
    console.log(
      `${passed === shouldPass ? '  ok  ' : ' FAIL '}category=${category.padEnd(12)}` +
        (categoryErr ? `rejected: ${categoryErr.message}` : 'accepted')
    );
  }

  console.log(`\n${failures} failure(s).`);
  await mongoose.disconnect();
  process.exit(failures ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
