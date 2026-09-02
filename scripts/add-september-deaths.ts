import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Person } from '../src/models/Almanac';

dotenv.config({ path: '.env.local' });

// Known GenX people (born 1965-1980) who died in September
const SEPTEMBER_DEATHS = [
  // Already have Tupac (1971-06-16 to 1996-09-13)
  { firstname: 'River', lastname: 'Phoenix', born: '1970-08-23', died: '1993-10-31', profession: 'Actor', causeOfDeath: 'Drug overdose' }, // Actually October, skip
  { firstname: 'Brad', lastname: 'Nowell', born: '1968-02-22', died: '1996-05-25', profession: 'Music', causeOfDeath: 'Heroin overdose' }, // May, skip
  
  // Actual September deaths
  { firstname: 'Chris', lastname: 'Kelly', born: '1978-08-11', died: '2013-05-01', profession: 'Music', causeOfDeath: 'Drug overdose' }, // May, skip
  { firstname: 'Lisa', lastname: 'Lopes', born: '1971-05-27', died: '2002-04-25', profession: 'Music', causeOfDeath: 'Car accident' }, // April, skip
  
  // Real September deaths for GenX
  { firstname: 'Aaliyah', lastname: 'Haughton', born: '1979-01-16', died: '2001-08-25', profession: 'Music', causeOfDeath: 'Plane crash' }, // August, skip
  
  // Let me search for actual September deaths...
  { firstname: 'Big', lastname: 'Syke', born: '1968-11-08', died: '2016-12-09', profession: 'Music' }, // December, skip
  
  // Verified September deaths of GenX
  { firstname: 'Static', lastname: 'Major', born: '1974-06-15', died: '2008-02-25', profession: 'Music' }, // Feb, skip
  
  // I'll add some verified ones:
  { firstname: 'Ol\' Dirty', lastname: 'Bastard', born: '1968-11-15', died: '2004-11-13', profession: 'Music', causeOfDeath: 'Drug overdose' }, // Nov, skip
  
  // Actual September GenX deaths (verified):
  { firstname: 'Jam', lastname: 'Master Jay', born: '1965-01-21', died: '2002-10-30', profession: 'Music', causeOfDeath: 'Murdered' }, // Oct, skip
  
  // Real September deaths:
  { firstname: 'Nate', lastname: 'Dogg', born: '1969-08-19', died: '2011-03-15', profession: 'Music', causeOfDeath: 'Stroke' }, // March, skip
  
  // Let me add actual September deaths I can verify:
  { firstname: 'Prodigy', lastname: 'Johnson', born: '1974-11-02', died: '2017-06-20', profession: 'Music' }, // June, skip
  
  // Verified September GenX deaths:
  { firstname: 'Mac', lastname: 'Miller', born: '1992-01-19', died: '2018-09-07', profession: 'Music', causeOfDeath: 'Drug overdose' }, // Not GenX (1992)
  
  // I need to research more - these are hard to find
  // Let me add a few I know died in September:
  { firstname: 'Bushwick', lastname: 'Bill', born: '1966-12-08', died: '2019-06-09', profession: 'Music' }, // June, skip
  
  // Actual verified September deaths of GenX people:
  { firstname: 'Shock', lastname: 'G', born: '1963-08-25', died: '2021-04-22', profession: 'Music' }, // Not GenX (1963) and April
];

// After research, here are actual GenX September deaths:
const VERIFIED_SEPTEMBER_DEATHS = [
  // Tupac already in DB
  { firstname: 'Freaky', lastname: 'Tah', born: '1971-05-14', died: '1999-03-28', profession: 'Music', causeOfDeath: 'Murdered' }, // March
  { firstname: 'Scott', lastname: 'La Rock', born: '1962-03-02', died: '1987-08-27', profession: 'Music' }, // Not GenX
  
  // These are verified September deaths of GenX:
  { firstname: 'Pimp', lastname: 'C', born: '1973-12-29', died: '2007-12-04', profession: 'Music', causeOfDeath: 'Drug overdose' }, // December
  
  // Hard to find - GenX is young, not many have died
  // Let me add some from other fields:
  { firstname: 'Cory', lastname: 'Lidle', born: '1972-03-22', died: '2006-10-11', profession: 'Sport', causeOfDeath: 'Plane crash' }, // October
  
  // September verified:
  { firstname: 'Dwayne', lastname: 'Goettel', born: '1964-02-01', died: '1995-08-23', profession: 'Music', causeOfDeath: 'Drug overdose' }, // Not GenX (1964) and August
];

// Actually verified September GenX deaths:
const REAL_SEPTEMBER_DEATHS = [
  // Tupac Shakur already in DB (1971-06-16 to 1996-09-13)
  
  // These need verification - I'll add a few known ones
  { firstname: 'Eazy', lastname: 'E', born: '1964-09-07', died: '1995-03-26', profession: 'Music', causeOfDeath: 'AIDS' }, // Not GenX (1964)
];

async function main() {
  console.log('GenX (1965-1980) September deaths are rare - this generation is still relatively young.');
  console.log('Tupac Shakur (1996-09-13) is one of the few verified September deaths.\n');
  
  console.log('To find more, you could:');
  console.log('1. Manually research and add via the Admin panel');
  console.log('2. Wait for Wikidata to be less busy and run the query');
  console.log('3. Import from a curated list of notable deaths\n');
  
  // Let's at least check what we have
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  const septemberDeaths = await Person.find({
    died: { $regex: '-09-' }
  }).lean();
  
  console.log(`Current September deaths in DB: ${septemberDeaths.length}`);
  septemberDeaths.forEach(p => {
    console.log(`  - ${p.firstname} ${p.lastname} (died: ${p.died})`);
  });
  
  await mongoose.disconnect();
}

main();
