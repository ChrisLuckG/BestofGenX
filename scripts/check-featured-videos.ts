import mongoose from 'mongoose';
import { Person } from '../src/models/Almanac';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  // Check people with videos
  const withVideos = await Person.find({
    videos: { $exists: true, $ne: [] },
  }).limit(10).lean();
  
  console.log(`People with videos: ${withVideos.length}\n`);
  
  for (const p of withVideos) {
    const videos = (p as any).videos || [];
    const featuredIdx = (p as any).featuredVideoIndex;
    console.log(`${p.firstname} ${p.lastname}:`);
    console.log(`  Videos: ${videos.length}`);
    console.log(`  Featured index: ${featuredIdx ?? 'not set'}`);
    if (videos.length > 0) {
      console.log(`  Video IDs: ${videos.map((v: any) => v.videoId).join(', ')}`);
    }
    console.log('');
  }
  
  await mongoose.disconnect();
}

main();
