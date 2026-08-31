/**
 * MASTER SCRIPT: Update ALL person data from Wikidata
 * 
 * Fetches: cityBorn, countryBorn, cityDied, countryDied, causeOfDeath, profession
 * 
 * Run with: npx ts-node scripts/update-person-data.ts
 * 
 * Options:
 *   --limit=500     Process max N people (default: 500)
 *   --month=8       Only process people born in month (1-12)
 *   --all           Process ALL people (ignores limit)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI!;

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name: string, def: string) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : def;
};
const hasFlag = (name: string) => args.includes(`--${name}`);

const LIMIT = hasFlag('all') ? 100000 : parseInt(getArg('limit', '500'));
const MONTH_FILTER = getArg('month', '');

// Person schema
const PersonSchema = new mongoose.Schema({
  firstname: String,
  lastname: String,
  born: String,
  died: String,
  causeOfDeath: String,
  countryDied: String,
  cityDied: String,
  profession: String,
  subcat: String,
  knownfor: String,
  countryBorn: String,
  cityBorn: String,
  nationality: String,
  countryCode: String,
  image: String,
  wikiUrl: String,
  isGenX: Boolean,
  birthYear: Number,
}, { timestamps: true, strict: false });

// Wikidata SPARQL endpoint
const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

async function queryWikidata(sparql: string): Promise<any[]> {
  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`;
  
  try {
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'SportTock/1.0 (https://sporttock.com)',
        'Accept': 'application/sparql-results+json'
      }
    });
    
    if (!res.ok) {
      if (res.status === 429) {
        console.log('  Rate limited, waiting 30s...');
        await new Promise(r => setTimeout(r, 30000));
        return queryWikidata(sparql);
      }
      return [];
    }
    
    const data = await res.json();
    return data.results?.bindings || [];
  } catch (err) {
    console.error('  Wikidata error:', err);
    return [];
  }
}

async function fetchPersonDataFromWikidata(name: string, birthDate: string): Promise<{
  cityBorn?: string;
  countryBorn?: string;
  cityDied?: string;
  countryDied?: string;
  causeOfDeath?: string;
  deathDate?: string;
} | null> {
  // Search by name and birth year
  const birthYear = birthDate?.substring(0, 4) || '';
  
  const sparql = `
    SELECT ?person ?personLabel ?birthPlaceLabel ?birthCountryLabel ?deathPlaceLabel ?deathCountryLabel ?causeLabel ?deathDate WHERE {
      ?person wdt:P31 wd:Q5 .
      ?person rdfs:label "${name}"@en .
      ${birthYear ? `?person wdt:P569 ?birthDate . FILTER(YEAR(?birthDate) = ${birthYear})` : ''}
      
      OPTIONAL { 
        ?person wdt:P19 ?birthPlace .
        OPTIONAL { ?birthPlace wdt:P17 ?birthCountry . }
      }
      OPTIONAL { 
        ?person wdt:P20 ?deathPlace .
        OPTIONAL { ?deathPlace wdt:P17 ?deathCountry . }
      }
      OPTIONAL { ?person wdt:P509 ?cause . }
      OPTIONAL { ?person wdt:P570 ?deathDate . }
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 1
  `;
  
  const results = await queryWikidata(sparql);
  
  if (results.length === 0) return null;
  
  const r = results[0];
  return {
    cityBorn: r.birthPlaceLabel?.value,
    countryBorn: normalizeCountry(r.birthCountryLabel?.value),
    cityDied: r.deathPlaceLabel?.value,
    countryDied: normalizeCountry(r.deathCountryLabel?.value),
    causeOfDeath: r.causeLabel?.value,
    deathDate: r.deathDate?.value?.substring(0, 10),
  };
}

function normalizeCountry(country: string | undefined): string | undefined {
  if (!country) return undefined;
  if (country === 'United States of America' || country === 'United States') return 'USA';
  if (country === 'United Kingdom of Great Britain and Northern Ireland' || country === 'United Kingdom') return 'UK';
  return country;
}

// Batch query for multiple people at once
async function fetchBatchFromWikidata(people: { name: string; birthYear: string }[]): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  
  // Build VALUES clause
  const values = people.map(p => `("${p.name.replace(/"/g, '\\"')}"@en ${p.birthYear})`).join(' ');
  
  const sparql = `
    SELECT ?personLabel ?birthYear ?birthPlaceLabel ?birthCountryLabel ?deathPlaceLabel ?deathCountryLabel ?causeLabel ?deathDate WHERE {
      VALUES (?nameLabel ?birthYear) { ${values} }
      
      ?person wdt:P31 wd:Q5 .
      ?person rdfs:label ?nameLabel .
      ?person wdt:P569 ?birthDate .
      FILTER(YEAR(?birthDate) = ?birthYear)
      
      OPTIONAL { 
        ?person wdt:P19 ?birthPlace .
        OPTIONAL { ?birthPlace wdt:P17 ?birthCountry . }
      }
      OPTIONAL { 
        ?person wdt:P20 ?deathPlace .
        OPTIONAL { ?deathPlace wdt:P17 ?deathCountry . }
      }
      OPTIONAL { ?person wdt:P509 ?cause . }
      OPTIONAL { ?person wdt:P570 ?deathDate . }
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  `;
  
  const data = await queryWikidata(sparql);
  
  for (const r of data) {
    const name = r.personLabel?.value;
    if (name) {
      results.set(name.toLowerCase(), {
        cityBorn: r.birthPlaceLabel?.value,
        countryBorn: normalizeCountry(r.birthCountryLabel?.value),
        cityDied: r.deathPlaceLabel?.value,
        countryDied: normalizeCountry(r.deathCountryLabel?.value),
        causeOfDeath: r.causeLabel?.value,
        deathDate: r.deathDate?.value?.substring(0, 10),
      });
    }
  }
  
  return results;
}

async function main() {
  console.log('='.repeat(60));
  console.log('UPDATE PERSON DATA FROM WIKIDATA');
  console.log('='.repeat(60));
  console.log(`Limit: ${LIMIT} | Month: ${MONTH_FILTER || 'all'}`);
  console.log('');
  
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB\n');
  
  const Person = mongoose.model('Person', PersonSchema);
  
  // Build query for people with missing data
  const query: any = {
    $or: [
      { cityBorn: { $in: [null, ''] } },
      { cityBorn: { $exists: false } },
    ]
  };
  
  // Month filter
  if (MONTH_FILTER) {
    const mm = MONTH_FILTER.padStart(2, '0');
    query.born = { $regex: `-${mm}-` };
  }
  
  const people = await Person.find(query).limit(LIMIT);
  console.log(`Found ${people.length} people with missing city data\n`);
  
  let updated = 0;
  let notFound = 0;
  
  // Process one by one (Wikidata rate limits batch queries)
  for (let i = 0; i < people.length; i++) {
    const person = people[i];
    const name = `${person.firstname} ${person.lastname}`.trim();
    const birthYear = person.born?.substring(0, 4) || '';
    
    process.stdout.write(`[${i + 1}/${people.length}] ${name.substring(0, 35).padEnd(35)} `);
    
    const data = await fetchPersonDataFromWikidata(name, person.born || '');
    
    if (data && (data.cityBorn || data.countryBorn || data.cityDied || data.causeOfDeath)) {
      const update: any = {};
      
      if (!person.cityBorn && data.cityBorn) update.cityBorn = data.cityBorn;
      if ((!person.countryBorn || person.countryBorn === 'Unknown') && data.countryBorn) update.countryBorn = data.countryBorn;
      if (!person.cityDied && data.cityDied) update.cityDied = data.cityDied;
      if (!person.countryDied && data.countryDied) update.countryDied = data.countryDied;
      if (!person.causeOfDeath && data.causeOfDeath) update.causeOfDeath = data.causeOfDeath;
      if (person.died && person.died.length < 10 && data.deathDate) update.died = data.deathDate;
      
      if (Object.keys(update).length > 0) {
        await Person.updateOne({ _id: person._id }, { $set: update });
        console.log(`✅ ${Object.keys(update).join(', ')}`);
        updated++;
      } else {
        console.log(`—`);
      }
    } else {
      console.log(`❌`);
      notFound++;
    }
    
    // Rate limit - Wikidata allows ~1 req/sec for anonymous
    await new Promise(r => setTimeout(r, 1100));
  }
  
  // Stats
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  console.log(`Updated: ${updated}`);
  console.log(`Not found: ${notFound}`);
  
  // Database stats
  const total = await Person.countDocuments();
  const missingCity = await Person.countDocuments({ $or: [{ cityBorn: null }, { cityBorn: '' }, { cityBorn: { $exists: false } }] });
  const missingCountry = await Person.countDocuments({ $or: [{ countryBorn: null }, { countryBorn: '' }, { countryBorn: { $exists: false } }] });
  
  console.log('\n--- DATABASE ---');
  console.log(`Total: ${total}`);
  console.log(`Missing city: ${missingCity}`);
  console.log(`Missing country: ${missingCountry}`);
  
  await mongoose.disconnect();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
