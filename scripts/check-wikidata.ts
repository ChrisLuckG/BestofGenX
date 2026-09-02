import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

async function checkPerson(name: string, birthYear?: string) {
  const sparql = `
    SELECT ?person ?personLabel ?birthPlaceLabel ?twitter ?instagram ?facebook ?youtube ?tiktok ?website WHERE {
      ?person wdt:P31 wd:Q5 .
      ?person rdfs:label "${name}"@en .
      ${birthYear ? `?person wdt:P569 ?birthDate . FILTER(YEAR(?birthDate) = ${birthYear})` : ''}
      
      OPTIONAL { ?person wdt:P19 ?birthPlace . }
      OPTIONAL { ?person wdt:P2002 ?twitter . }
      OPTIONAL { ?person wdt:P2003 ?instagram . }
      OPTIONAL { ?person wdt:P2013 ?facebook . }
      OPTIONAL { ?person wdt:P2397 ?youtube . }
      OPTIONAL { ?person wdt:P7085 ?tiktok . }
      OPTIONAL { ?person wdt:P856 ?website . }
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 5
  `;
  
  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`;
  
  console.log(`Searching Wikidata for: ${name}${birthYear ? ` (${birthYear})` : ''}\n`);
  
  const res = await fetch(url, {
    headers: { 
      'User-Agent': 'BestOfGenX/1.0',
      'Accept': 'application/sparql-results+json'
    }
  });
  
  if (!res.ok) {
    console.log('Error:', res.status, res.statusText);
    return;
  }
  
  const data = await res.json();
  const results = data.results?.bindings || [];
  
  console.log(`Found ${results.length} results:\n`);
  
  for (const r of results) {
    console.log('Person:', r.personLabel?.value);
    console.log('Twitter:', r.twitter?.value ? `https://twitter.com/${r.twitter.value}` : '(not set)');
    console.log('Instagram:', r.instagram?.value ? `https://instagram.com/${r.instagram.value}` : '(not set)');
    console.log('Facebook:', r.facebook?.value || '(not set)');
    console.log('YouTube:', r.youtube?.value || '(not set)');
    console.log('TikTok:', r.tiktok?.value ? `https://tiktok.com/@${r.tiktok.value}` : '(not set)');
    console.log('Website:', r.website?.value || '(not set)');
    console.log('---');
  }
}

// Check Lennox Lewis (famous boxer, should have social media)
checkPerson('Lennox Lewis', '1965');
