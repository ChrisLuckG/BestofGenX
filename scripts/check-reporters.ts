import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  const reporters = mongoose.connection.collection('reporterprofiles');
  
  const all = await reporters.find({}).toArray();
  
  console.log(`Found ${all.length} reporters:\n`);
  
  for (const r of all) {
    console.log(`--- ${r.name} (${r.role}) ---`);
    console.log(`  writingStyle: ${r.writingStyle || '(none)'}`);
    console.log(`  personality: ${(r.personality || '(none)').substring(0, 100)}...`);
    console.log(`  specialty: ${r.specialty || '(none)'}`);
    console.log('');
  }
  
  await mongoose.disconnect();
}

main();
