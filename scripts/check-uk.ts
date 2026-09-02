import mongoose from 'mongoose';
import { Person } from '../src/models/Almanac';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  const wales = await Person.countDocuments({ countryBorn: 'Wales' });
  const scotland = await Person.countDocuments({ countryBorn: 'Scotland' });
  const england = await Person.countDocuments({ countryBorn: 'England' });
  const uk = await Person.countDocuments({ countryBorn: 'UK' });
  const ni = await Person.countDocuments({ countryBorn: 'Northern Ireland' });
  
  console.log('Current UK-related countries:');
  console.log('  Wales:', wales);
  console.log('  Scotland:', scotland);
  console.log('  England:', england);
  console.log('  Northern Ireland:', ni);
  console.log('  UK:', uk);
  console.log('  Total:', wales + scotland + england + ni + uk);
  
  await mongoose.disconnect();
}

main();
