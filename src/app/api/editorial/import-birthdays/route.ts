import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Menschen from '@/models/Menschen';

// Fetch image from Wikipedia for a person
async function fetchWikiImage(name: string): Promise<string | null> {
  try {
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
    const res = await fetch(searchUrl, { headers: { 'User-Agent': 'BOGX/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.thumbnail?.source || data.originalimage?.source || null;
  } catch {
    return null;
  }
}

// Import GenX birthdays from Wikipedia into our Menschen database
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { month, day } = await request.json();
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    
    // Fetch from Wikipedia
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/feed/onthisday/births/${mm}/${dd}`,
      { headers: { 'User-Agent': 'BOGX-Editorial/1.0' } }
    );
    
    if (!res.ok) {
      return NextResponse.json({ success: false, error: 'Wikipedia API failed' }, { status: 500 });
    }
    
    const data = await res.json();
    
    // Filter for GenX (1965-1980)
    const genxBirths = (data.births || []).filter((b: any) => b.year >= 1965 && b.year <= 1980);
    
    let imported = 0;
    let skipped = 0;
    let errors: string[] = [];
    
    for (const birth of genxBirths) {
      try {
        const text = birth.text || '';
        const year = birth.year;
        const pages = birth.pages || [];
        const wikiPage = pages[0];
        
        // Parse name (first part before comma)
        const fullName = text.split(',')[0].trim();
        if (!fullName) continue;
        
        // Split into first/last name
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        // Parse country from description
        const countryMatch = text.match(/\b(American|Canadian|British|English|Scottish|Welsh|Irish|German|French|Italian|Spanish|Australian|Japanese|Chinese|Korean|Indian|Brazilian|Mexican|Polish|Russian|Dutch|Swedish|Norwegian|Danish|Finnish|Austrian|Swiss|Belgian|Greek|Turkish|Egyptian|South African|Singaporean|Libyan|Latvian|Hungarian|Czech|Romanian|Ukrainian|Portuguese|Argentine|Chilean|Colombian|Venezuelan|Peruvian|Cuban|Puerto Rican|Dominican|Jamaican|Trinidadian|New Zealand|Filipino|Thai|Vietnamese|Indonesian|Malaysian)\b/i);
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
          'indonesian': 'Indonesia', 'malaysian': 'Malaysia',
        };
        const nationality = countryMatch ? countryMatch[1].toLowerCase() : 'unknown';
        const country = nationalityToCountry[nationality] || 'Unknown';
        
        // Country codes
        const countryCodes: Record<string, string> = {
          'USA': 'US', 'Canada': 'CA', 'UK': 'GB', 'Ireland': 'IE', 'Germany': 'DE',
          'France': 'FR', 'Italy': 'IT', 'Spain': 'ES', 'Australia': 'AU', 'Japan': 'JP',
          'China': 'CN', 'South Korea': 'KR', 'India': 'IN', 'Brazil': 'BR', 'Mexico': 'MX',
          'Poland': 'PL', 'Russia': 'RU', 'Netherlands': 'NL', 'Sweden': 'SE', 'Norway': 'NO',
          'Denmark': 'DK', 'Finland': 'FI', 'Austria': 'AT', 'Switzerland': 'CH', 'Belgium': 'BE',
          'Greece': 'GR', 'Turkey': 'TR', 'Egypt': 'EG', 'South Africa': 'ZA', 'Singapore': 'SG',
          'Libya': 'LY', 'Latvia': 'LV', 'Hungary': 'HU', 'Czech Republic': 'CZ', 'Romania': 'RO',
          'Ukraine': 'UA', 'Portugal': 'PT', 'Argentina': 'AR', 'Chile': 'CL', 'Colombia': 'CO',
          'Venezuela': 'VE', 'Peru': 'PE', 'Cuba': 'CU', 'Puerto Rico': 'PR', 'Dominican Republic': 'DO',
          'Jamaica': 'JM', 'Trinidad': 'TT', 'New Zealand': 'NZ', 'Philippines': 'PH',
          'Thailand': 'TH', 'Vietnam': 'VN', 'Indonesia': 'ID', 'Malaysia': 'MY',
        };
        
        // Parse profession from description (text after name)
        const professionMatch = text.match(/,\s*([^,]+(?:and[^,]+)?)/);
        const profession = professionMatch ? professionMatch[1].trim() : '';
        
        // Parse category from description
        const categoryPatterns: Record<string, RegExp> = {
          'sports': /\b(football|basketball|baseball|hockey|soccer|tennis|golf|boxer|wrestler|athlete|swimmer|cyclist|racer|player|coach|gymnast|skier|snowboarder|surfer|skater|martial artist|MMA|UFC)\b/i,
          'music': /\b(singer|musician|rapper|DJ|guitarist|drummer|bassist|songwriter|composer|band|pianist|violinist|cellist|conductor|producer)\b/i,
          'movies-tv': /\b(actor|actress|director|producer|screenwriter|filmmaker|television|TV|comedian|host|presenter|model)\b/i,
          'politics': /\b(politician|senator|governor|president|minister|mayor|diplomat|activist)\b/i,
          'gaming': /\b(game designer|video game|esports|streamer)\b/i,
          'authors': /\b(author|writer|novelist|poet|journalist|blogger)\b/i,
        };
        
        let category = 'culture';
        for (const [cat, pattern] of Object.entries(categoryPatterns)) {
          if (pattern.test(text)) {
            category = cat;
            break;
          }
        }
        
        // Format birthday
        const birthday = `${dd}.${mm}.${year}`;
        
        // Get image from Wikipedia (with thumbnail from pages array or fetch separately)
        let imageUrl = wikiPage?.thumbnail?.source || null;
        if (!imageUrl) {
          imageUrl = await fetchWikiImage(fullName);
        }
        
        // Get wiki URL
        const wikiUrl = wikiPage?.content_urls?.desktop?.page || null;
        
        // Try to insert (will fail silently if duplicate due to unique index)
        await Menschen.findOneAndUpdate(
          { name: fullName, birthday },
          {
            $setOnInsert: {
              firstName,
              lastName,
              name: fullName,
              birthday,
              birthYear: year,
              country,
              countryCode: countryCodes[country] || '',
              category,
              profession,
              description: text,
              imageUrl,
              wikiUrl,
              isGenX: true,
              discoveredBy: 'system',
              discoveredByName: 'Wikipedia Import',
              discoveredFor: 'birthday',
              isVerified: true,
              hasArticle: false,
            }
          },
          { upsert: true, new: true }
        );
        
        imported++;
      } catch (err: any) {
        if (err.code !== 11000) {
          errors.push(`${birth.text?.slice(0, 50)}: ${err.message}`);
        } else {
          skipped++;
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      date: `${dd}.${mm}`,
      total: genxBirths.length,
      imported,
      skipped,
      errors: errors.slice(0, 5),
    });
    
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET: Import today's birthdays
export async function GET() {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  
  // Create a fake request with today's date
  const fakeRequest = {
    json: async () => ({ month, day })
  } as NextRequest;
  
  return POST(fakeRequest);
}
