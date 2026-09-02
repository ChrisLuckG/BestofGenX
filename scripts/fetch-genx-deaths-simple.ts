import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Person } from '../src/models/Almanac';

dotenv.config({ path: '.env.local' });

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

// Professions to search for (Wikidata Q-codes)
const OCCUPATIONS = [
  'Q177220', // singer
  'Q33999',  // actor
  'Q937857', // football player
  'Q3665646', // basketball player
  'Q639669', // musician
  'Q36834',  // composer
  'Q10800557', // film actor
  'Q2526255', // film director
  'Q28389',  // screenwriter
  'Q183945', // record producer
  'Q488205', // singer-songwriter
];

async function fetchDeathsForDay(month: number, day: number) {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  
  // Simpler query - search for specific death date pattern
  const sparql = `
    SELECT ?person ?personLabel ?birthDate ?deathDate ?occupationLabel WHERE {
      ?person wdt:P31 wd:Q5 .
      ?person wdt:P569 ?birthDate .
      ?person wdt:P570 ?deathDate .
      ?person wdt:P106 ?occupation .
      
      FILTER(YEAR(?birthDate) >= 1965 && YEAR(?birthDate) <= 1980)
      FILTER(MONTH(?deathDate) = ${month} && DAY(?deathDate) = ${day})
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 50
  `;
  
  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`;
  
  try {
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'BestOfGenX/1.0',
        'Accept': 'application/sparql-results+json'
      },
      signal: AbortSignal.timeout(15000)
    });
    
    if (!res.ok) return [];
    
    const data = await res.json();
    return data.results?.bindings || [];
  } catch (e) {
    console.log(`  Day ${dd}: timeout/error`);
    return [];
  }
}

function formatDate(dateStr: string): string {
  return dateStr?.substring(0, 10) || '';
}

function extractName(label: string): { firstname: string; lastname: string } {
  const parts = label.trim().split(' ');
  if (parts.length === 1) return { firstname: parts[0], lastname: '' };
  return { firstname: parts[0], lastname: parts.slice(1).join(' ') };
}

function mapProfession(occupation: string): string {
  const occ = occupation.toLowerCase();
  if (occ.includes('singer') || occ.includes('musician') || occ.includes('rapper') || occ.includes('composer') || occ.includes('producer')) return 'Music';
  if (occ.includes('actor') || occ.includes('actress') || occ.includes('director')) return 'Actor';
  if (occ.includes('football') || occ.includes('basketball') || occ.includes('athlete') || occ.includes('player') || occ.includes('boxer')) return 'Sport';
  if (occ.includes('politician') || occ.includes('president') || occ.includes('minister')) return 'Politik';
  if (occ.includes('writer') || occ.includes('author') || occ.includes('journalist')) return 'Art';
  if (occ.includes('model')) return 'Model';
  if (occ.includes('comedian')) return 'Comedy';
  return 'Other';
}

async function main() {
  const dry = process.argv.includes('--dry');
  const month = 9; // September
  
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  console.log(`Fetching GenX deaths for September (day by day)...\n`);
  
  let totalAdded = 0;
  let totalSkipped = 0;
  const allResults: any[] = [];
  
  // Fetch each day of September
  for (let day = 1; day <= 30; day++) {
    process.stdout.write(`  Day ${day}... `);
    const results = await fetchDeathsForDay(month, day);
    console.log(`${results.length} found`);
    allResults.push(...results);
    
    // Rate limit
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log(`\nTotal results: ${allResults.length}\n`);
  
  // Deduplicate
  const seen = new Set<string>();
  
  for (const r of allResults) {
    const name = r.personLabel?.value;
    if (!name || name.startsWith('Q')) continue;
    
    const uri = r.person?.value;
    if (seen.has(uri)) continue;
    seen.add(uri);
    
    const { firstname, lastname } = extractName(name);
    const born = formatDate(r.birthDate?.value);
    const died = formatDate(r.deathDate?.value);
    const profession = mapProfession(r.occupationLabel?.value || '');
    
    // Check if exists
    const existing = await Person.findOne({ 
      firstname: { $regex: new RegExp(`^${firstname}$`, 'i') },
      lastname: { $regex: new RegExp(`^${lastname}$`, 'i') }
    });
    
    if (existing) {
      totalSkipped++;
      continue;
    }
    
    console.log(`+ ${firstname} ${lastname} (${born} - ${died}) - ${profession}`);
    
    if (!dry) {
      await Person.create({
        firstname,
        lastname,
        born,
        died,
        profession,
        isGenX: true,
      });
      totalAdded++;
    }
  }
  
  console.log(`\n${dry ? 'Would add' : 'Added'}: ${totalAdded}`);
  console.log(`Skipped (exist): ${totalSkipped}`);
  
  await mongoose.disconnect();
}

main();
