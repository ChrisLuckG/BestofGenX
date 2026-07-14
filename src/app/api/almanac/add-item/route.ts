import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import dbConnect from '@/lib/mongoose';
import { AlmanacItem } from '@/models/Almanac';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Category = 'bands' | 'movies' | 'albums' | 'tvseries' | 'food' | 'cars' | 'fashion' | 'gadgets' | 'toys' | 'slang' | 'games';

const SCHEMAS: Record<Category, string> = {
  bands:    `{"name":"...","formed":"YYYY","disbanded":"YYYY or null","genre":"...","origin":"country","members":["name1","name2"],"knownfor":"1-2 sentences","image":null}`,
  movies:   `{"title":"...","year":1990,"director":"...","cast":["name1","name2"],"genre":"...","synopsis":"1-2 sentences","image":null}`,
  albums:   `{"title":"...","artist":"...","year":1990,"genre":"...","label":"...","tracklist":["Track 1","Track 2"],"image":null}`,
  tvseries: `{"title":"...","years":"1990-1996","network":"...","cast":["name1","name2"],"genre":"...","synopsis":"1-2 sentences","image":null}`,
  food:     `{"name":"...","origin":"country","type":"dish/drink/snack","era":"e.g. 90s","description":"1-2 sentences","image":null}`,
  cars:     `{"make":"...","model":"...","year":1990,"type":"sedan/coupe/SUV/etc","description":"1-2 sentences","image":null}`,
  fashion:  `{"name":"...","designer":"...","year":1990,"type":"clothing/accessory/trend","description":"1-2 sentences","image":null}`,
  gadgets:  `{"name":"...","manufacturer":"...","year":1990,"type":"device/console/etc","description":"1-2 sentences","image":null}`,
  toys:     `{"name":"...","manufacturer":"...","year":1990,"type":"toy/game/collectible","description":"1-2 sentences","image":null}`,
  slang:    `{"term":"...","definition":"...","origin":"country or scene","era":"e.g. early 90s","example":"sentence using the term"}`,
  games:    `{"title":"...","year":1990,"platform":"NES/SNES/PC/etc","developer":"...","genre":"...","description":"1-2 sentences","image":null}`,
};

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const { name, category, context } = await request.json();

    if (!name?.trim() || !category) {
      return NextResponse.json({ success: false, error: 'name and category required' }, { status: 400 });
    }

    const cat = category.toLowerCase() as Category;
    const schema = SCHEMAS[cat];
    if (!schema) {
      return NextResponse.json({ success: false, error: `Unknown category: ${category}` }, { status: 400 });
    }

    // Duplicate check on data.name / data.title
    const nameField = ['slang'].includes(cat) ? 'data.term' : ['bands','food','gadgets','toys'].includes(cat) ? 'data.name' : ['movies','tvseries','games','albums'].includes(cat) ? 'data.title' : 'data.name';
    const existing = await AlmanacItem.findOne({ category: cat, [nameField]: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existing) {
      return NextResponse.json({ success: true, exists: true, item: existing });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content: `You are a factual GenX-era knowledge base assistant. Generate a JSON profile for the given entry. Output ONLY valid JSON, no markdown, no extra text.
Category: ${cat}
Schema to follow: ${schema}
Focus on GenX era (1980s–2000s).
CRITICAL RULES:
- Fill EVERY field with real, accurate data. Never leave important fields empty.
- For bands: if the band has broken up, "disbanded" MUST have the year. If still active, use null.
- For movies/albums/games: "year" is mandatory — always include it.
- For food/fashion/gadgets: include origin country and era.
- Only use null as absolute last resort for truly unknown data.`,
        },
        { role: 'user', content: `Generate profile for: ${name}${context ? `\nContext: ${context}` : ''}` },
      ],
    });

    const raw = (completion.choices[0]?.message?.content || '').replace(/```json|```/g, '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ success: false, error: 'Could not generate profile' }, { status: 500 });
    }

    const data = JSON.parse(jsonMatch[0]);
    const item = await AlmanacItem.create({ category: cat, data });
    return NextResponse.json({ success: true, created: true, item });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
