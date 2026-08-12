// Throwaway: verify the GET endpoint now reports `rewarded` correctly, so the
// client can decide up front whether a click earns coins.
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  // Pick a user who has reactions, so we can compare DB truth vs API output.
  const sample = await db.collection('reactions').findOne({});
  if (!sample) { console.log('no reactions in DB - cannot verify'); await mongoose.disconnect(); return; }
  const userId = String(sample.userId);

  const own = await db.collection('reactions')
    .find({ userId: sample.userId }).limit(6)
    .project({ articleId: 1, emojiId: 1, rewarded: 1 }).toArray();

  const ids = own.map(r => String(r.articleId));
  console.log(`user ${userId} has ${own.length} reaction docs (sampled)\n`);

  const res = await fetch(`http://localhost:3000/api/articles/react?articleIds=${ids.join(',')}&userId=${userId}`);
  const data = await res.json();

  console.log('DB rewarded field   -> API rewarded   | match | emojiId');
  let allMatch = true;
  for (const r of own) {
    const id = String(r.articleId);
    const api = data.byArticle?.[id]?.rewarded;
    // Legacy docs (no field) count as rewarded - they were paid on creation.
    const expected = r.rewarded !== false;
    const ok = api === expected;
    if (!ok) allMatch = false;
    console.log(
      `  ${String(r.rewarded).padEnd(9)} (exp ${String(expected).padEnd(5)}) -> ${String(api).padEnd(9)} | ${ok ? 'OK ' : 'MISMATCH'} | ${r.emojiId === null ? 'removed' : r.emojiId}`
    );
  }

  // An article the user never touched must report rewarded: false (= will earn).
  const untouched = await db.collection('articles').findOne({
    _id: { $nin: own.map(r => r.articleId) }, status: 'published',
  });
  if (untouched) {
    const r2 = await fetch(`http://localhost:3000/api/articles/react?articleIds=${untouched._id}&userId=${userId}`);
    const d2 = await r2.json();
    const v = d2.byArticle?.[String(untouched._id)]?.rewarded;
    console.log(`\nnever-reacted article -> rewarded: ${v} ${v === false ? '(OK, click will earn)' : '(PROBLEM)'}`);
    if (v !== false) allMatch = false;
  }

  console.log(`\nRESULT: ${allMatch ? 'all rewarded flags correct' : 'MISMATCH FOUND'}`);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
