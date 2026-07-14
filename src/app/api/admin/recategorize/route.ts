import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import dbConnect from '@/lib/mongoose';
import Article from '@/models/Article';
import { VALID_CATEGORY_SLUGS } from '@/lib/categories';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const RETIRED = ['genx-icons', 'tech', 'culture', 'rewind', ''];

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    // Find all articles that have a missing or retired category
    const articles = await Article.find({
      $or: [
        { category: { $in: RETIRED } },
        { category: { $exists: false } },
        { category: null },
      ],
    }).select('_id title subtitle category').lean();

    if (articles.length === 0) {
      return NextResponse.json({ success: true, updated: 0, message: 'All articles already have valid categories.' });
    }

    // Ask GPT to classify all titles in one shot (cost efficient)
    const prompt = articles.map((a: any, i: number) =>
      `${i}. "${a.title}"${a.subtitle ? ` — ${a.subtitle}` : ''} [current: ${a.category || 'none'}]`
    ).join('\n');

    const validSlugs = VALID_CATEGORY_SLUGS.filter(s => !RETIRED.includes(s));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `You are a content categorizer. Given a list of article titles, assign each one the single best category slug.
Valid slugs: ${validSlugs.join(', ')}
Rules:
- movies-tv → films, TV shows, actors, directors, celebrities, GenX icons, 80s/90s pop culture
- music → songs, bands, albums, concerts, artists
- sports → any sport, athletes, matches, championships
- gaming → video games, consoles, esports, tech, gadgets, software
- history → historical events, anniversaries, "on this day", decades
- lifestyle → food, travel, fashion, wellness, culture, art, society
- rip → death tributes, obituaries, memorials
- news → current events, politics, economy, world news
- eastercorn → platform/meta content

Reply ONLY with a JSON array matching the input order: ["slug0","slug1",...]`,
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
    });

    const raw = completion.choices[0]?.message?.content || '[]';
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ success: false, error: 'GPT returned unexpected format', raw }, { status: 500 });
    }

    const categories: string[] = JSON.parse(jsonMatch[0]);

    // Bulk update
    let updated = 0;
    const results: { id: string; title: string; from: string; to: string }[] = [];
    await Promise.all(
      articles.map(async (a: any, i: number) => {
        const newCat = categories[i];
        if (!newCat || !validSlugs.includes(newCat)) return;
        await Article.findByIdAndUpdate(a._id, { category: newCat });
        results.push({ id: a._id.toString(), title: a.title, from: a.category || 'none', to: newCat });
        updated++;
      })
    );

    return NextResponse.json({ success: true, updated, results });
  } catch (err: any) {
    console.error('Recategorize error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
