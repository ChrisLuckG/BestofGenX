/**
 * Import ALL GenX birthdays from Wikipedia for every day of the year.
 * 
 * This script fetches birthdays from Wikipedia's "On This Day" API for all 366 days
 * and imports GenX people (born 1965-1980) into the Person collection.
 * 
 * Run with: npx ts-node scripts/import-all-genx-birthdays.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI!;

// Person schema
const PersonSchema = new mongoose.Schema({
  firstname: { type: String, required: true, index: true },
  lastname: { type: String, required: true, index: true },
  born: { type: String, index: true },
  died: String,
  causeOfDeath: String,
  profession: { type: String, required: true },
  subcat: String,
  category: String,
  knownfor: String,
  description: String,
  shortBio: String,
  countryBorn: String,
  cityBorn: String,
  countryDied: String,
  nationality: String,
  countryCode: String,
  parents: String,
  siblings: Number,
  image: String,
  wikiUrl: String,
  social: {
    twitter: String,
    instagram: String,
    youtube: String,
    linkedin: String,
    tiktok: String,
    facebook: String,
    website: String,
  },
  isGenX: { type: Boolean, default: true },
  birthYear: Number,
  hasArticle: { type: Boolean, default: false },
  articleId: mongoose.Schema.Types.ObjectId,
  articleCreatedAt: Date,
  articleCreatedBy: String,
  discoveredBy: String,
  discoveredByName: String,
  discoveredFor: String,
  discoveredAt: Date,
  isVerified: { type: Boolean, default: false },
  isRejected: { type: Boolean, default: false },
  rejectionReason: String,
}, { timestamps: true });

PersonSchema.index({ firstname: 1, lastname: 1 }, { unique: true });

// Nationality to country mapping
const nationalityToCountry: Record<string, string> = {
  'american': 'USA', 'canadian': 'Canada', 'british': 'UK', 'english': 'UK', 
  'scottish': 'UK', 'welsh': 'UK', 'irish': 'Ireland', 'german': 'Germany',
  'french': 'France', 'italian': 'Italy', 'spanish': 'Spain', 'australian': 'Australia',
  'japanese': 'Japan', 'chinese': 'China', 'korean': 'South Korea', 'indian': 'India',
  'brazilian': 'Brazil', 'mexican': 'Mexico', 'polish': 'Poland', 'russian': 'Russia',
  'dutch': 'Netherlands', 'swedish': 'Sweden', 'norwegian': 'Norway', 'danish': 'Denmark',
  'finnish': 'Finland', 'austrian': 'Austria', 'swiss': 'Switzerland', 'belgian': 'Belgium',
  'greek': 'Greece', 'turkish': 'Turkey', 'egyptian': 'Egypt', 'south african': 'South Africa',
  'singaporean': 'Singapore', 'libyan': 'Libya', 'latvian': 'Latvia', 'hungarian': 'Hungary',
  'czech': 'Czech Republic', 'romanian': 'Romania', 'ukrainian': 'Ukraine', 'portuguese': 'Portugal',
  'argentine': 'Argentina', 'chilean': 'Chile', 'colombian': 'Colombia', 'venezuelan': 'Venezuela',
  'peruvian': 'Peru', 'cuban': 'Cuba', 'puerto rican': 'Puerto Rico', 'dominican': 'Dominican Republic',
  'jamaican': 'Jamaica', 'trinidadian': 'Trinidad', 'new zealand': 'New Zealand',
  'filipino': 'Philippines', 'thai': 'Thailand', 'vietnamese': 'Vietnam',
  'indonesian': 'Indonesia', 'malaysian': 'Malaysia', 'israeli': 'Israel',
  'nigerian': 'Nigeria', 'kenyan': 'Kenya', 'ghanaian': 'Ghana', 'moroccan': 'Morocco',
  'algerian': 'Algeria', 'tunisian': 'Tunisia', 'croatian': 'Croatia', 'serbian': 'Serbia',
  'slovenian': 'Slovenia', 'slovakian': 'Slovakia', 'bulgarian': 'Bulgaria', 'estonian': 'Estonia',
  'lithuanian': 'Lithuania', 'icelandic': 'Iceland', 'luxembourgish': 'Luxembourg',
  'maltese': 'Malta', 'cypriot': 'Cyprus', 'taiwanese': 'Taiwan', 'hong kong': 'Hong Kong',
  'pakistani': 'Pakistan', 'bangladeshi': 'Bangladesh', 'sri lankan': 'Sri Lanka',
  'nepalese': 'Nepal', 'burmese': 'Myanmar', 'cambodian': 'Cambodia', 'laotian': 'Laos',
};

// Country codes
const countryCodes: Record<string, string> = {
  'USA': 'US', 'Canada': 'CA', 'UK': 'GB', 'Ireland': 'IE', 'Germany': 'DE',
  'France': 'FR', 'Italy': 'IT', 'Spain': 'ES', 'Australia': 'AU', 'Japan': 'JP',
  'China': 'CN', 'South Korea': 'KR', 'India': 'IN', 'Brazil': 'BR', 'Mexico': 'MX',
  'Poland': 'PL', 'Russia': 'RU', 'Netherlands': 'NL', 'Sweden': 'SE', 'Norway': 'NO',
  'Denmark': 'DK', 'Finland': 'FI', 'Austria': 'AT', 'Switzerland': 'CH', 'Belgium': 'BE',
  'Greece': 'GR', 'Turkey': 'TR', 'Egypt': 'EG', 'South Africa': 'ZA', 'Singapore': 'SG',
  'Israel': 'IL', 'Nigeria': 'NG', 'Kenya': 'KE', 'Ghana': 'GH', 'Morocco': 'MA',
  'Croatia': 'HR', 'Serbia': 'RS', 'Slovenia': 'SI', 'Slovakia': 'SK', 'Bulgaria': 'BG',
  'Estonia': 'EE', 'Lithuania': 'LT', 'Latvia': 'LV', 'Iceland': 'IS', 'Luxembourg': 'LU',
  'Taiwan': 'TW', 'Hong Kong': 'HK', 'Pakistan': 'PK', 'Bangladesh': 'BD', 'Sri Lanka': 'LK',
  'Czech Republic': 'CZ', 'Romania': 'RO', 'Ukraine': 'UA', 'Portugal': 'PT',
  'Argentina': 'AR', 'Chile': 'CL', 'Colombia': 'CO', 'Venezuela': 'VE', 'Peru': 'PE',
  'Cuba': 'CU', 'Puerto Rico': 'PR', 'Dominican Republic': 'DO', 'Jamaica': 'JM',
  'Trinidad': 'TT', 'New Zealand': 'NZ', 'Philippines': 'PH', 'Thailand': 'TH',
  'Vietnam': 'VN', 'Indonesia': 'ID', 'Malaysia': 'MY', 'Hungary': 'HU',
};

// Category patterns
const categoryPatterns: Record<string, RegExp> = {
  'sports': /\b(football|basketball|baseball|hockey|soccer|tennis|golf|boxer|wrestler|athlete|swimmer|cyclist|racer|player|coach|gymnast|skier|snowboarder|surfer|skater|martial artist|MMA|UFC|cricketer|rugby|volleyball|badminton|table tennis|fencer|archer|shooter|weightlifter|triathlete|decathlete|sprinter|marathon|javelin|discus|shot put|pole vault|high jump|long jump|hurdles|relay|rowing|sailing|kayak|canoe|equestrian|jockey|racing driver|Formula|NASCAR|IndyCar|rally|motocross|BMX|skateboard|snowboard|figure skating|ice hockey|curling|bobsled|luge|skeleton|biathlon|cross-country|alpine|freestyle|moguls|halfpipe|slopestyle|big air)\b/i,
  'music': /\b(singer|musician|rapper|DJ|guitarist|drummer|bassist|songwriter|composer|band|pianist|violinist|cellist|conductor|producer|vocalist|frontman|lead singer|backing vocalist|keyboardist|saxophonist|trumpeter|trombonist|flutist|clarinetist|oboist|harpist|percussionist|beatboxer|MC|hip hop|R&B|rock|pop|country|jazz|blues|soul|funk|disco|electronic|techno|house|trance|dubstep|reggae|ska|punk|metal|grunge|alternative|indie|folk|classical|opera|musical theatre)\b/i,
  'movies-tv': /\b(actor|actress|director|producer|screenwriter|filmmaker|television|TV|comedian|host|presenter|model|voice actor|stunt|cinematographer|editor|costume designer|makeup artist|set designer|casting director|showrunner|talk show|game show|reality TV|soap opera|sitcom|drama series|miniseries|documentary|animation|anime|Bollywood|Hollywood|Broadway|West End|stand-up|improv|sketch comedy|late night|morning show|news anchor|weatherman|sportscaster|VJ|MTV)\b/i,
  'politics': /\b(politician|senator|governor|president|minister|mayor|diplomat|activist|political|congressman|congresswoman|representative|secretary|chancellor|prime minister|premier|ambassador|consul|attaché|lobbyist|campaign|election|parliament|congress|senate|house of representatives|cabinet|administration|government|opposition|party leader|whip|speaker|chairman|chairwoman|commissioner|councillor|alderman|selectman|supervisor|judge|justice|attorney general|solicitor general|prosecutor|public defender)\b/i,
  'gaming': /\b(game designer|video game|esports|streamer|Twitch|YouTube gaming|speedrunner|pro gamer|competitive gaming|game developer|game programmer|level designer|game artist|game writer|game producer|game director|game tester|QA|quality assurance)\b/i,
  'authors': /\b(author|writer|novelist|poet|journalist|blogger|columnist|editor|publisher|literary|fiction|non-fiction|biography|autobiography|memoir|essay|short story|screenplay|playwright|dramatist|librettist|lyricist|critic|reviewer|correspondent|reporter|anchor|commentator|analyst|pundit|opinion|editorial)\b/i,
  'tech': /\b(programmer|software|developer|engineer|entrepreneur|founder|CEO|CTO|CFO|COO|startup|venture|investor|inventor|scientist|researcher|professor|academic|physicist|chemist|biologist|mathematician|computer scientist|data scientist|AI|machine learning|blockchain|crypto|cybersecurity|hacker|coder|web developer|app developer|game developer|systems architect|DevOps|cloud|infrastructure)\b/i,
};

// Map category to profession enum
const categoryToProfession: Record<string, string> = {
  'music': 'Music',
  'sports': 'Sport',
  'movies-tv': 'Actor',
  'politics': 'Politik',
  'gaming': 'Tech',
  'culture': 'Art',
  'authors': 'Art',
  'tech': 'Tech',
  'unknown': 'Other',
};

function parseCategory(text: string): string {
  for (const [cat, pattern] of Object.entries(categoryPatterns)) {
    if (pattern.test(text)) return cat;
  }
  return 'culture';
}

function parseCountry(text: string): { country: string; countryCode: string } {
  const match = text.match(/\b(American|Canadian|British|English|Scottish|Welsh|Irish|German|French|Italian|Spanish|Australian|Japanese|Chinese|Korean|Indian|Brazilian|Mexican|Polish|Russian|Dutch|Swedish|Norwegian|Danish|Finnish|Austrian|Swiss|Belgian|Greek|Turkish|Egyptian|South African|Singaporean|Israeli|Nigerian|Kenyan|Ghanaian|Moroccan|Croatian|Serbian|Slovenian|Slovakian|Bulgarian|Estonian|Lithuanian|Latvian|Icelandic|Taiwanese|Pakistani|Bangladeshi|Sri Lankan|Czech|Romanian|Ukrainian|Portuguese|Argentine|Chilean|Colombian|Venezuelan|Peruvian|Cuban|Puerto Rican|Dominican|Jamaican|Trinidadian|New Zealand|Filipino|Thai|Vietnamese|Indonesian|Malaysian|Hungarian)\b/i);
  
  if (match) {
    const nationality = match[1].toLowerCase();
    const country = nationalityToCountry[nationality] || 'Unknown';
    return { country, countryCode: countryCodes[country] || '' };
  }
  return { country: 'Unknown', countryCode: '' };
}

async function fetchBirthdaysForDay(month: number, day: number): Promise<any[]> {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/feed/onthisday/births/${mm}/${dd}`,
      { headers: { 'User-Agent': 'BOGX-Import/1.0 (https://bestofgenx.com)' } }
    );
    
    if (!res.ok) {
      console.log(`  [${mm}/${dd}] Wikipedia API returned ${res.status}`);
      return [];
    }
    
    const data = await res.json();
    return (data.births || []).filter((b: any) => b.year >= 1965 && b.year <= 1980);
  } catch (err) {
    console.log(`  [${mm}/${dd}] Error fetching: ${err}`);
    return [];
  }
}

async function importDay(Person: any, month: number, day: number): Promise<{ imported: number; skipped: number }> {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  
  const births = await fetchBirthdaysForDay(month, day);
  
  let imported = 0;
  let skipped = 0;
  
  for (const birth of births) {
    try {
      const text = birth.text || '';
      const year = birth.year;
      const pages = birth.pages || [];
      const wikiPage = pages[0];
      
      // Parse name
      const fullName = text.split(',')[0].trim();
      if (!fullName || fullName.length < 2) continue;
      
      // Split name
      const nameParts = fullName.split(' ');
      const firstname = nameParts[0] || '';
      const lastname = nameParts.slice(1).join(' ') || '';
      
      if (!firstname || !lastname) {
        skipped++;
        continue;
      }
      
      // Parse metadata
      const { country, countryCode } = parseCountry(text);
      const category = parseCategory(text);
      const profession = categoryToProfession[category] || 'Other';
      
      // Get profession from text
      const professionMatch = text.match(/,\s*([^,]+)/);
      const subcat = professionMatch ? professionMatch[1].trim() : '';
      
      // Format date
      const born = `${year}-${mm}-${dd}`;
      
      // Get image and wiki URL
      const image = wikiPage?.thumbnail?.source || null;
      const wikiUrl = wikiPage?.content_urls?.desktop?.page || null;
      
      // Upsert
      await Person.findOneAndUpdate(
        { 
          firstname: { $regex: new RegExp(`^${firstname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          lastname: { $regex: new RegExp(`^${lastname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        },
        {
          $setOnInsert: {
            firstname,
            lastname,
            born,
            birthYear: year,
            countryBorn: country,
            countryCode,
            category,
            profession,
            subcat,
            knownfor: text,
            description: text,
            image,
            wikiUrl,
            isGenX: true,
            discoveredBy: 'system',
            discoveredByName: 'Wikipedia Bulk Import',
            discoveredFor: 'birthday',
            discoveredAt: new Date(),
            isVerified: true,
            hasArticle: false,
          }
        },
        { upsert: true }
      );
      
      imported++;
    } catch (err: any) {
      if (err.code !== 11000) {
        // Not a duplicate error
        skipped++;
      }
    }
  }
  
  return { imported, skipped };
}

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!\n');
  
  const Person = mongoose.model('Person', PersonSchema);
  
  const countBefore = await Person.countDocuments();
  console.log(`Person collection before: ${countBefore} entries\n`);
  
  let totalImported = 0;
  let totalSkipped = 0;
  let totalGenX = 0;
  
  // Days in each month (including leap year Feb 29)
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  
  for (let month = 1; month <= 12; month++) {
    const monthName = new Date(2000, month - 1, 1).toLocaleString('en', { month: 'long' });
    console.log(`\n📅 ${monthName}:`);
    
    for (let day = 1; day <= daysInMonth[month - 1]; day++) {
      const { imported, skipped } = await importDay(Person, month, day);
      totalImported += imported;
      totalSkipped += skipped;
      totalGenX += imported + skipped;
      
      process.stdout.write(`  Day ${day}: +${imported} `);
      
      // Rate limit: 1 request per second to be nice to Wikipedia
      await new Promise(r => setTimeout(r, 1000));
    }
    console.log();
  }
  
  const countAfter = await Person.countDocuments();
  
  console.log('\n========================================');
  console.log('IMPORT COMPLETE');
  console.log('========================================');
  console.log(`Total GenX birthdays found: ${totalGenX}`);
  console.log(`New entries imported: ${totalImported}`);
  console.log(`Skipped (duplicates/errors): ${totalSkipped}`);
  console.log(`Person collection before: ${countBefore}`);
  console.log(`Person collection after: ${countAfter}`);
  console.log(`Net increase: ${countAfter - countBefore}`);
  
  await mongoose.disconnect();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
