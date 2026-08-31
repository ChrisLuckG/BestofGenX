// READ-ONLY: timeline of a user's most recent battles, to see WHO changed a battle
// and WHEN - i.e. whether an accepted battle is being cancelled again right away.
// npx tsx scripts/diagnose-battle-timeline.ts <username> [count]

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env.local') });

const t = (d?: Date) => (d ? new Date(d).toISOString().slice(5, 19).replace('T', ' ') : '-'.padEnd(14));

async function main() {
  const username = process.argv[2];
  const count = Number(process.argv[3] || 10);
  await mongoose.connect(process.env.MONGODB_URI || '');
  const users = mongoose.connection.collection('users');
  const battles = mongoose.connection.collection('battles');

  const me = await users.findOne({ username: new RegExp(`^${username}$`, 'i') });
  if (!me) throw new Error(`no user ${username}`);

  const list = await battles
    .find({ $or: [{ creator: me._id }, { opponent: me._id }, { challengedUser: me._id }] })
    .sort({ _id: -1 })
    .limit(count)
    .toArray();

  console.log(`\n${me.username}  coins=${me.bogxCoins}\n`);
  console.log('status    wager created         accepted        updated         res  startedC/O  via');
  for (const b of list) {
    const oppU = b.opponent ? await users.findOne({ _id: b.opponent }, { projection: { username: 1 } }) : null;
    const creU = await users.findOne({ _id: b.creator }, { projection: { username: 1 } });
    console.log(
      `${String(b.status).padEnd(9)} ${String(b.wager).padEnd(5)} ${t(b.createdAt)}  ${t(b.acceptedAt)}  ${t(b.updatedAt)}  ` +
        `${b.creatorResults?.length || 0}/${b.opponentResults?.length || 0}  ` +
        `${b.creatorStartedAt ? 'y' : 'n'}/${b.opponentStartedAt ? 'y' : 'n'}       ` +
        `${creU?.username}>${oppU?.username ?? '-'} ${b.acceptedVia || b.createdVia || ''}`
    );
  }

  await mongoose.disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
