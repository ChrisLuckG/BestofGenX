import mongoose from 'mongoose';
import { Person } from '../src/models/Almanac';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

// Query for most notable people born in a specific year range with high sitelinks
async function fetchTopPeopleByOccupation(qcode: string, profName: string, limit: number = 500): Promise<any[]> {
  // Use VALUES for years to make query faster
  const sparql = `
    SELECT DISTINCT ?person ?personLabel ?birthDate ?deathDate ?countryLabel ?sitelinks WHERE {
      VALUES ?year { 1965 1966 1967 1968 1969 1970 1971 1972 1973 1974 1975 1976 1977 1978 1979 1980 }
      
      ?person wdt:P31 wd:Q5 .
      ?person wdt:P106 wd:${qcode} .
      ?person wdt:P569 ?birthDate .
      ?person wikibase:sitelinks ?sitelinks .
      
      FILTER(YEAR(?birthDate) = ?year)
      FILTER(?sitelinks > 30)
      
      OPTIONAL { ?person wdt:P570 ?deathDate . }
      OPTIONAL { ?person wdt:P27 ?country . }
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    ORDER BY DESC(?sitelinks)
    LIMIT ${limit}
  `;
  
  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`;
  
  try {
    console.log(`  Fetching top ${profName}...`);
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'BestOfGenX/1.0',
        'Accept': 'application/sparql-results+json'
      },
      signal: AbortSignal.timeout(90000)
    });
    
    if (!res.ok) {
      console.log(`    HTTP ${res.status}`);
      return [];
    }
    
    const data = await res.json();
    return data.results?.bindings || [];
  } catch (e: any) {
    console.log(`    Error: ${e.message}`);
    return [];
  }
}

// Top occupations to search
const TOP_OCCUPATIONS = [
  { qcode: 'Q33999', name: 'Actor', limit: 400 },
  { qcode: 'Q177220', name: 'Singer', limit: 400 },
  { qcode: 'Q937857', name: 'Football Player', limit: 300 },
  { qcode: 'Q3665646', name: 'Basketball Player', limit: 200 },
  { qcode: 'Q2526255', name: 'Film Director', limit: 200 },
  { qcode: 'Q36180', name: 'Writer', limit: 200 },
  { qcode: 'Q82955', name: 'Politician', limit: 200 },
  { qcode: 'Q639669', name: 'Musician', limit: 200 },
];

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  return dateStr.substring(0, 10);
}

function extractName(label: string): { firstname: string; lastname: string } {
  if (!label || label.startsWith('Q')) return { firstname: '', lastname: '' };
  const parts = label.trim().split(' ');
  if (parts.length === 1) return { firstname: parts[0], lastname: '' };
  return { firstname: parts[0], lastname: parts.slice(1).join(' ') };
}

function normalizeCountry(country: string | undefined): string {
  if (!country) return '';
  if (country === 'United States of America' || country === 'United States') return 'USA';
  if (country === 'United Kingdom of Great Britain and Northern Ireland' || country === 'United Kingdom') return 'UK';
  return country;
}

function mapProfession(occName: string): string {
  if (occName.includes('Singer') || occName.includes('Musician')) return 'Music';
  if (occName.includes('Actor') || occName.includes('Director')) return 'Actor';
  if (occName.includes('Football') || occName.includes('Basketball')) return 'Sport';
  if (occName.includes('Politician')) return 'Politik';
  if (occName.includes('Writer')) return 'Art';
  return 'Other';
}

async function main() {
  const dry = process.argv.includes('--dry');
  
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  console.log(`\n=== Importing TOP GenX People (most famous, 30+ Wikipedia languages) ===\n`);
  
  let totalAdded = 0;
  let totalSkipped = 0;
  
  for (const occ of TOP_OCCUPATIONS) {
    const results = await fetchTopPeopleByOccupation(occ.qcode, occ.name, occ.limit);
    console.log(`    Found: ${results.length}`);
    
    let added = 0;
    
    for (const r of results) {
      const name = r.personLabel?.value;
      if (!name || name.startsWith('Q')) continue;
      
      const { firstname, lastname } = extractName(name);
      if (!firstname) continue;
      
      // Check if exists
      const existing = await Person.findOne({ 
        firstname: { $regex: new RegExp(`^${firstname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        lastname: { $regex: new RegExp(`^${lastname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      
      if (existing) {
        totalSkipped++;
        continue;
      }
      
      const born = formatDate(r.birthDate?.value);
      const died = formatDate(r.deathDate?.value);
      const countryBorn = normalizeCountry(r.countryLabel?.value);
      const profession = mapProfession(occ.name);
      const sitelinks = parseInt(r.sitelinks?.value || '0');
      
      if (!dry) {
        try {
          await Person.create({
            firstname,
            lastname,
            born,
            died: died || undefined,
            profession,
            countryBorn,
            isGenX: true,
          });
          added++;
          totalAdded++;
        } catch (e) {
          // Skip
        }
      } else {
        console.log(`    + ${firstname} ${lastname} (${sitelinks} wiki)`);
        added++;
        totalAdded++;
      }
    }
    
    console.log(`    Added: ${added}\n`);
    
    // Rate limit
    await new Promise(r => setTimeout(r, 3000));
  }
  
  console.log(`=== Summary ===`);
  console.log(`${dry ? 'Would add' : 'Added'}: ${totalAdded}`);
  console.log(`Skipped (exist): ${totalSkipped}`);
  
  if (!dry) {
    const total = await Person.countDocuments();
    console.log(`\nTotal in DB now: ${total}`);
  }
  
  await mongoose.disconnect();
}

main();
