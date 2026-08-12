// One-off migration: give every reaction document an explicit `rewarded` flag.
//
// BACKGROUND
// The Reaction schema used to be declared twice (in /api/articles/route.ts and
// /api/articles/react/route.ts). The copy without the `rewarded` field
// sometimes won the `mongoose.models.Reaction ||` race, and Mongoose then
// silently stripped `rewarded` on every write. That left most documents with no
// `rewarded` field at all - neither true nor false - so the reward logic could
// not tell paid-out reactions from unpaid ones.
//
// These documents all predate the fix and were already paid out (or forfeited),
// so they are marked `rewarded: true` = "settled, never pay again". Every NEW
// reaction is inserted with `rewarded: false` and gets paid exactly once.
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection('reactions');

  const before = {
    total: await col.countDocuments({}),
    missing: await col.countDocuments({ rewarded: { $exists: false } }),
    isFalse: await col.countDocuments({ rewarded: false }),
    isTrue: await col.countDocuments({ rewarded: true }),
  };
  console.log('BEFORE:', before);

  if (before.missing === 0) {
    console.log('Nothing to migrate - every document already has the flag.');
    await mongoose.disconnect();
    return;
  }

  const res = await col.updateMany(
    { rewarded: { $exists: false } },
    { $set: { rewarded: true } }
  );
  console.log(`Migrated ${res.modifiedCount} document(s).`);

  console.log('AFTER:', {
    total: await col.countDocuments({}),
    missing: await col.countDocuments({ rewarded: { $exists: false } }),
    isFalse: await col.countDocuments({ rewarded: false }),
    isTrue: await col.countDocuments({ rewarded: true }),
  });

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
