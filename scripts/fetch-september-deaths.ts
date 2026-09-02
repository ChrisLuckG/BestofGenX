import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Person } from '../src/models/Almanac';

dotenv.config({ path: '.env.local' });

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

async function fetchSeptemberDeaths() {
  // Query for GenX people (born 1965-1980) who died in September
  // Using VALUES for birth years to make it faster
  const sparql = `
    SELECT ?person ?personLabel ?birthDate ?deathDate ?occupationLabel WHERE {
      VALUES ?birthYear { 1965 1966 1967 1968 1969 1970 1971 1972 1973 1974 1975 1976 1977 1978 1979 1980 }
      
      ?person wdt:P31 wd:Q5 .
      ?person wdt:P569 ?birthDate .
      ?person wdt:P570 ?deathDate .
      ?person wdt:P106 ?occupation .
      
      FILTER(YEAR(?birthDate) = ?birthYear)
      FILTER(MONTH(?deathDate) = 9)
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 150
  `;
  
  console.log('Fetching GenX September deaths from Wikidata...\n');
  
  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`;
  
  const res = await fetch(url, {
    headers: { 
      'User-Agent': 'BestOfGenX/1.0',
      'Accept': 'application/sparql-results+json'
    }
  });
  
  if (!res.ok) {
    console.log('Error:', res.status, res.statusText);
    return [];
  }
  
  const data = await res.json();
  const results = data.results?.bindings || [];
  
  console.log(`Found ${results.length} results from Wikidata\n`);
  
  // Deduplicate by person URI
  const seen = new Set<string>();
  const unique: any[] = [];
  
  for (const r of results) {
    const uri = r.person?.value;
    if (seen.has(uri)) continue;
    seen.add(uri);
    unique.push(r);
  }
  
  return unique;
}

function formatDate(dateStr: string): string {
  // Convert "1996-09-13T00:00:00Z" to "1996-09-13"
  return dateStr?.substring(0, 10) || '';
}

function extractName(label: string): { firstname: string; lastname: string } {
  const parts = label.trim().split(' ');
  if (parts.length === 1) return { firstname: parts[0], lastname: '' };
  return { firstname: parts[0], lastname: parts.slice(1).join(' ') };
}

function mapProfession(occupation: string): string {
  const occ = occupation.toLowerCase();
  if (occ.includes('singer') || occ.includes('musician') || occ.includes('rapper') || occ.includes('composer')) return 'Music';
  if (occ.includes('actor') || occ.includes('actress')) return 'Actor';
  if (occ.includes('football') || occ.includes('basketball') || occ.includes('athlete') || occ.includes('player')) return 'Sport';
  if (occ.includes('politician') || occ.includes('president') || occ.includes('minister')) return 'Politik';
  if (occ.includes('writer') || occ.includes('author') || occ.includes('journalist')) return 'Art';
  if (occ.includes('director') || occ.includes('producer') || occ.includes('filmmaker')) return 'Actor';
  if (occ.includes('model')) return 'Model';
  if (occ.includes('comedian')) return 'Comedy';
  return 'Other';
}

async function main() {
  const dry = process.argv.includes('--dry');
  
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  const wikidataResults = await fetchSeptemberDeaths();
  
  let added = 0;
  let skipped = 0;
  
  for (const r of wikidataResults) {
    const name = r.personLabel?.value;
    if (!name || name.startsWith('Q')) continue; // Skip if no label
    
    const { firstname, lastname } = extractName(name);
    const born = formatDate(r.birthDate?.value);
    const died = formatDate(r.deathDate?.value);
    const profession = mapProfession(r.occupationLabel?.value || '');
    
    // Check if already exists
    const existing = await Person.findOne({ 
      firstname: { $regex: new RegExp(`^${firstname}$`, 'i') },
      lastname: { $regex: new RegExp(`^${lastname}$`, 'i') }
    });
    
    if (existing) {
      skipped++;
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
        causeOfDeath: r.causeLabel?.value || '',
        cityBorn: r.birthPlaceLabel?.value || '',
        cityDied: r.deathPlaceLabel?.value || '',
        isGenX: true,
      });
      added++;
    }
  }
  
  console.log(`\n${dry ? 'Would add' : 'Added'}: ${added} people`);
  console.log(`Skipped (already exist): ${skipped}`);
  
  await mongoose.disconnect();
}

main();
