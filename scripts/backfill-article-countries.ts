/**
 * Backfill script: Add country data to existing articles
 * Uses GPT to extract country from article title/content
 * 
 * Run with: npx ts-node scripts/backfill-article-countries.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Country code mapping
const countryToCode: Record<string, string> = {
  'United States': 'US', 'USA': 'US', 'America': 'US', 'American': 'US',
  'United Kingdom': 'GB', 'UK': 'GB', 'England': 'GB', 'Britain': 'GB', 'British': 'GB', 'English': 'GB', 'Scottish': 'GB', 'Welsh': 'GB',
  'Germany': 'DE', 'Deutschland': 'DE', 'German': 'DE',
  'France': 'FR', 'Frankreich': 'FR', 'French': 'FR',
  'Italy': 'IT', 'Italien': 'IT', 'Italian': 'IT',
  'Spain': 'ES', 'Spanien': 'ES', 'Spanish': 'ES',
  'Canada': 'CA', 'Kanada': 'CA', 'Canadian': 'CA',
  'Australia': 'AU', 'Australien': 'AU', 'Australian': 'AU',
  'Japan': 'JP', 'Japanese': 'JP',
  'China': 'CN', 'Chinese': 'CN',
  'South Korea': 'KR', 'Korea': 'KR', 'Korean': 'KR',
  'Brazil': 'BR', 'Brasilien': 'BR', 'Brazilian': 'BR',
  'Mexico': 'MX', 'Mexiko': 'MX', 'Mexican': 'MX',
  'Argentina': 'AR', 'Argentinien': 'AR', 'Argentine': 'AR', 'Argentinian': 'AR',
  'Netherlands': 'NL', 'Holland': 'NL', 'Dutch': 'NL',
  'Belgium': 'BE', 'Belgien': 'BE', 'Belgian': 'BE',
  'Sweden': 'SE', 'Schweden': 'SE', 'Swedish': 'SE',
  'Norway': 'NO', 'Norwegen': 'NO', 'Norwegian': 'NO',
  'Denmark': 'DK', 'Dänemark': 'DK', 'Danish': 'DK',
  'Finland': 'FI', 'Finnland': 'FI', 'Finnish': 'FI',
  'Poland': 'PL', 'Polen': 'PL', 'Polish': 'PL',
  'Russia': 'RU', 'Russland': 'RU', 'Russian': 'RU',
  'Austria': 'AT', 'Österreich': 'AT', 'Austrian': 'AT',
  'Switzerland': 'CH', 'Schweiz': 'CH', 'Swiss': 'CH',
  'Ireland': 'IE', 'Irland': 'IE', 'Irish': 'IE',
  'Scotland': 'GB',
  'Wales': 'GB',
  'Portugal': 'PT', 'Portuguese': 'PT',
  'Greece': 'GR', 'Griechenland': 'GR', 'Greek': 'GR',
  'Turkey': 'TR', 'Türkei': 'TR', 'Turkish': 'TR',
  'India': 'IN', 'Indien': 'IN', 'Indian': 'IN',
  'South Africa': 'ZA', 'Südafrika': 'ZA', 'South African': 'ZA',
  'New Zealand': 'NZ', 'Neuseeland': 'NZ',
  'Jamaica': 'JM', 'Jamaika': 'JM', 'Jamaican': 'JM',
  'Cuba': 'CU', 'Kuba': 'CU', 'Cuban': 'CU',
  'Puerto Rico': 'PR', 'Puerto Rican': 'PR',
  'Nigeria': 'NG', 'Nigerian': 'NG',
  'Ghana': 'GH', 'Ghanaian': 'GH',
  'Kenya': 'KE', 'Kenyan': 'KE',
  'Egypt': 'EG', 'Egyptian': 'EG',
  'Morocco': 'MA', 'Moroccan': 'MA',
  'Israel': 'IL', 'Israeli': 'IL',
  'Iran': 'IR', 'Iranian': 'IR',
  'Iraq': 'IQ', 'Iraqi': 'IQ',
  'Saudi Arabia': 'SA', 'Saudi': 'SA',
  'Colombia': 'CO', 'Colombian': 'CO',
  'Chile': 'CL', 'Chilean': 'CL',
  'Peru': 'PE', 'Peruvian': 'PE',
  'Venezuela': 'VE', 'Venezuelan': 'VE',
  'Philippines': 'PH', 'Filipino': 'PH',
  'Indonesia': 'ID', 'Indonesian': 'ID',
  'Thailand': 'TH', 'Thai': 'TH',
  'Vietnam': 'VN', 'Vietnamese': 'VN',
  'Malaysia': 'MY', 'Malaysian': 'MY',
  'Singapore': 'SG', 'Singaporean': 'SG',
  'Hong Kong': 'HK',
  'Taiwan': 'TW', 'Taiwanese': 'TW',
  'Czech Republic': 'CZ', 'Czech': 'CZ',
  'Hungary': 'HU', 'Hungarian': 'HU',
  'Romania': 'RO', 'Romanian': 'RO',
  'Ukraine': 'UA', 'Ukrainian': 'UA',
  'Croatia': 'HR', 'Croatian': 'HR',
  'Serbia': 'RS', 'Serbian': 'RS',
  'Iceland': 'IS', 'Icelandic': 'IS',
};

function getCountryCode(country: string): string {
  // Direct match
  if (countryToCode[country]) return countryToCode[country];
  
  // Case-insensitive match
  const lower = country.toLowerCase();
  for (const [key, code] of Object.entries(countryToCode)) {
    if (key.toLowerCase() === lower) return code;
  }
  
  return '';
}

async function extractCountryFromArticle(title: string, content: string): Promise<{ country: string; code: string } | null> {
  try {
    // Strip HTML from content
    const plainContent = content.replace(/<[^>]*>/g, ' ').substring(0, 2000);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You extract the country of origin of the main person in an article. 
Reply with ONLY the country name (e.g., "United States", "Brazil", "Sweden").
If the article is not about a specific person, or you cannot determine their country, reply with "UNKNOWN".
Do NOT guess - only reply if you are confident.`
        },
        {
          role: 'user',
          content: `Title: ${title}\n\nContent excerpt: ${plainContent}`
        }
      ],
      max_tokens: 20,
      temperature: 0,
    });
    
    const country = response.choices[0]?.message?.content?.trim() || '';
    
    if (country === 'UNKNOWN' || country.length > 30) {
      return null;
    }
    
    const code = getCountryCode(country);
    if (!code) {
      console.log(`  ⚠️ No code for country: "${country}"`);
      return null;
    }
    
    return { country, code };
  } catch (err) {
    console.error('  ❌ GPT error:', err);
    return null;
  }
}

async function main() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected!\n');
  
  const Article = mongoose.connection.collection('articles');
  
  // Find articles without country data
  const articles = await Article.find({
    $or: [
      { personCountryCode: { $exists: false } },
      { personCountryCode: null },
      { personCountryCode: '' },
    ],
    status: 'published',
  }).toArray();
  
  console.log(`📝 Found ${articles.length} articles without country data\n`);
  
  let updated = 0;
  let skipped = 0;
  
  for (const article of articles) {
    console.log(`Processing: "${article.title}"`);
    
    const result = await extractCountryFromArticle(article.title, article.content || '');
    
    if (result) {
      await Article.updateOne(
        { _id: article._id },
        { $set: { personCountry: result.country, personCountryCode: result.code } }
      );
      console.log(`  ✅ Set: ${result.country} (${result.code})`);
      updated++;
    } else {
      console.log(`  ⏭️ Skipped (no country found)`);
      skipped++;
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`\n🎉 Done! Updated: ${updated}, Skipped: ${skipped}`);
  
  await mongoose.disconnect();
}

main().catch(console.error);
