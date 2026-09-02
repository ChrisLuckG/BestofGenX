import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const COUNTRY_TO_CODE: Record<string, string> = {
  'usa': 'US', 'united states': 'US', 'america': 'US',
  'uk': 'GB', 'united kingdom': 'GB', 'england': 'GB', 'britain': 'GB',
  'germany': 'DE', 'france': 'FR', 'canada': 'CA', 'australia': 'AU',
  'italy': 'IT', 'spain': 'ES', 'japan': 'JP', 'brazil': 'BR',
  'mexico': 'MX', 'india': 'IN', 'china': 'CN', 'south korea': 'KR',
  'netherlands': 'NL', 'sweden': 'SE', 'norway': 'NO', 'denmark': 'DK',
  'ireland': 'IE', 'scotland': 'GB', 'wales': 'GB', 'austria': 'AT',
  'switzerland': 'CH', 'belgium': 'BE', 'portugal': 'PT', 'poland': 'PL',
  'russia': 'RU', 'ukraine': 'UA', 'greece': 'GR', 'turkey': 'TR',
  'south africa': 'ZA', 'argentina': 'AR', 'new zealand': 'NZ',
  'jamaica': 'JM', 'puerto rico': 'PR', 'philippines': 'PH',
};

function countryNameToCode(name?: string): string {
  if (!name) return '';
  return COUNTRY_TO_CODE[name.toLowerCase().trim()] || '';
}

async function main() {
  const dry = process.argv.includes('--dry');
  
  await mongoose.connect(process.env.MONGODB_URI || '');
  const articles = mongoose.connection.collection('articles');
  const persons = mongoose.connection.collection('persons');
  
  // Find articles that look like person articles (category birthday or rip, or have person-like titles)
  const personArticles = await articles.find({
    $or: [
      { category: 'birthday' },
      { category: 'rip' },
      { title: { $regex: /^[A-Z][a-z]+ [A-Z][a-z]+:/ } }, // "Firstname Lastname: ..."
    ],
    $and: [
      { $or: [
        { personCountryCode: { $exists: false } },
        { personCountryCode: '' },
        { personCountryCode: null },
      ]}
    ]
  }).sort({ createdAt: -1 }).limit(10).toArray();
  
  console.log(`Found ${personArticles.length} person articles without country\n`);
  
  let fixed = 0;
  
  for (const article of personArticles) {
    const title = article.title || '';
    
    // Extract name from title (usually "Firstname Lastname: ...")
    const match = title.match(/^([A-Z][a-zÀ-ž]+)\s+([A-Z][a-zÀ-ž]+(?:\s+[A-Z][a-zÀ-ž]+)?)/);
    if (!match) {
      console.log(`⚠️  Can't extract name from: ${title}`);
      continue;
    }
    
    const firstname = match[1];
    const lastname = match[2];
    
    // Search for person in Almanac
    const person = await persons.findOne({
      firstname: { $regex: new RegExp(`^${firstname}$`, 'i') },
      lastname: { $regex: new RegExp(`^${lastname}$`, 'i') },
    });
    
    if (!person) {
      console.log(`❌ No person found: ${firstname} ${lastname}`);
      continue;
    }
    
    const country = person.countryBorn || person.nationality || '';
    const countryCode = person.countryCode || countryNameToCode(country);
    
    if (!countryCode) {
      console.log(`⚠️  Person has no country: ${firstname} ${lastname}`);
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
            personName: `${person.firstname} ${person.lastname}`,
          } 
        }
      );
      fixed++;
    }
  }
  
  console.log(`\n${dry ? 'Would fix' : 'Fixed'}: ${fixed} articles`);
  
  await mongoose.disconnect();
}

main();
