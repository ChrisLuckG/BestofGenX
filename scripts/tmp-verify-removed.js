// Throwaway: the tricky case. A user who removed their reaction keeps
// rewarded: true and must NOT be able to trigger a second coin animation.
// The reaction-count query filters emojiId != null, so the rewarded flag has to
// come from a separate query - this proves it does.
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const removed = await db.collection('reactions')
    .find({ emojiId: null }).limit(5)
    .project({ articleId: 1, userId: 1, rewarded: 1 }).toArray();

  if (!removed.length) {
    console.log('No "removed reaction" docs (emojiId: null) in DB.');
    console.log('Simulating one in-memory instead is not possible against the live API,');
    console.log('so this specific path stays unverified by data - logic is reviewed above.');
    await mongoose.disconnect();
    return;
  }

  console.log(`found ${removed.length} removed-reaction docs\n`);
  let ok = true;
  for (const r of removed) {
    const uid = String(r.userId);
    const aid = String(r.articleId);
    const res = await fetch(`http://localhost:3000/api/articles/react?articleIds=${aid}&userId=${uid}`);
    const d = await res.json();
    const entry = d.byArticle?.[aid];
    const expected = r.rewarded !== false;
    const match = entry?.rewarded === expected;
    if (!match) ok = false;
    console.log(
      `  userReaction: ${String(entry?.userReaction).padEnd(6)} | rewarded api: ${String(entry?.rewarded).padEnd(5)} ` +
      `| expected: ${String(expected).padEnd(5)} | ${match ? 'OK' : 'MISMATCH'}`
    );
  }
  console.log(`\nRESULT: ${ok ? 'removed reactions still report rewarded correctly (no double payout animation)' : 'MISMATCH'}`);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
