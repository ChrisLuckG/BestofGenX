// Fix articles missing personCountry by looking up the person in the Almanac
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env.local') });

// Country name to ISO code mapping
const COUNTRY_TO_CODE: Record<string, string> = {
  'usa': 'US', 'united states': 'US', 'america': 'US',
  'uk': 'GB', 'united kingdom': 'GB', 'england': 'GB', 'britain': 'GB',
  'germany': 'DE', 'deutschland': 'DE',
  'france': 'FR', 'canada': 'CA', 'australia': 'AU',
  'italy': 'IT', 'spain': 'ES', 'japan': 'JP',
  'brazil': 'BR', 'mexico': 'MX', 'india': 'IN',
  'china': 'CN', 'south korea': 'KR', 'korea': 'KR',
  'netherlands': 'NL', 'sweden': 'SE', 'norway': 'NO',
  'denmark': 'DK', 'finland': 'FI', 'poland': 'PL',
  'russia': 'RU', 'ukraine': 'UA', 'ireland': 'IE',
  'scotland': 'GB', 'wales': 'GB', 'austria': 'AT',
  'switzerland': 'CH', 'belgium': 'BE', 'portugal': 'PT',
  'greece': 'GR', 'turkey': 'TR', 'israel': 'IL',
  'south africa': 'ZA', 'argentina': 'AR', 'chile': 'CL',
  'colombia': 'CO', 'peru': 'PE', 'venezuela': 'VE',
  'cuba': 'CU', 'jamaica': 'JM', 'puerto rico': 'PR',
  'philippines': 'PH', 'thailand': 'TH', 'vietnam': 'VN',
  'indonesia': 'ID', 'malaysia': 'MY', 'singapore': 'SG',
  'new zealand': 'NZ', 'czech republic': 'CZ', 'czechia': 'CZ',
  'hungary': 'HU', 'romania': 'RO', 'bulgaria': 'BG',
  'croatia': 'HR', 'serbia': 'RS', 'slovenia': 'SI',
  'slovakia': 'SK', 'lithuania': 'LT', 'latvia': 'LV',
  'estonia': 'EE', 'iceland': 'IS', 'luxembourg': 'LU',
  'malta': 'MT', 'cyprus': 'CY', 'egypt': 'EG',
  'morocco': 'MA', 'nigeria': 'NG', 'kenya': 'KE',
  'ghana': 'GH', 'ethiopia': 'ET', 'tanzania': 'TZ',
  'uganda': 'UG', 'zimbabwe': 'ZW', 'senegal': 'SN',
  'ivory coast': 'CI', 'cameroon': 'CM', 'algeria': 'DZ',
  'tunisia': 'TN', 'libya': 'LY', 'sudan': 'SD',
  'pakistan': 'PK', 'bangladesh': 'BD', 'sri lanka': 'LK',
  'nepal': 'NP', 'myanmar': 'MM', 'cambodia': 'KH',
  'laos': 'LA', 'mongolia': 'MN', 'kazakhstan': 'KZ',
  'uzbekistan': 'UZ', 'azerbaijan': 'AZ', 'georgia': 'GE',
  'armenia': 'AM', 'iran': 'IR', 'iraq': 'IQ',
  'saudi arabia': 'SA', 'uae': 'AE', 'united arab emirates': 'AE',
  'qatar': 'QA', 'kuwait': 'KW', 'bahrain': 'BH',
  'oman': 'OM', 'jordan': 'JO', 'lebanon': 'LB',
  'syria': 'SY', 'yemen': 'YE', 'afghanistan': 'AF',
  'taiwan': 'TW', 'hong kong': 'HK', 'macau': 'MO',
};

function countryNameToCode(name?: string | null): string {
  if (!name) return '';
  const key = name.trim().replace(/[.,;:!?]+$/, '').toLowerCase();
  return COUNTRY_TO_CODE[key] || '';
}

async function main() {
  const dry = process.argv.includes('--dry');
  
  await mongoose.connect(process.env.MONGODB_URI || '');
  const articles = mongoose.connection.collection('articles');
  const persons = mongoose.connection.collection('persons');
  
  // Find recent articles missing country data
  const recentArticles = await articles.find({
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
  }).sort({ createdAt: -1 }).limit(20).toArray();
  
  console.log(`Found ${recentArticles.length} recent articles to check\n`);
  
  let fixed = 0;
  
  for (const article of recentArticles) {
    // Skip if already has country
    if (article.personCountryCode) continue;
    
    // Try to find person by name in title
    const title = article.title || '';
    
    // Look for person in Almanac by matching name parts
    const words = title.split(/[:\-–—,]/).map((s: string) => s.trim()).filter(Boolean);
    const potentialName = words[0]; // Usually "Firstname Lastname: ..."
    
    if (!potentialName) continue;
    
    const nameParts = potentialName.split(/\s+/);
    if (nameParts.length < 2) continue;
    
    const firstname = nameParts[0];
    const lastname = nameParts.slice(1).join(' ');
    
    // Search for person
    const person = await persons.findOne({
      firstname: { $regex: new RegExp(`^${firstname}$`, 'i') },
      lastname: { $regex: new RegExp(`^${lastname}$`, 'i') },
    });
    
    if (!person) {
      console.log(`❌ No person found for: "${potentialName}" (from: ${title})`);
      continue;
    }
    
    const country = person.countryBorn || person.nationality || '';
    const countryCode = person.countryCode || countryNameToCode(country);
    
    if (!country && !countryCode) {
      console.log(`⚠️  Person found but no country: ${firstname} ${lastname}`);
      continue;
    }
    
    console.log(`✅ ${firstname} ${lastname} → ${country} (${countryCode})`);
    console.log(`   Article: ${title}`);
    
    if (!dry) {
      await articles.updateOne(
        { _id: article._id },
        { 
          $set: { 
            personCountry: country,
            personCountryCode: countryCode,
            personName: `${firstname} ${lastname}`,
          } 
        }
      );
      fixed++;
    }
  }
  
  console.log(`\n${dry ? 'Would fix' : 'Fixed'}: ${fixed} articles`);
  
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
