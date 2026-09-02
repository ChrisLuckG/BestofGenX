import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Person } from '../src/models/Almanac';

dotenv.config({ path: '.env.local' });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  // Find all deceased people with death date in September
  const deceased = await Person.find({
    died: { $exists: true, $ne: null, $regex: '-09-' }
  }).lean();
  
  console.log(`GenX people who died in September: ${deceased.length}\n`);
  
  for (const p of deceased) {
    console.log(`${p.firstname} ${p.lastname} - died: ${p.died} (born: ${p.born})`);
  }
  
  // Also check total deceased
  const totalDeceased = await Person.countDocuments({
    died: { $exists: true, $ne: null, $gt: '' }
  });
  
  console.log(`\nTotal deceased GenX people in DB: ${totalDeceased}`);
  
  await mongoose.disconnect();
}

main();
