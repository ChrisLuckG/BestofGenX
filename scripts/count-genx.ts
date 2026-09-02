import mongoose from 'mongoose';
import { Person } from '../src/models/Almanac';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  const total = await Person.countDocuments();
  const alive = await Person.countDocuments({ $or: [{ died: { $exists: false } }, { died: null }, { died: '' }] });
  const deceased = await Person.countDocuments({ died: { $exists: true, $ne: null, $gt: '' } });
  
  console.log('=== GenX Database Stats ===\n');
  console.log('Total GenX people:', total);
  console.log('Alive:', alive);
  console.log('Deceased:', deceased);
  
  // By profession
  console.log('\nBy Profession:');
  const professions = await Person.aggregate([
    { $group: { _id: '$profession', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  professions.forEach(p => console.log(`  ${p._id || 'Unknown'}: ${p.count}`));
  
  // By country (top 10)
  console.log('\nTop 10 Countries:');
  const countries = await Person.aggregate([
    { $group: { _id: '$countryBorn', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
  countries.forEach(c => console.log(`  ${c._id || 'Unknown'}: ${c.count}`));
  
  await mongoose.disconnect();
}

main();
