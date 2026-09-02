import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { searchYouTubeVideo } from "@/lib/youtubeSearch";
import { countryNameToCode } from "@/lib/countryFlags";

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

// Fetch country from Wikidata if missing
async function fetchCountryFromWikidata(name: string, birthYear?: string): Promise<{ country?: string; countryCode?: string } | null> {
  const sparql = `
    SELECT ?countryLabel WHERE {
      ?person wdt:P31 wd:Q5 .
      ?person rdfs:label "${name.replace(/"/g, '\\"')}"@en .
      ${birthYear ? `?person wdt:P569 ?birthDate . FILTER(YEAR(?birthDate) = ${birthYear})` : ''}
      ?person wdt:P27 ?country .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 1
  `;
  
  try {
    const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`;
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'BestOfGenX/1.0',
        'Accept': 'application/sparql-results+json'
      },
      signal: AbortSignal.timeout(8000)
    });
    
    if (!res.ok) return null;
    
    const data = await res.json();
    const results = data.results?.bindings || [];
    
    if (results.length === 0) return null;
    
    let country = results[0].countryLabel?.value || '';
    // Normalize common country names
    if (country === 'United States of America' || country === 'United States') country = 'USA';
    if (country === 'United Kingdom of Great Britain and Northern Ireland' || country === 'United Kingdom') country = 'UK';
    
    return {
      country,
      countryCode: countryNameToCode(country) || ''
    };
  } catch (e) {
    console.error('[Almanac] Wikidata country fetch error:', e);
    return null;
  }
}

// Build YouTube iframe HTML
function buildYoutubeIframe(videoId: string): string {
  return `<div class="youtube-embed" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:16px 0;border-radius:12px;">
<iframe src="https://www.youtube.com/embed/${videoId}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;border-radius:12px;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>`;
}

// Find YouTube video with STRICT relevance check, excluding already used videos
// The person's name MUST appear in the video title to avoid completely wrong videos
async function findYoutubeVideoId(
  query: string, 
  context: string, 
  excludeIds?: Set<string>,
  personName?: string
): Promise<string | null> {
  try {
    const hit = await searchYouTubeVideo({ 
      query, 
      context, 
      minRelevance: 0.5, // Increased from 0.3 - require 50% match
      maxResults: 8,
      excludeVideoIds: excludeIds,
    });
    
    // Extra check: if we have a person name, verify it appears in the video title
    if (hit && personName) {
      const nameParts = personName.toLowerCase().split(' ').filter(p => p.length > 2);
      const titleLower = hit.title.toLowerCase();
      const nameInTitle = nameParts.some(part => titleLower.includes(part));
      if (!nameInTitle) {
        console.log('[Almanac] Rejecting video - person name not in title:', hit.title, 'vs', personName);
        return null;
      }
    }
    
    return hit?.videoId || null;
  } catch (e) {
    console.error('[Almanac] YouTube search error:', e);
    return null;
  }
}

// Convert sections to HTML content with YouTube videos (no duplicates!)
// personName is used to verify the video is actually about this person
async function convertSectionsToContent(
  sections: Array<{heading: string | null; text: string; youtubeSearch?: string}>,
  personName?: string
): Promise<string> {
  console.log('[Almanac] Converting', sections.length, 'sections to content with videos for:', personName);
  const contentParts: string[] = [];
  const usedVideoIds = new Set<string>(); // Track used videos to avoid duplicates
  
  for (const section of sections) {
    // Add heading if present
    if (section.heading) {
      contentParts.push(`<h2>${section.heading}</h2>`);
    }
    
    // Add text content
    contentParts.push(section.text);
    
    // Search for YouTube video if search term provided
    if (section.youtubeSearch) {
      console.log('[Almanac] Searching YouTube for:', section.youtubeSearch, '| excluding:', usedVideoIds.size, 'videos');
      const youtubeId = await findYoutubeVideoId(
        section.youtubeSearch,
        [section.heading || '', section.text || ''].join(' '),
        usedVideoIds,
        personName // Pass person name for strict validation
      );
      if (youtubeId) {
        console.log('[Almanac] Adding video:', youtubeId);
        usedVideoIds.add(youtubeId); // Track this video
        contentParts.push(buildYoutubeIframe(youtubeId));
      } else {
        console.log('[Almanac] No relevant video found for this section - skipping embed');
      }
    }
  }
  
  return contentParts.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "OpenAI API key not configured" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });
    const { person, options, isItem, itemCategory } = await request.json();

    const subjectName = `${person.firstname}${person.lastname ? ' ' + person.lastname : ''}`;
    console.log(`[Almanac] Generating article for ${subjectName} (${isItem ? itemCategory : 'person'})...`);

    // System prompt for structured article with sections
    const systemPrompt = `You are a GenX culture expert writing engaging articles about GenX icons and cultural moments.

IMPORTANT: Return a JSON object with this EXACT structure:
{
  "title": "Catchy article title",
  "subtitle": "Engaging subtitle",
  "category": "music|sports|movies-tv|tech|culture|genx-icons",
  "tags": ["tag1", "tag2", "tag3"],
  "sections": [
    {"heading": null, "text": "<p>Opening paragraph...</p>", "youtubeSearch": "Person Name famous moment official video"},
    {"heading": "Section Title", "text": "<p>Content with <strong>formatting</strong>...</p>", "youtubeSearch": "Person Name specific event year"},
    {"heading": "Another Section", "text": "<p>More content...</p>", "youtubeSearch": "Person Name interview documentary"}
  ]
}

RULES:
- Write 3-5 sections with engaging content
- First section has NO heading (null), it's the intro
- Use HTML formatting: <p>, <strong>, <em>, <ul>, <li>
- VIDEO RULES (IMPORTANT!):
  - Only include "youtubeSearch" for 1-2 sections MAX, not every section!
  - The TEXT must reference the video, e.g. "In the clip below..." or "Watch his legendary performance..."
  - If a section doesn't reference a video, set "youtubeSearch": null
  - Be SPECIFIC: "Michael Jordan 1998 finals game 6" not just "Michael Jordan"
- For MUSIC: "Artist Name song title official video" or "Artist Name live performance venue year"
- For SPORTS: "Athlete Name best moments championship year" 
- For ACTORS: "Actor Name movie title scene year"
- Write in the requested language and tone
- Content should be nostalgic, engaging, and celebrate GenX culture`;

    const userMessage = isItem
      ? `Write an article about "${subjectName}" (${itemCategory}).
Details: ${person.knownfor || 'a GenX cultural icon'}.
Language: ${options.language || 'English'}
Length: ${options.length || 'medium'}
Tone: ${options.tone || 'informative'}
${options.topic ? `Focus: ${options.topic}` : ''}
${options.extra ? `Extra instructions: ${options.extra}` : ''}`
      : `Write an article about ${subjectName}.
Profession: ${person.profession}
Born: ${person.born || 'unknown'}
Country: ${person.countryBorn || 'unknown'}
Known for: ${person.knownfor || 'various works'}
${person.died ? `Died: ${person.died}` : 'Still alive'}
Language: ${options.language || 'English'}
Length: ${options.length || 'medium'}
Tone: ${options.tone || 'informative'}
Timeframe: ${options.timeframe || 'alltime'}
${options.topic ? `Focus: ${options.topic}` : ''}
${options.extra ? `Extra instructions: ${options.extra}` : ''}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      return NextResponse.json({ success: false, error: "No response from AI" }, { status: 500 });
    }

    try {
      const data = JSON.parse(response);
      
      // Map AI category to valid Article category
      const CATEGORY_MAP: Record<string, string> = {
        'movies': 'movies-tv',
        'tv': 'movies-tv',
        'movies-tv': 'movies-tv',
        'music': 'music',
        'gaming': 'gaming',
        'sports': 'sports',
        'tech': 'tech',
        'culture': 'culture',
        'news': 'news',
        'lifestyle': 'lifestyle',
        'genx-icons': 'genx-icons',
        'icons': 'genx-icons',
        'people': 'genx-icons',
        'person': 'genx-icons',
        'rip': 'rip',
        'obituary': 'rip',
        'memorial': 'rip',
        'tribute': 'rip',
      };
      const mappedCategory = CATEGORY_MAP[data.category?.toLowerCase()] || 'genx-icons';
      
      // Convert sections to HTML content with YouTube videos
      let finalContent = '';
      if (data.sections && Array.isArray(data.sections)) {
        console.log(`[Almanac] Processing ${data.sections.length} sections with YouTube search for ${subjectName}...`);
        finalContent = await convertSectionsToContent(data.sections, subjectName);
        console.log(`[Almanac] Article generated with videos`);
      } else if (data.content) {
        // Fallback to plain content
        finalContent = data.content;
      }
      
      return NextResponse.json({ 
        success: true, 
        title: data.title,
        subtitle: data.subtitle,
        article: finalContent,
        content: finalContent,
        tags: data.tags || [],
        category: mappedCategory,
      });
    } catch (e) {
      console.error('[Almanac] Parse error:', e);
      // Fallback: return raw text as content
      return NextResponse.json({ 
        success: true, 
        article: response,
        content: response,
      });
    }

  } catch (error: any) {
    console.error("Almanac article error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
