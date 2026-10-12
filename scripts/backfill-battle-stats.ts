/**
 * Backfill battlesWon and battlesLost for all users based on completed battles.
 * Run with: npx ts-node scripts/backfill-battle-stats.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI!;

async function backfillBattleStats() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!');

  const db = mongoose.connection.db!;
  const battlesCollection = db.collection('battles');
  const usersCollection = db.collection('users');

  // Get all completed battles with a winner
  const completedBattles = await battlesCollection.find({
    status: 'completed',
    winner: { $exists: true, $ne: null }
  }).toArray();

  console.log(`Found ${completedBattles.length} completed battles with winners`);

  // Count wins and losses per user
  const stats = new Map<string, { wins: number; losses: number }>();

  for (const battle of completedBattles) {
    const creatorId = battle.creator?.toString();
    const opponentId = battle.opponent?.toString();
    const winnerId = battle.winner?.toString();

    if (!creatorId || !opponentId || !winnerId) continue;

    // Initialize stats
    if (!stats.has(creatorId)) stats.set(creatorId, { wins: 0, losses: 0 });
    if (!stats.has(opponentId)) stats.set(opponentId, { wins: 0, losses: 0 });

    // Determine winner and loser
    const loserId = winnerId === creatorId ? opponentId : creatorId;

    stats.get(winnerId)!.wins++;
    stats.get(loserId)!.losses++;
  }

  console.log(`Calculated stats for ${stats.size} users`);

  // Update users
  let updated = 0;
  const entries = Array.from(stats.entries());
  for (const [userId, { wins, losses }] of entries) {
    try {
      await usersCollection.updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { $set: { battlesWon: wins, battlesLost: losses } }
      );
      updated++;
      if (updated % 50 === 0) {
        console.log(`Updated ${updated} users...`);
      }
    } catch (err) {
      console.error(`Failed to update user ${userId}:`, err);
    }
  }

  console.log(`\nDone! Updated ${updated} users with battle stats.`);
  
  // Show some examples
  const topPlayers = entries
    .sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses))
    .slice(0, 10);
  
  console.log('\nTop 10 players by total battles:');
  for (const entry of topPlayers) {
    const [userId, { wins, losses }] = entry;
    const user = await usersCollection.findOne({ _id: new mongoose.Types.ObjectId(userId) });
    const total = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    console.log(`  ${user?.username || userId}: ${wins}W - ${losses}L (${winRate}% win rate)`);
  }

  await mongoose.disconnect();
}

backfillBattleStats().catch(console.error);
