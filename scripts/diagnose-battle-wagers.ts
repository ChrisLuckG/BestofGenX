// READ-ONLY diagnosis: why does a user's pending wager not show up?
//
// Prints, for the given username:
//  1. every open/active battle they are a participant of (what /api/battles/pending sees)
//  2. every open/active battle that MENTIONS them in results but no longer lists them as
//     creator/opponent - the fingerprint of the bot lost-update bug: the wager was
//     deducted on accept, then a bot's stale save() overwrote `opponent`
//
// Writes nothing. Run with:
//   npx tsx scripts/diagnose-battle-wagers.ts <username>

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || '';

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error('Usage: npx tsx scripts/diagnose-battle-wagers.ts <username>');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  const users = mongoose.connection.collection('users');
  const battles = mongoose.connection.collection('battles');

  const user = await users.findOne({ username: new RegExp(`^${username}$`, 'i') });
  if (!user) {
    console.error(`No user named "${username}"`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`\nUser: ${user.username}  id=${user._id}  bogxCoins=${user.bogxCoins}`);

  // 1. What the pending-wager endpoint sees
  const mine = await battles
    .find({ status: { $in: ['open', 'active'] }, $or: [{ creator: user._id }, { opponent: user._id }] })
    .toArray();

  console.log(`\n[1] Open/active battles you are a participant of: ${mine.length}`);
  let sum = 0;
  for (const b of mine) {
    sum += b.wager || 0;
    const role = String(b.creator) === String(user._id) ? 'creator' : 'opponent';
    console.log(
      `    ${b._id}  ${b.status.padEnd(6)} wager=${b.wager}  role=${role}  ` +
        `topic=${b.topic}  acceptedVia=${b.acceptedVia || '-'}  ` +
        `started(c/o)=${b.creatorStartedAt ? 'y' : 'n'}/${b.opponentStartedAt ? 'y' : 'n'}`
    );
  }
  console.log(`    => pending amount the header should show: ${Math.round(sum * 100) / 100}`);

  // 2. Battles that were taken away after the user had already paid.
  //    An accept always sets acceptedAt; if acceptedVia points at a bot path while the
  //    user is nowhere in the document, their wager was consumed by a battle they lost
  //    access to.
  const recent = await battles
    .find({ createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } })
    .toArray();

  const stolen = recent.filter(
    b =>
      String(b.creator) !== String(user._id) &&
      String(b.opponent) !== String(user._id) &&
      String(b.challengedUser) === String(user._id)
  );

  console.log(`\n[2] Battles challenging you that you are no longer part of: ${stolen.length}`);
  for (const b of stolen) {
    console.log(
      `    ${b._id}  ${b.status.padEnd(9)} wager=${b.wager}  opponent=${b.opponent}  acceptedVia=${b.acceptedVia || '-'}`
    );
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
