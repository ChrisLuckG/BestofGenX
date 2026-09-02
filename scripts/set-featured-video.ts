import mongoose from 'mongoose';
import { Person } from '../src/models/Almanac';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  // Find people with videos but no featuredVideoIndex
  const people = await Person.find({
    videos: { $exists: true, $ne: [] },
    $or: [
      { featuredVideoIndex: { $exists: false } },
      { featuredVideoIndex: null },
    ]
  }).limit(5).lean();
  
  console.log(`Setting featuredVideoIndex=0 for ${people.length} people:\n`);
  
  for (const p of people) {
    console.log(`- ${p.firstname} ${p.lastname}`);
    await Person.updateOne(
      { _id: p._id },
      { $set: { featuredVideoIndex: 0 } }
    );
  }
  
  console.log('\nDone!');
  
  await mongoose.disconnect();
}

main();
