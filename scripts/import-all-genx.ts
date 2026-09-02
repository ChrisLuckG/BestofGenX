import mongoose from 'mongoose';
import { Person } from '../src/models/Almanac';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

// All occupation categories with their Wikidata Q-codes
const OCCUPATIONS = [
  { name: 'Music', qcodes: ['Q177220', 'Q639669', 'Q36834', 'Q488205', 'Q183945', 'Q753110', 'Q855091'] }, // singer, musician, composer, singer-songwriter, record producer, guitarist, drummer
  { name: 'Actor', qcodes: ['Q33999', 'Q10800557', 'Q2526255', 'Q3455803', 'Q10798782'] }, // actor, film actor, film director, television actor, voice actor
  { name: 'Sport', qcodes: ['Q937857', 'Q3665646', 'Q11513337', 'Q10833314', 'Q19204627'] }, // football player, basketball player, tennis player, ice hockey player, American football player
  { name: 'Politik', qcodes: ['Q82955', 'Q193391'] }, // politician, diplomat
  { name: 'Art', qcodes: ['Q36180', 'Q6625963', 'Q28389', 'Q1930187', 'Q1028181'] }, // writer, journalist, screenwriter, journalist, painter
  { name: 'Comedy', qcodes: ['Q245068', 'Q15981151'] }, // comedian, stand-up comedian
  { name: 'Model', qcodes: ['Q4610556', 'Q3024417'] }, // model, fashion model
  { name: 'Tech', qcodes: ['Q5482740', 'Q82594'] }, // programmer, computer scientist
];

async function queryWikidata(sparql: string): Promise<any[]> {
  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`;
  
  try {
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'BestOfGenX/1.0 (https://bestofgenx.com)',
        'Accept': 'application/sparql-results+json'
      },
      signal: AbortSignal.timeout(60000)
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

async function fetchPeopleForYearAndOccupation(year: number, qcode: string): Promise<any[]> {
  const sparql = `
    SELECT DISTINCT ?person ?personLabel ?birthDate ?deathDate ?birthPlaceLabel ?deathPlaceLabel ?countryLabel WHERE {
      ?person wdt:P31 wd:Q5 .
      ?person wdt:P106 wd:${qcode} .
      ?person wdt:P569 ?birthDate .
      FILTER(YEAR(?birthDate) = ${year})
      
      OPTIONAL { ?person wdt:P570 ?deathDate . }
      OPTIONAL { ?person wdt:P19 ?birthPlace . }
      OPTIONAL { ?person wdt:P20 ?deathPlace . }
      OPTIONAL { ?person wdt:P27 ?country . }
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 2000
  `;
  
  return queryWikidata(sparql);
}

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
  if (country === 'United States of America') return 'USA';
  if (country === 'United Kingdom of Great Britain and Northern Ireland') return 'UK';
  return country;
}

async function main() {
  const dry = process.argv.includes('--dry');
  const startYear = parseInt(process.argv.find(a => a.startsWith('--start='))?.split('=')[1] || '1965');
  const endYear = parseInt(process.argv.find(a => a.startsWith('--end='))?.split('=')[1] || '1980');
  
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  console.log(`\n=== Importing ALL GenX People (${startYear}-${endYear}) ===\n`);
  console.log(`Dry run: ${dry}\n`);
  
  let totalAdded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  
  // Process each year
  for (let year = startYear; year <= endYear; year++) {
    console.log(`\n📅 Year ${year}:`);
    
    // Process each occupation category
    for (const occ of OCCUPATIONS) {
      for (const qcode of occ.qcodes) {
        process.stdout.write(`  ${occ.name} (${qcode})... `);
        
        const results = await fetchPeopleForYearAndOccupation(year, qcode);
        console.log(`${results.length} found`);
        
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
          const cityBorn = r.birthPlaceLabel?.value || '';
          
          if (!dry) {
            try {
              await Person.create({
                firstname,
                lastname,
                born,
                died: died || undefined,
                profession: occ.name,
                countryBorn,
                cityBorn,
                isGenX: true,
              });
              totalAdded++;
            } catch (e) {
              totalErrors++;
            }
          } else {
            totalAdded++;
          }
        }
        
        // Rate limit - wait between requests
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`${dry ? 'Would add' : 'Added'}: ${totalAdded}`);
  console.log(`Skipped (exist): ${totalSkipped}`);
  console.log(`Errors: ${totalErrors}`);
  
  // Final count
  if (!dry) {
    const total = await Person.countDocuments();
    console.log(`\nTotal in DB now: ${total}`);
  }
  
  await mongoose.disconnect();
}

main();
