import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { combinePrompts } from '@/lib/loadPrompt';
import { searchYouTubeVideo, PREFER_LONG_THEN_ANY } from '@/lib/youtubeSearch';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Load modular prompts: core + ranking rules
function getSystemPrompt(): string {
  return combinePrompts(['core.txt', 'ranking.txt']);
}

// Fetch Tenor GIF for a search term
async function getTenorGif(searchTerm: string): Promise<string | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/tenor-search?q=${encodeURIComponent(searchTerm)}`);
    const data = await res.json();
    if (data.success && data.results?.length > 0) {
      return data.results[0] || null;
    }
  } catch { /* silent */ }
  return null;
}

// Fetch YouTube video thumbnail for a search term (returns thumbnail URL that RankingItemImage recognizes as video)
async function getYouTubeVideoThumbnail(searchTerm: string): Promise<string | null> {
  try {
    const result = await searchYouTubeVideo({
      query: searchTerm,
      tiers: PREFER_LONG_THEN_ANY, // Allow any duration for ranking items
      maxResults: 5,
      // Ranking tiles: a loosely related thumbnail beats an empty tile, so the
      // topical gate stays off here (it guards article embeds, see youtubeSearch.ts).
      minRelevance: 0,
    });
    
    if (result?.videoId) {
      // Return YouTube thumbnail URL (RankingItemImage will detect this and enable inline playback)
      console.log(`YouTube: "${searchTerm}" -> video ${result.videoId}`);
      return `https://img.youtube.com/vi/${result.videoId}/hqdefault.jpg`;
    }
  } catch (error) {
    console.error('YouTube search error for', searchTerm, ':', error);
  }
  return null;
}

// Fetch Wikipedia image for a search term
async function getWikipediaImage(searchTerm: string): Promise<string | null> {
  try {
    // Search for the Wikipedia page
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&format=json`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    const pageTitle = searchData.query?.search?.[0]?.title;
    if (!pageTitle) {
      console.log(`Wikipedia: No page found for "${searchTerm}"`);
      return null;
    }
    
    // Get the page image
    const imageUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&format=json&pithumbsize=300`;
    const imageRes = await fetch(imageUrl);
    const imageData = await imageRes.json();
    
    const pages = imageData.query?.pages;
    if (!pages) return null;
    
    const page = Object.values(pages)[0] as any;
    const image = page?.thumbnail?.source || null;
    
    console.log(`Wikipedia: "${searchTerm}" -> "${pageTitle}" -> ${image ? 'IMAGE FOUND' : 'NO IMAGE'}`);
    return image;
  } catch (error) {
    console.error('Wikipedia image fetch error for', searchTerm, ':', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { topic } = await request.json();

    if (!topic) {
      return NextResponse.json({ success: false, error: 'Missing topic' }, { status: 400 });
    }

    const systemPrompt = getSystemPrompt();

    // A count stated in the topic ("Top 10 ...") is a promise the title makes to the
    // reader, so it has to be enforced. Left to its own judgement the model returned
    // 9 entries under a "Top 10" headline, because the free-choice instruction below
    // contradicted the number in the title.
    const requestedCount = (() => {
      const m = topic.match(/\b(?:top|best|greatest)\s+(\d{1,2})\b/i);
      const n = m ? parseInt(m[1], 10) : NaN;
      return Number.isFinite(n) && n >= 2 && n <= 20 ? n : null;
    })();

    const countInstruction = requestedCount
      ? `The title asks for ${requestedCount} entries, so return EXACTLY ${requestedCount} items — no more, no fewer. If the subject does not support ${requestedCount} genuinely notable entries, rename the title to the number you can actually deliver rather than padding with weak or invented entries.`
      : `Include as many items as genuinely make sense — between 5 and 20. Do not pad with weak entries and do not invent things that did not happen. If your title states a number, it MUST equal the number of items you return.`;

    // Trigger AUFGABE 8: RANKING-LISTE GENERIERUNG from central prompt
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate a ranking list about: ${topic}

IMPORTANT: First determine what this subject is actually known for, then rank ONLY those things.
- If the subject is an ACTOR → rank their most iconic MOVIES/ROLES
- If the subject is a MUSICIAN/SINGER → rank their most iconic SONGS/ALBUMS
- If the subject is a BOXER/ATHLETE → rank their most iconic FIGHTS/MATCHES
- If the subject is a DIRECTOR → rank their most iconic FILMS
- If the subject is a TV SHOW → rank its best EPISODES or SEASONS
- Use common sense. NEVER assign a category that doesn't apply (e.g. do NOT rank songs for someone who is only an actor).

${countInstruction}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ success: false, error: 'No content generated' }, { status: 500 });
    }

    const ranking = JSON.parse(content);

    // Make "number in the title" and "number of items" agree, whatever the model did.
    // The prompt asks for this, but a prompt is not a guarantee: a "Top 10" headline
    // above 9 entries was shipped to the admin. Too many items are truncated (the list
    // is ranked, so the surplus sits at the weak end); too few means the title is
    // corrected downwards rather than padding with invented entries.
    if (Array.isArray(ranking.items) && ranking.items.length > 0) {
      if (requestedCount && ranking.items.length > requestedCount) {
        ranking.items = ranking.items.slice(0, requestedCount);
      }
      const stated = typeof ranking.title === 'string'
        ? ranking.title.match(/\b(top|best|greatest)\s+(\d{1,2})\b/i)
        : null;
      if (stated && parseInt(stated[2], 10) !== ranking.items.length) {
        ranking.title = ranking.title.replace(stated[0], `${stated[1]} ${ranking.items.length}`);
      }
    }

    console.log('Generated ranking:', { 
      title: ranking.title, 
      subtitle: ranking.subtitle, 
      itemCount: ranking.items?.length,
      firstItem: ranking.items?.[0]
    });

    // Determine if this is a video-worthy topic (sports highlights, fights, plays, performances, etc.)
    // Be generous - most ranking topics benefit from video clips
    const videoKeywords = /knockout|fight|match|play|goal|dunk|touchdown|performance|concert|live|highlight|scene|moment|episode|run|catch|shot|save|tackle|header|kick|punch|slam|drive|race|lap|win|victory|defeat|game|best|top|greatest|iconic|legendary|jaw.?dropping|mind.?blowing|amazing|incredible/i;
    const isVideoTopic = videoKeywords.test(topic) || videoKeywords.test(ranking.title || '') || videoKeywords.test(ranking.subtitle || '');
    console.log(`Topic "${topic}" isVideoTopic: ${isVideoTopic}`);

    // Fetch images/videos for all items
    if (ranking.items && Array.isArray(ranking.items)) {
      const imagePromises = ranking.items.map(async (item: any) => {
        const searchTerm = item.wikiSearch || item.title || topic;
        let image: string | null = null;

        // For video-worthy topics, try YouTube first
        if (isVideoTopic) {
          // Search YouTube with context (e.g. "Mike Tyson vs Michael Spinks knockout")
          const videoSearch = `${topic} ${item.title}`;
          image = await getYouTubeVideoThumbnail(videoSearch);
          if (image) {
            console.log(`Using YouTube video for "${item.title}"`);
          }
        }

        // 1. Wikimedia/Wikipedia for the specific item - real photos beat memes
        if (!image) {
          image = await getWikipediaImage(item.wikiSearch || searchTerm);
        }

        // 2. Wikimedia with the main topic (e.g. "Brad Pitt")
        if (!image) {
          image = await getWikipediaImage(topic);
        }

        // 3. Tenor GIF as last resort for the specific item
        if (!image) {
          image = await getTenorGif(searchTerm);
        }

        // 4. Tenor GIF with the main topic
        if (!image) {
          image = await getTenorGif(topic);
        }

        return { ...item, image: image || '' };
      });

      ranking.items = await Promise.all(imagePromises);
      console.log('Fetched images:', ranking.items.filter((i: any) => i.image).length, '/', ranking.items.length);
    }

    return NextResponse.json({
      success: true,
      ranking,
    });

  } catch (error: unknown) {
    console.error('Ranking generation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
