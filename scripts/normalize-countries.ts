import mongoose from 'mongoose';
import { Person } from '../src/models/Almanac';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Country name normalization map
const COUNTRY_MAP: Record<string, string> = {
  'United States of America': 'USA',
  'United States': 'USA',
  'United Kingdom of Great Britain and Northern Ireland': 'UK',
  'United Kingdom': 'UK',
  'England': 'UK',
  'Scotland': 'UK',
  'Wales': 'UK',
  'Northern Ireland': 'UK',
  'People\'s Republic of China': 'China',
  'Republic of China': 'Taiwan',
  'Federal Republic of Germany': 'Germany',
  'West Germany': 'Germany',
  'East Germany': 'Germany',
  'Soviet Union': 'Russia',
  'USSR': 'Russia',
  'Russian Federation': 'Russia',
  'Republic of Korea': 'South Korea',
  'Democratic People\'s Republic of Korea': 'North Korea',
  'Czech Republic': 'Czechia',
  'The Netherlands': 'Netherlands',
  'Kingdom of the Netherlands': 'Netherlands',
  'Republic of Ireland': 'Ireland',
  'New Zealand': 'New Zealand',
  'Republic of South Africa': 'South Africa',
  'Argentine Republic': 'Argentina',
  'Federative Republic of Brazil': 'Brazil',
  'United Mexican States': 'Mexico',
  'Republic of India': 'India',
  'Commonwealth of Australia': 'Australia',
  'Kingdom of Spain': 'Spain',
  'French Republic': 'France',
  'Italian Republic': 'Italy',
  'Kingdom of Sweden': 'Sweden',
  'Kingdom of Norway': 'Norway',
  'Kingdom of Denmark': 'Denmark',
  'Swiss Confederation': 'Switzerland',
  'Republic of Austria': 'Austria',
  'Kingdom of Belgium': 'Belgium',
  'Portuguese Republic': 'Portugal',
  'Hellenic Republic': 'Greece',
  'Republic of Turkey': 'Turkey',
  'Republic of Poland': 'Poland',
  'Unknown': '',
};

async function main() {
  const dry = process.argv.includes('--dry');
  
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  console.log('=== Normalizing Country Names ===\n');
  
  let totalUpdated = 0;
  
  for (const [oldName, newName] of Object.entries(COUNTRY_MAP)) {
    const count = await Person.countDocuments({ countryBorn: oldName });
    
    if (count > 0) {
      console.log(`${oldName} → ${newName || '(empty)'}: ${count} people`);
      
      if (!dry) {
        await Person.updateMany(
          { countryBorn: oldName },
          { $set: { countryBorn: newName } }
        );
        totalUpdated += count;
      }
    }
  }
  
  console.log(`\n${dry ? 'Would update' : 'Updated'}: ${totalUpdated} people`);
  
  // Show final country distribution
  if (!dry) {
    console.log('\n=== Updated Country Distribution (Top 15) ===\n');
    const countries = await Person.aggregate([
      { $match: { countryBorn: { $exists: true, $ne: '' } } },
      { $group: { _id: '$countryBorn', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 }
    ]);
    countries.forEach(c => console.log(`  ${c._id}: ${c.count}`));
  }
  
  await mongoose.disconnect();
}

main();
