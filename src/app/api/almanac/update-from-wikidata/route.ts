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
} | null> {
  const sparql = `
    SELECT ?person ?personLabel ?birthPlaceLabel ?birthCountryLabel ?deathPlaceLabel ?deathCountryLabel ?causeLabel ?deathDate WHERE {
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
  
  // Filter to only people with proper YYYY-MM-DD dates, then sort by birthday DESCENDING
  // (31st first, then 30th, 29th... so today's birthdays are processed first)
  const peopleWithFullDate = people.filter((p: any) => p.born && p.born.length >= 10);
  
  const sortedPeople = peopleWithFullDate.sort((a: any, b: any) => {
    // Parse MM-DD from YYYY-MM-DD
    const aDay = parseInt(a.born.substring(8, 10));
    const bDay = parseInt(b.born.substring(8, 10));
    
    // Sort by day DESCENDING (31, 30, 29...)
    return bDay - aDay;
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
