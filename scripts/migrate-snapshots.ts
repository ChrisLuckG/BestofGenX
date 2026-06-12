import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  console.log('Migrating snapshots...');
  
  const snaps = await mongoose.connection.collection('dailyrankings').find({}).toArray();
  
  for (const snap of snaps) {
    const newRankings = snap.rankings.map((r: any) => ({
      ...r,
      points: r.points > 50 ? r.points / 100 : r.points // Convert old points to BOGX
    }));
    
    await mongoose.connection.collection('dailyrankings').updateOne(
      { _id: snap._id },
      { $set: { rankings: newRankings } }
    );
    console.log(`  ${snap.dateString}: migrated`);
  }
  
  console.log('Done!');
  await mongoose.disconnect();
}
migrate();
