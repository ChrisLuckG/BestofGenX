import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  const persons = mongoose.connection.collection('persons');
  
  // Get a few persons to see their structure
  const people = await persons.find({}).limit(5).toArray();
  
  console.log('Sample persons:');
  for (const p of people) {
    console.log('\n---');
    console.log('Name:', p.firstname, p.lastname);
    console.log('countryBorn:', p.countryBorn);
    console.log('nationality:', p.nationality);
    console.log('countryCode:', p.countryCode);
    console.log('country:', (p as any).country);
  }
  
  // Count total
  const total = await persons.countDocuments();
  console.log('\n\nTotal persons:', total);
  
  await mongoose.disconnect();
}

main();
