import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function reset() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  // Reset ALL users to 0
  const result = await mongoose.connection.collection('users').updateMany(
    {},
    { $set: { points: 0, bogxCoins: 0, wins: 0, gamesPlayed: 0 } }
  );
  console.log(`Reset ${result.modifiedCount} users to 0!`);
  
  // Delete all snapshots
  const deleted = await mongoose.connection.collection('dailyrankings').deleteMany({});
  console.log(`Deleted ${deleted.deletedCount} snapshots!`);
  
  await mongoose.disconnect();
}
reset();
