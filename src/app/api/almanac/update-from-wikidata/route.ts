import { NextRequest } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Person } from '@/models/Almanac';

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

async function queryWikidata(sparql: string): Promise<any[]> {
  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'SportTock/1.0 (https://sporttock.com)',
        'Accept': 'application/sparql-results+json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!res.ok) {
      return [];
    }
    
    const data = await res.json();
    return data.results?.bindings || [];
  } catch (err) {
    return [];
  }
}

function normalizeCountry(country: string | undefined): string | undefined {
  if (!country) return undefined;
  if (country === 'United States of America' || country === 'United States') return 'USA';
  if (country === 'United Kingdom of Great Britain and Northern Ireland' || country === 'United Kingdom') return 'UK';
  return country;
}

// Search Wikipedia for person image
async function searchWikipediaImage(name: string): Promise<string | null> {
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(name)}&prop=pageimages&pithumbsize=400&format=json&origin=*`;
    const res = await fetch(wikiUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    
    const data = await res.json();
    const pages = data.query?.pages || {};
    
    for (const pageId in pages) {
      const page = pages[pageId];
      if (page.thumbnail?.source) {
        return page.thumbnail.source;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchPersonDataFromWikidata(name: string, birthYear: string): Promise<{
  cityBorn?: string;
  countryBorn?: string;
  cityDied?: string;
  countryDied?: string;
  causeOfDeath?: string;
  deathDate?: string;
  twitter?: string;
  instagram?: string;
  facebook?: string;
  youtube?: string;
  tiktok?: string;
  website?: string;
} | null> {
  // Wikidata properties for social media:
  // P2002 = Twitter username, P2003 = Instagram username, P2013 = Facebook ID
  // P2397 = YouTube channel ID, P7085 = TikTok username, P856 = official website
  const sparql = `
    SELECT ?person ?personLabel ?birthPlaceLabel ?birthCountryLabel ?deathPlaceLabel ?deathCountryLabel ?causeLabel ?deathDate
           ?twitter ?instagram ?facebook ?youtube ?tiktok ?website WHERE {
      ?person wdt:P31 wd:Q5 .
      ?person rdfs:label "${name.replace(/"/g, '\\"')}"@en .
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
      OPTIONAL { ?person wdt:P2002 ?twitter . }
      OPTIONAL { ?person wdt:P2003 ?instagram . }
      OPTIONAL { ?person wdt:P2013 ?facebook . }
      OPTIONAL { ?person wdt:P2397 ?youtube . }
      OPTIONAL { ?person wdt:P7085 ?tiktok . }
      OPTIONAL { ?person wdt:P856 ?website . }
      
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
    twitter: r.twitter?.value ? `https://twitter.com/${r.twitter.value}` : undefined,
    instagram: r.instagram?.value ? `https://instagram.com/${r.instagram.value}` : undefined,
    facebook: r.facebook?.value ? `https://facebook.com/${r.facebook.value}` : undefined,
    youtube: r.youtube?.value ? `https://youtube.com/channel/${r.youtube.value}` : undefined,
    tiktok: r.tiktok?.value ? `https://tiktok.com/@${r.tiktok.value}` : undefined,
    website: r.website?.value,
  };
}

// POST - Update people from Wikidata with streaming
export async function POST(request: NextRequest) {
  await dbConnect();
  
  const { limit = 50, month } = await request.json();
  
  // Build query - find people with missing cityBorn
  const query: any = {
    $or: [
      { cityBorn: { $in: [null, ''] } },
      { cityBorn: { $exists: false } },
    ]
  };
  
  // If month filter provided, only get people born in that month
  if (month) {
    const mm = String(month).padStart(2, '0');
    query.born = { $regex: `-${mm}-` };
  }
  
  const people = await Person.find(query).lean();
  
  console.log(`Found ${people.length} people with missing cityBorn${month ? ` in month ${month}` : ''}`);
  
  console.log(`Found ${people.length} people with missing cityBorn`);
  
  // Filter to only people with proper YYYY-MM-DD dates, then sort by proximity to today
  // (today's birthdays first, then tomorrow, then day after, etc.)
  const peopleWithFullDate = people.filter((p: any) => p.born && p.born.length >= 10);
  
  const today = new Date();
  const todayMonth = today.getMonth() + 1; // 1-12
  const todayDay = today.getDate();
  
  const sortedPeople = peopleWithFullDate.sort((a: any, b: any) => {
    // Parse MM-DD from YYYY-MM-DD
    const aMonth = parseInt(a.born.substring(5, 7));
    const aDay = parseInt(a.born.substring(8, 10));
    const bMonth = parseInt(b.born.substring(5, 7));
    const bDay = parseInt(b.born.substring(8, 10));
    
    // Calculate days until birthday (0 = today, 1 = tomorrow, etc.)
    const getDaysUntil = (m: number, d: number) => {
      const thisYear = today.getFullYear();
      const bday = new Date(thisYear, m - 1, d);
      if (bday < today) bday.setFullYear(thisYear + 1); // Birthday already passed this year
      return Math.floor((bday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    };
    
    const aDays = getDaysUntil(aMonth, aDay);
    const bDays = getDaysUntil(bMonth, bDay);
    
    // Sort by days until birthday ASCENDING (today first, then tomorrow, etc.)
    return aDays - bDays;
  }).slice(0, limit);
  
  console.log('First 5 people to update:', sortedPeople.slice(0, 5).map((p: any) => `${p.firstname} ${p.lastname} (${p.born})`));

  // Create streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let updated = 0;
      
      for (let i = 0; i < sortedPeople.length; i++) {
        const person = sortedPeople[i];
        const name = `${person.firstname} ${person.lastname}`.trim();
        const birthYear = person.born?.substring(0, 4) || '';
        
        // Send current person being processed
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          type: 'processing', 
          index: i + 1, 
          total: sortedPeople.length,
          name 
        })}\n\n`));
        
        const data = await fetchPersonDataFromWikidata(name, birthYear);
        
        if (data) {
          const update: any = {};
          const updatedFields: string[] = [];
          
          if (!person.cityBorn && data.cityBorn) {
            update.cityBorn = data.cityBorn;
            updatedFields.push('city');
          }
          if ((!person.countryBorn || person.countryBorn === 'Unknown') && data.countryBorn) {
            update.countryBorn = data.countryBorn;
            updatedFields.push('country');
          }
          if (!person.cityDied && data.cityDied) {
            update.cityDied = data.cityDied;
            updatedFields.push('deathCity');
          }
          if (!person.countryDied && data.countryDied) {
            update.countryDied = data.countryDied;
            updatedFields.push('deathCountry');
          }
          if (!person.causeOfDeath && data.causeOfDeath) {
            update.causeOfDeath = data.causeOfDeath;
            updatedFields.push('cause');
          }
          if (person.died && person.died.length < 10 && data.deathDate) {
            update.died = data.deathDate;
            updatedFields.push('deathDate');
          }
          
          // Social media links (stored in social.* subdocument)
          const social = (person as any).social || {};
          if (!social.twitter && data.twitter) {
            update['social.twitter'] = data.twitter;
            updatedFields.push('twitter');
          }
          if (!social.instagram && data.instagram) {
            update['social.instagram'] = data.instagram;
            updatedFields.push('instagram');
          }
          if (!social.facebook && data.facebook) {
            update['social.facebook'] = data.facebook;
            updatedFields.push('facebook');
          }
          if (!social.youtube && data.youtube) {
            update['social.youtube'] = data.youtube;
            updatedFields.push('youtube');
          }
          if (!social.tiktok && data.tiktok) {
            update['social.tiktok'] = data.tiktok;
            updatedFields.push('tiktok');
          }
          if (!social.website && data.website) {
            update['social.website'] = data.website;
            updatedFields.push('website');
          }
          
          // Also search for image if missing
          if (!person.image) {
            const imageUrl = await searchWikipediaImage(name);
            if (imageUrl) {
              update.image = imageUrl;
              updatedFields.push('image');
            }
          }
          
          if (Object.keys(update).length > 0) {
            await Person.updateOne({ _id: person._id }, { $set: update });
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'updated', 
              name, 
              fields: updatedFields 
            })}\n\n`));
            updated++;
          } else {
            // Wikidata found person but no new data - mark city as Unknown
            await Person.updateOne({ _id: person._id }, { $set: { cityBorn: 'Unknown' } });
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'marked_unknown', 
              name 
            })}\n\n`));
            updated++;
          }
        } else {
          // Person not found in Wikidata - try to at least get an image
          const imageUrl = await searchWikipediaImage(name);
          const updateData: any = { cityBorn: 'Unknown' };
          const fields: string[] = [];
          
          if (imageUrl && !person.image) {
            updateData.image = imageUrl;
            fields.push('image');
          }
          
          await Person.updateOne({ _id: person._id }, { $set: updateData });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: fields.length > 0 ? 'image_only' : 'not_found_marked', 
            name,
            fields: fields.length > 0 ? fields : undefined
          })}\n\n`));
        }
        
        // Rate limit - 500ms between requests
        await new Promise(r => setTimeout(r, 500));
      }
      
      // Send completion
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
        type: 'done', 
        updated, 
        total: sortedPeople.length 
      })}\n\n`));
      
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
