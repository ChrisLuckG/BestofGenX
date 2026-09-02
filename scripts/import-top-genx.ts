import mongoose from 'mongoose';
import { Person } from '../src/models/Almanac';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

// Query for most notable GenX people (by sitelinks count = Wikipedia articles in different languages)
async function fetchTopPeople(year: number, limit: number = 300): Promise<any[]> {
  const sparql = `
    SELECT DISTINCT ?person ?personLabel ?birthDate ?deathDate ?countryLabel ?occupationLabel ?sitelinks WHERE {
      ?person wdt:P31 wd:Q5 .
      ?person wdt:P569 ?birthDate .
      ?person wikibase:sitelinks ?sitelinks .
      
      FILTER(YEAR(?birthDate) = ${year})
      FILTER(?sitelinks > 20)
      
      OPTIONAL { ?person wdt:P570 ?deathDate . }
      OPTIONAL { ?person wdt:P27 ?country . }
      OPTIONAL { ?person wdt:P106 ?occupation . }
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    ORDER BY DESC(?sitelinks)
    LIMIT ${limit}
  `;
  
  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`;
  
  try {
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'BestOfGenX/1.0',
        'Accept': 'application/sparql-results+json'
      },
      signal: AbortSignal.timeout(60000)
    });
    
    if (!res.ok) {
      console.log(`  HTTP ${res.status}`);
      return [];
    }
    
    const data = await res.json();
    return data.results?.bindings || [];
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
    return [];
  }
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
  if (country === 'United States of America' || country === 'United States') return 'USA';
  if (country === 'United Kingdom of Great Britain and Northern Ireland' || country === 'United Kingdom') return 'UK';
  if (country === 'People\'s Republic of China') return 'China';
  if (country === 'Federal Republic of Germany' || country === 'West Germany') return 'Germany';
  return country;
}

function mapProfession(occupation: string): string {
  if (!occupation) return 'Other';
  const occ = occupation.toLowerCase();
  if (occ.includes('singer') || occ.includes('musician') || occ.includes('rapper') || occ.includes('composer') || occ.includes('guitarist') || occ.includes('drummer') || occ.includes('producer')) return 'Music';
  if (occ.includes('actor') || occ.includes('actress') || occ.includes('director') || occ.includes('filmmaker')) return 'Actor';
  if (occ.includes('football') || occ.includes('basketball') || occ.includes('tennis') || occ.includes('athlete') || occ.includes('player') || occ.includes('boxer') || occ.includes('swimmer') || occ.includes('racing')) return 'Sport';
  if (occ.includes('politician') || occ.includes('president') || occ.includes('minister') || occ.includes('diplomat')) return 'Politik';
  if (occ.includes('writer') || occ.includes('author') || occ.includes('journalist') || occ.includes('poet') || occ.includes('novelist')) return 'Art';
  if (occ.includes('comedian') || occ.includes('comedy')) return 'Comedy';
  if (occ.includes('model')) return 'Model';
  if (occ.includes('programmer') || occ.includes('computer') || occ.includes('engineer') || occ.includes('entrepreneur')) return 'Tech';
  return 'Other';
}

async function main() {
  const dry = process.argv.includes('--dry');
  const targetCount = parseInt(process.argv.find(a => a.startsWith('--count='))?.split('=')[1] || '2000');
  
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  console.log(`\n=== Importing TOP ${targetCount} GenX People (by Wikipedia popularity) ===\n`);
  
  let totalAdded = 0;
  let totalSkipped = 0;
  const perYear = Math.ceil(targetCount / 16); // 16 years (1965-1980)
  
  // Process each year
  for (let year = 1965; year <= 1980; year++) {
    process.stdout.write(`📅 ${year}: `);
    
    const results = await fetchTopPeople(year, perYear);
    console.log(`${results.length} top people found`);
    
    let yearAdded = 0;
    
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
      const profession = mapProfession(r.occupationLabel?.value || '');
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
            // Store popularity for potential sorting
            knownfor: `Wikipedia: ${sitelinks} languages`,
          });
          totalAdded++;
          yearAdded++;
        } catch (e) {
          // Skip duplicates
        }
      } else {
        console.log(`  + ${firstname} ${lastname} (${profession}, ${sitelinks} wiki langs)`);
        totalAdded++;
        yearAdded++;
      }
    }
    
    console.log(`   Added: ${yearAdded}`);
    
    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`${dry ? 'Would add' : 'Added'}: ${totalAdded}`);
  console.log(`Skipped (exist): ${totalSkipped}`);
  
  if (!dry) {
    const total = await Person.countDocuments();
    console.log(`\nTotal in DB now: ${total}`);
  }
  
  await mongoose.disconnect();
}

main();
