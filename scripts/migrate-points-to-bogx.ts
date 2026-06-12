// One-time migration: Convert all user points to BOGX (divide by 100)
// Run with: npx ts-node scripts/migrate-points-to-bogx.ts

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || '';

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!');

  const User = mongoose.connection.collection('users');
  
  // Get all users with points > 1 (likely old format)
  const users = await User.find({ points: { $gt: 1 } }).toArray();
  
  console.log(`Found ${users.length} users with points > 1`);
  
  for (const user of users) {
    const oldPoints = user.points || 0;
    const newBogx = oldPoints / 100;
    
    console.log(`${user.username}: ${oldPoints} points -> ${newBogx.toFixed(2)} BOGX`);
    
    await User.updateOne(
      { _id: user._id },
      { $set: { points: newBogx, bogxCoins: newBogx } }
    );
  }
  
  console.log('Migration complete!');
  await mongoose.disconnect();
}

migrate().catch(console.error);
