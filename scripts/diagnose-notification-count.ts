// READ-ONLY: compares the OLD and NEW notification-badge count against what
// GET /api/notifications actually renders, to catch badge/list mismatches
// (e.g. one battle challenge showing as "2" on the bell).
// npx tsx scripts/diagnose-notification-count.ts <username>

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env.local') });

async function main() {
  const username = process.argv[2];
  if (!username) throw new Error('usage: diagnose-notification-count.ts <username>');

  await mongoose.connect(process.env.MONGODB_URI || '');
  const users = mongoose.connection.collection('users');
  const battles = mongoose.connection.collection('battles');
  const notifications = mongoose.connection.collection('notifications');

  const me = await users.findOne({ username: new RegExp(`^${username}$`, 'i') });
  if (!me) throw new Error(`no user ${username}`);
  const userId = me._id;

  const dismissedIds = new Set((me.dismissedNotifications || []).map(String));
  const readIds = new Set((me.readNotifications || []).map(String));
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const dbNotifications = await notifications.find({ userId }).toArray();

  const storedChallengeBattleIds = new Set(
    dbNotifications
      .filter((n: any) => n.type === 'battle_challenge' && n.data?.battleId)
      .map((n: any) => String(n.data.battleId))
  );
  const storedResultBattleIds = new Set(
    dbNotifications
      .filter((n: any) => n.type === 'battle_result' && n.data?.battleId)
      .map((n: any) => String(n.data.battleId))
  );

  const pendingBattles = await battles
    .find({ challengedUser: userId, status: 'open', isPrivate: true, createdAt: { $gte: sevenDaysAgo } })
    .toArray();
  const completedBattles = await battles
    .find({
      $or: [{ creator: userId }, { opponent: userId }],
      status: 'completed',
      completedAt: { $gte: sevenDaysAgo },
    })
    .toArray();

  const notSeen = (id: string) => !dismissedIds.has(id) && !readIds.has(id);

  // OLD logic: derived entries counted unconditionally, on top of the stored rows.
  const oldChallenges = pendingBattles.filter((b) => notSeen(`battle-challenge-${b._id}`)).length;
  const oldResults = completedBattles.filter((b) => notSeen(`battle-result-${b._id}`)).length;

  // NEW logic: a derived entry only counts when no stored row covers that battle.
  const newChallenges = pendingBattles.filter(
    (b) => !storedChallengeBattleIds.has(String(b._id)) && notSeen(`battle-challenge-${b._id}`)
  ).length;
  const newResults = completedBattles.filter(
    (b) => !storedResultBattleIds.has(String(b._id)) && notSeen(`battle-result-${b._id}`)
  ).length;

  const unreadStored = dbNotifications.filter(
    (n: any) => !n.read && notSeen(`notif-${n._id}`)
  ).length;

  // What GET /api/notifications actually renders as unread: stored rows +
  // derived results that are NOT covered by a stored row. No derived challenges.
  const listUnread = unreadStored + newResults;

  console.log(`\nuser ${me.username} (${userId})`);
  console.log(`  stored notification rows      : ${dbNotifications.length} (${unreadStored} unread)`);
  console.log(`    of type battle_challenge    : ${storedChallengeBattleIds.size}`);
  console.log(`    of type battle_result       : ${storedResultBattleIds.size}`);
  console.log(`  open private challenges       : ${pendingBattles.length}`);
  console.log(`  completed battles (7d)        : ${completedBattles.length}`);
  console.log(`\n  OLD badge = ${oldChallenges} + ${oldResults} + ${unreadStored} = ${oldChallenges + oldResults + unreadStored}`);
  console.log(`  NEW badge = ${newChallenges} + ${newResults} + ${unreadStored} = ${newChallenges + newResults + unreadStored}`);
  console.log(`  list renders unread           : ${listUnread}`);

  const newTotal = newChallenges + newResults + unreadStored;
  console.log(
    newTotal === listUnread
      ? `\n  OK: badge matches the list`
      : `\n  MISMATCH: badge ${newTotal} vs list ${listUnread}`
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
