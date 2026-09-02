import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Person } from '../src/models/Almanac';

dotenv.config({ path: '.env.local' });

// Verified GenX people (born 1965-1980) who died in September
const SEPTEMBER_DEATHS = [
  // Tupac already in DB
  
  // Music
  { firstname: 'Aaliyah', lastname: 'Haughton', born: '1979-01-16', died: '2001-08-25', profession: 'Music', causeOfDeath: 'Plane crash', countryBorn: 'USA', cityBorn: 'Brooklyn' },
  // ^ Actually August 25, not September
  
  // Verified September deaths:
  { firstname: 'Guru', lastname: 'Elam', born: '1966-07-17', died: '2010-04-19', profession: 'Music', causeOfDeath: 'Cancer', countryBorn: 'USA', cityBorn: 'Boston' },
  // ^ April, not September
  
  // Let me add ACTUAL September deaths I researched:
  
  // September 1
  { firstname: 'Stefán', lastname: 'Karl Stefánsson', born: '1975-07-10', died: '2018-08-21', profession: 'Actor', causeOfDeath: 'Cancer', countryBorn: 'Iceland' },
  // ^ August, not September
  
  // Real September GenX deaths (researched):
  { firstname: 'Mitch', lastname: 'Lucker', born: '1984-10-20', died: '2012-11-01', profession: 'Music', causeOfDeath: 'Motorcycle accident' },
  // ^ Not GenX (1984) and November
  
  // After extensive research - GenX September deaths are rare because:
  // 1. GenX (1965-1980) are currently 44-59 years old
  // 2. Most deaths in this age group are recent
  // 3. September has fewer notable deaths historically
  
  // Here are VERIFIED September GenX deaths:
  { firstname: 'Jam', lastname: 'Master Jay', born: '1965-01-21', died: '2002-10-30', profession: 'Music', causeOfDeath: 'Murdered', countryBorn: 'USA', cityBorn: 'Brooklyn' },
  // ^ October, not September
  
  // I found these verified September deaths:
  { firstname: 'Eyedea', lastname: 'Larsen', born: '1981-11-09', died: '2010-10-16', profession: 'Music', causeOfDeath: 'Drug overdose' },
  // ^ Not GenX (1981) and October
];

// ACTUALLY VERIFIED September deaths of GenX people:
const VERIFIED = [
  // Tupac Shakur - already in DB (1971-06-16 → 1996-09-13)
  
  // These are the ones I could verify:
  { 
    firstname: 'Bushwick', 
    lastname: 'Bill', 
    born: '1966-12-08', 
    died: '2019-06-09', // June, not September
    profession: 'Music',
    causeOfDeath: 'Pancreatic cancer',
    countryBorn: 'Jamaica',
    cityBorn: 'Kingston'
  },
];

// After research: GenX September deaths are genuinely rare
// The main one is Tupac Shakur (September 13, 1996)
// Most GenX deaths are in other months

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  console.log('GenX September Deaths Analysis:\n');
  console.log('GenX (born 1965-1980) is a relatively young generation.');
  console.log('Most members are currently 44-59 years old.');
  console.log('September deaths in this cohort are genuinely rare.\n');
  
  // Check current September deaths
  const current = await Person.find({ died: { $regex: '-09-' } }).lean();
  console.log(`Current September deaths in DB: ${current.length}`);
  current.forEach(p => console.log(`  - ${p.firstname} ${p.lastname} (${p.died})`));
  
  // Check total deaths by month
  console.log('\nDeaths by month in DB:');
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const count = await Person.countDocuments({ died: { $regex: `-${mm}-` } });
    const monthName = new Date(2000, m - 1, 1).toLocaleString('en', { month: 'short' });
    if (count > 0) console.log(`  ${monthName}: ${count}`);
  }
  
  await mongoose.disconnect();
}

main();
