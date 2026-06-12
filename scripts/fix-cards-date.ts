import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  const today = new Date().toISOString().split('T')[0];
  console.log('Setting all active cards to today:', today);
  
  // Update all active cards to today's date
  const result = await mongoose.connection.collection('cards').updateMany(
    { active: true },
    { $set: { gameDate: today } }
  );
  
  console.log(`Updated ${result.modifiedCount} cards to gameDate: ${today}`);
  
  await mongoose.disconnect();
}
fix();
