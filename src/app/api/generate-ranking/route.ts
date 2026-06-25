import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Load central system prompt
function getSystemPrompt(): string {
  try {
    const promptPath = path.join(process.cwd(), 'src', 'prompts', 'system-prompt.txt');
    return fs.readFileSync(promptPath, 'utf-8');
  } catch {
    return '';
  }
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

    // Trigger AUFGABE 8: RANKING-LISTE GENERIERUNG from central prompt
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate a ranking list about ${topic}. Include as many items as genuinely make sense for this topic — between 5 and 20. Do not pad with weak entries just to hit a number, and do not cut good ones just to stay short.` }
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
    
    console.log('Generated ranking:', { 
      title: ranking.title, 
      subtitle: ranking.subtitle, 
      itemCount: ranking.items?.length,
      firstItem: ranking.items?.[0]
    });

    // Fetch images for all items: Tenor GIF first, fallback Wikipedia, fallback topic GIF
    if (ranking.items && Array.isArray(ranking.items)) {
      const imagePromises = ranking.items.map(async (item: any) => {
        const searchTerm = item.wikiSearch || item.title || topic;

        // 1. Try Tenor for the specific item
        let image = await getTenorGif(searchTerm);

        // 2. Try Wikipedia
        if (!image && item.wikiSearch) {
          image = await getWikipediaImage(item.wikiSearch);
        }

        // 3. Fall back to Tenor with the main topic (e.g. "Brad Pitt")
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
