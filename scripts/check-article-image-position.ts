// Asserts that the cover image's focal point survives article CREATION.
//
// The picker's arrow buttons previewed correctly and then lost the position on
// Apply, because the value was dropped at three independent points:
//   1. MenschenTab.saveImage() accepted `position` and never used it
//   2. its POST body carried no imagePosX/imagePosY
//   3. /api/articles POST builds Article.create() from an explicit field list
//      that did not include them - so even a correct body was discarded
// Any one of the three silently restores the bug, and none of them fails loudly:
// the article saves fine, just centred. Hence a test against the real route.
//
// Also covers `thumbnailUrl`, which the route used to recompute from coverImage
// unconditionally, discarding a thumbnail deliberately picked to differ.
//
// Creates drafts and deletes them again. Run with:
//   npx tsx scripts/check-article-image-position.ts

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

const BASE = 'http://localhost:3000';

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(44)} got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

(async () => {
  await mongoose.connect(readEnv('MONGODB_URI'));
  const db = mongoose.connection.db!;

  // The route treats the literal 'system' as auto-generated content and skips
  // user verification, which is exactly what this probe needs.
  const userId = 'system';

  const created: string[] = [];

  async function post(body: Record<string, unknown>) {
    const res = await fetch(`${BASE}/api/articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        title: 'ZZ position probe (delete me)',
        content: '<p>probe</p>',
        category: 'history',
        status: 'draft',
        contentType: 'article',
        coverImage: 'https://example.com/cover.jpg',
        ...body,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(`POST failed: ${data.error}`);
    const id = data.article?._id || data.article?.id;
    created.push(String(id));
    return await db.collection('articles').findOne({ _id: new mongoose.Types.ObjectId(String(id)) });
  }

  console.log('A non-centred focal point must be stored, not reset to 50/50:');
  const moved = await post({ imagePosX: 25, imagePosY: 80 });
  check('imagePosX', moved?.imagePosX, 25);
  check('imagePosY', moved?.imagePosY, 80);

  console.log('\nAn omitted position must default to centre (old callers unaffected):');
  const def = await post({});
  check('imagePosX', def?.imagePosX, 50);
  check('imagePosY', def?.imagePosY, 50);

  console.log('\n0 must survive - it is falsy, so `||` would turn it into 50:');
  const zero = await post({ imagePosX: 0, imagePosY: 0 });
  check('imagePosX', zero?.imagePosX, 0);
  check('imagePosY', zero?.imagePosY, 0);

  console.log('\nAn explicitly picked thumbnail must not be overwritten by the cover:');
  const thumb = await post({ thumbnailUrl: 'https://example.com/different-thumb.jpg' });
  check('thumbnailUrl', thumb?.thumbnailUrl, 'https://example.com/different-thumb.jpg');

  console.log('\nWithout one, it still derives from the cover (unchanged behaviour):');
  const autoThumb = await post({});
  check('thumbnailUrl', autoThumb?.thumbnailUrl, 'https://example.com/cover.jpg');

  // Clean up: these are probes, not content.
  const del = await db.collection('articles').deleteMany({
    _id: { $in: created.map(id => new mongoose.Types.ObjectId(id)) },
  });
  console.log(`\nCleaned up ${del.deletedCount} probe article(s).`);

  await mongoose.disconnect();
  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
})();
