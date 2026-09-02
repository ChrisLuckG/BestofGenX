import mongoose from 'mongoose';
import { Person } from '../src/models/Almanac';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

// Countries we want more of (with Wikidata Q-codes)
const COUNTRIES = [
  { name: 'Northern Ireland', qcode: 'Q26', target: 'Northern Ireland' },
  { name: 'Scotland', qcode: 'Q22', target: 'Scotland' },
  { name: 'Wales', qcode: 'Q25', target: 'Wales' },
  { name: 'Ireland', qcode: 'Q27', target: 'Ireland' },
  { name: 'New Zealand', qcode: 'Q664', target: 'New Zealand' },
  { name: 'South Africa', qcode: 'Q258', target: 'South Africa' },
  { name: 'Belgium', qcode: 'Q31', target: 'Belgium' },
  { name: 'Austria', qcode: 'Q40', target: 'Austria' },
  { name: 'Switzerland', qcode: 'Q39', target: 'Switzerland' },
  { name: 'Denmark', qcode: 'Q35', target: 'Denmark' },
  { name: 'Finland', qcode: 'Q33', target: 'Finland' },
  { name: 'Norway', qcode: 'Q20', target: 'Norway' },
  { name: 'Portugal', qcode: 'Q45', target: 'Portugal' },
  { name: 'Greece', qcode: 'Q41', target: 'Greece' },
  { name: 'Poland', qcode: 'Q36', target: 'Poland' },
  { name: 'Czech Republic', qcode: 'Q213', target: 'Czechia' },
  { name: 'Hungary', qcode: 'Q28', target: 'Hungary' },
  { name: 'Argentina', qcode: 'Q414', target: 'Argentina' },
  { name: 'Chile', qcode: 'Q298', target: 'Chile' },
  { name: 'Colombia', qcode: 'Q739', target: 'Colombia' },
  { name: 'South Korea', qcode: 'Q884', target: 'South Korea' },
  { name: 'Nigeria', qcode: 'Q1033', target: 'Nigeria' },
  { name: 'Kenya', qcode: 'Q114', target: 'Kenya' },
  { name: 'Jamaica', qcode: 'Q766', target: 'Jamaica' },
];

async function fetchPeopleFromCountry(qcode: string, countryName: string): Promise<any[]> {
  const sparql = `
    SELECT DISTINCT ?person ?personLabel ?birthDate ?deathDate ?birthPlaceLabel ?occupationLabel WHERE {
      VALUES ?year { 1965 1966 1967 1968 1969 1970 1971 1972 1973 1974 1975 1976 1977 1978 1979 1980 }
      
      ?person wdt:P31 wd:Q5 .
      ?person wdt:P27 wd:${qcode} .
      ?person wdt:P569 ?birthDate .
      ?person wdt:P106 ?occupation .
      
      FILTER(YEAR(?birthDate) = ?year)
      
      OPTIONAL { ?person wdt:P570 ?deathDate . }
      OPTIONAL { ?person wdt:P19 ?birthPlace . }
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 500
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
    
    if (!res.ok) return [];
    
    const data = await res.json();
    return data.results?.bindings || [];
  } catch (e) {
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

function mapProfession(occupation: string): string {
  if (!occupation) return 'Other';
  const occ = occupation.toLowerCase();
  if (occ.includes('singer') || occ.includes('musician') || occ.includes('rapper') || occ.includes('composer')) return 'Music';
  if (occ.includes('actor') || occ.includes('actress') || occ.includes('director')) return 'Actor';
  if (occ.includes('football') || occ.includes('basketball') || occ.includes('tennis') || occ.includes('athlete') || occ.includes('rugby') || occ.includes('cricket') || occ.includes('hurling') || occ.includes('gaelic')) return 'Sport';
  if (occ.includes('politician')) return 'Politik';
  if (occ.includes('writer') || occ.includes('author') || occ.includes('journalist') || occ.includes('poet')) return 'Art';
  if (occ.includes('comedian')) return 'Comedy';
  if (occ.includes('model')) return 'Model';
  return 'Other';
}

async function main() {
  const dry = process.argv.includes('--dry');
  
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  console.log('=== Importing GenX from Underrepresented Countries ===\n');
  
  let totalAdded = 0;
  
  for (const country of COUNTRIES) {
    process.stdout.write(`🌍 ${country.name}... `);
    
    const results = await fetchPeopleFromCountry(country.qcode, country.name);
    console.log(`${results.length} found`);
    
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
      
      if (existing) continue;
      
      const born = formatDate(r.birthDate?.value);
      const died = formatDate(r.deathDate?.value);
      const cityBorn = r.birthPlaceLabel?.value || '';
      const profession = mapProfession(r.occupationLabel?.value || '');
      
      if (!dry) {
        try {
          await Person.create({
            firstname,
            lastname,
            born,
            died: died || undefined,
            profession,
            countryBorn: country.target,
            cityBorn,
            isGenX: true,
          });
          added++;
          totalAdded++;
        } catch (e) {}
      } else {
        added++;
        totalAdded++;
      }
    }
    
    console.log(`   Added: ${added}`);
    
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log(`\n=== Total ${dry ? 'would add' : 'added'}: ${totalAdded} ===`);
  
  if (!dry) {
    console.log('\nUpdated country counts:');
    for (const country of COUNTRIES) {
      const count = await Person.countDocuments({ countryBorn: country.target });
      console.log(`  ${country.target}: ${count}`);
    }
  }
  
  await mongoose.disconnect();
}

main();
