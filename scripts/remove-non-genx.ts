import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Person } from '../src/models/Almanac';

dotenv.config({ path: '.env.local' });

async function main() {
  const dry = process.argv.includes('--dry');
  
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  // GenX = born 1965-1980
  const GENX_START = 1965;
  const GENX_END = 1980;
  
  // Find all persons using the model
  const all = await Person.find({}).lean();
  
  console.log(`Total persons: ${all.length}`);
  console.log(`GenX range: ${GENX_START}-${GENX_END}\n`);
  
  const toDelete: any[] = [];
  
  for (const p of all) {
    if (!p.born) {
      console.log(`⚠️  No birth date: ${p.firstname} ${p.lastname}`);
      continue;
    }
    
    const year = parseInt(p.born.substring(0, 4));
    
    if (isNaN(year)) {
      console.log(`⚠️  Invalid birth year: ${p.firstname} ${p.lastname} (${p.born})`);
      continue;
    }
    
    if (year < GENX_START || year > GENX_END) {
      console.log(`❌ NOT GenX: ${p.firstname} ${p.lastname} (${year})`);
      toDelete.push(p);
    }
  }
  
  console.log(`\n${toDelete.length} persons to delete (not GenX)`);
  
  if (!dry && toDelete.length > 0) {
    const ids = toDelete.map(p => p._id);
    const result = await Person.deleteMany({ _id: { $in: ids } });
    console.log(`\n✅ Deleted ${result.deletedCount} persons`);
  } else if (dry) {
    console.log('\n(dry run - use without --dry to delete)');
  }
  
  await mongoose.disconnect();
}

main();
