/**
 * Import GenX people with Score 50+ from Wikidata
 * 
 * Score calculation (same as MenschenTab):
 * - knownfor: +25
 * - subcat: +10  
 * - profession (not "Other"): +10
 * - image: +15
 * - born: +15
 * - cityBorn: +10
 * - died + causeOfDeath: +5
 * 
 * To get 50+, we need at minimum: born(15) + profession(10) + image(15) + cityBorn(10) = 50
 * So we only import people who have an image in Wikidata.
 * 
 * Usage: npx tsx scripts/import-genx-score50.ts --start=1980 --end=1980
 */

import mongoose from 'mongoose';
import { Person } from '../src/models/Almanac';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

// Categories to import (non-sports, since we have 97k sports already)
const OCCUPATIONS = [
  { name: 'Music', category: 'music', qcodes: ['Q177220', 'Q639669', 'Q36834', 'Q488205', 'Q183945'] }, // singer, musician, composer, singer-songwriter, record producer
  { name: 'Actor', category: 'movies-tv', qcodes: ['Q33999', 'Q10800557', 'Q2526255', 'Q3455803'] }, // actor, film actor, film director, television actor
  { name: 'Politik', category: 'politics', qcodes: ['Q82955', 'Q193391'] }, // politician, diplomat
  { name: 'Writer', category: 'authors', qcodes: ['Q36180', 'Q6625963', 'Q28389', 'Q49757'] }, // writer, journalist, screenwriter, author
  { name: 'Tech', category: 'tech', qcodes: ['Q5482740', 'Q82594', 'Q131524'] }, // programmer, computer scientist, entrepreneur
  { name: 'Comedy', category: 'culture', qcodes: ['Q245068', 'Q15981151'] }, // comedian, stand-up comedian
];

async function queryWikidata(sparql: string): Promise<any[]> {
  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`;
  
  try {
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'BestOfGenX/1.0 (https://bestofgenx.com)',
        'Accept': 'application/sparql-results+json'
      },
      signal: AbortSignal.timeout(90000)
    });
    
    if (!res.ok) {
      console.log(`HTTP ${res.status}`);
      return [];
    }
    
    const data = await res.json();
    return data.results?.bindings || [];
  } catch (e: any) {
    console.log(`Error: ${e.message}`);
    return [];
  }
}

async function fetchPeopleWithImage(year: number, qcode: string): Promise<any[]> {
  // Only fetch people WITH an image (P18) to ensure higher score
  const sparql = `
    SELECT DISTINCT ?person ?personLabel ?birthDate ?deathDate ?birthPlaceLabel ?countryLabel ?image ?description WHERE {
      ?person wdt:P31 wd:Q5 .
      ?person wdt:P106 wd:${qcode} .
      ?person wdt:P569 ?birthDate .
      ?person wdt:P18 ?image .
      
      FILTER(YEAR(?birthDate) = ${year})
      
      OPTIONAL { ?person wdt:P570 ?deathDate . }
      OPTIONAL { ?person wdt:P19 ?birthPlace . }
      OPTIONAL { ?person wdt:P27 ?country . }
      OPTIONAL { ?person schema:description ?description . FILTER(LANG(?description) = "en") }
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 1000
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
  if (country === 'United States of America' || country === 'United States') return 'USA';
  if (country === 'United Kingdom of Great Britain and Northern Ireland' || country === 'United Kingdom') return 'UK';
  if (country === 'People\'s Republic of China') return 'China';
  if (country === 'Federal Republic of Germany' || country === 'West Germany') return 'Germany';
  return country;
}

// Calculate score same as MenschenTab
function calculateScore(person: {
  knownfor?: string;
  subcat?: string;
  profession?: string;
  image?: string;
  born?: string;
  cityBorn?: string;
  died?: string;
  causeOfDeath?: string;
}): number {
  let score = 0;
  if (person.knownfor) score += 25;
  if (person.subcat) score += 10;
  if (person.profession && person.profession !== 'Other') score += 10;
  if (person.image) score += 15;
  if (person.born) score += 15;
  if (person.cityBorn) score += 10;
  if (person.died) {
    score += 5; // died itself
    if (person.causeOfDeath) score += 5;
  }
  return score;
}

async function main() {
  const dry = process.argv.includes('--dry');
  const startYear = parseInt(process.argv.find(a => a.startsWith('--start='))?.split('=')[1] || '1980');
  const endYear = parseInt(process.argv.find(a => a.startsWith('--end='))?.split('=')[1] || '1965');
  
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  // Determine direction
  const step = startYear > endYear ? -1 : 1;
  const years: number[] = [];
  for (let y = startYear; step > 0 ? y <= endYear : y >= endYear; y += step) {
    years.push(y);
  }
  
  console.log(`\n=== Importing GenX People Score 50+ (${startYear} → ${endYear}) ===\n`);
  console.log(`Dry run: ${dry}`);
  console.log(`Years: ${years.join(', ')}\n`);
  
  let totalAdded = 0;
  let totalSkipped = 0;
  let totalLowScore = 0;
  let totalErrors = 0;
  
  for (const year of years) {
    console.log(`\n📅 Year ${year}:`);
    
    for (const occ of OCCUPATIONS) {
      for (const qcode of occ.qcodes) {
        process.stdout.write(`  ${occ.name} (${qcode})... `);
        
        const results = await fetchPeopleWithImage(year, qcode);
        let added = 0;
        let skipped = 0;
        let lowScore = 0;
        
        for (const r of results) {
          const name = r.personLabel?.value;
          if (!name || name.startsWith('Q')) continue;
          
          const { firstname, lastname } = extractName(name);
          if (!firstname) continue;
          
          const born = formatDate(r.birthDate?.value);
          const died = formatDate(r.deathDate?.value);
          const countryBorn = normalizeCountry(r.countryLabel?.value);
          const cityBorn = r.birthPlaceLabel?.value || '';
          const image = r.image?.value || '';
          const description = r.description?.value || '';
          
          // Build person object for score calculation
          const personData = {
            firstname,
            lastname,
            born,
            died: died || undefined,
            profession: occ.name,
            subcat: occ.name,
            countryBorn,
            cityBorn,
            image,
            knownfor: description,
            category: occ.category,
            isGenX: true,
          };
          
          const score = calculateScore(personData);
          
          // Skip if score < 50
          if (score < 50) {
            lowScore++;
            totalLowScore++;
            continue;
          }
          
          // Check if exists
          const existing = await Person.findOne({ 
            firstname: { $regex: new RegExp(`^${firstname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            lastname: { $regex: new RegExp(`^${lastname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          });
          
          if (existing) {
            skipped++;
            totalSkipped++;
            continue;
          }
          
          if (!dry) {
            try {
              await Person.create(personData);
              added++;
              totalAdded++;
            } catch (e) {
              totalErrors++;
            }
          } else {
            added++;
            totalAdded++;
          }
        }
        
        console.log(`${results.length} found, ${added} added, ${skipped} exist, ${lowScore} low score`);
        
        // Rate limit
        await new Promise(r => setTimeout(r, 2500));
      }
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`${dry ? 'Would add' : 'Added'}: ${totalAdded}`);
  console.log(`Skipped (exist): ${totalSkipped}`);
  console.log(`Skipped (score < 50): ${totalLowScore}`);
  console.log(`Errors: ${totalErrors}`);
  
  if (!dry) {
    // Show updated counts by category
    console.log('\nUpdated category counts:');
    const categories = await Person.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    for (const c of categories) {
      console.log(`  ${c._id || 'null'}: ${c.count}`);
    }
  }
  
  await mongoose.disconnect();
}

main();
