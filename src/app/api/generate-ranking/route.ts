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
        { role: 'user', content: `Generate ranking list about ${topic}` }
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

    // Fetch Wikipedia images for all items in parallel
    if (ranking.items && Array.isArray(ranking.items)) {
      const imagePromises = ranking.items.map(async (item: any) => {
        if (item.wikiSearch) {
          const image = await getWikipediaImage(item.wikiSearch);
          return { ...item, image: image || '' };
        }
        return item;
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
