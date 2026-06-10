import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dbConnect from '@/lib/mongoose';
import Prediction from '@/models/Prediction';
import { berlinDateAt } from '@/lib/berlinTime';

// Load central system prompt
function getSystemPrompt(): string {
  try {
    const promptPath = path.join(process.cwd(), 'src', 'prompts', 'system-prompt.txt');
    return fs.readFileSync(promptPath, 'utf-8');
  } catch {
    return '';
  }
}

// POST - Bot generates prediction candidates (as drafts) for the next N days.
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const days: number = Math.min(Math.max(Number(body.days) || 3, 1), 3);
    const perDay: number = Math.min(Math.max(Number(body.perDay) || 4, 1), 8);

    const openai = new OpenAI({ apiKey });
    const systemPrompt = getSystemPrompt();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

    // User prompt - rules are in system-prompt.txt AUFGABE 4
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Generate ${days * perDay} prediction questions. Today is ${today}. Spread across ${days} days (dayOffset 1-${days}).`,
        },
      ],
      temperature: 0.9,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ success: false, error: 'Failed to parse AI output' }, { status: 502 });
    }

    const list: any[] = Array.isArray(parsed.predictions) ? parsed.predictions : [];
    const validCategories = ['sport', 'politics', 'entertainment', 'music', 'tech', 'world', 'weather', 'finance', 'other'];

    const docs = list
      .filter((p) => p && typeof p.question === 'string' && Array.isArray(p.options) && p.options.length >= 2)
      .map((p) => {
        const dayOffset = Math.min(Math.max(Number(p.dayOffset) || 1, 1), days);
        const category = validCategories.includes(p.category) ? p.category : 'other';
        const options = p.options
          .filter((o: unknown) => typeof o === 'string' && o.trim().length > 0)
          .slice(0, 4)
          .map((label: string, i: number) => ({ id: String.fromCharCode(97 + i), label: label.trim() }));

        // Closes at 23:00 CET the day before event; resolved at 09:00 on event day
        const closesAt = berlinDateAt(dayOffset - 1, 23, 0);
        const eventDate = berlinDateAt(dayOffset, 0, 0);

        return {
          question: p.question.trim(),
          category,
          options,
          genXRelated: Boolean(p.genXRelated),
          source: 'bot' as const,
          status: 'draft' as const,
          pointsReward: 100,
          closesAt,
          eventDate,
          searchQuery: p.searchQuery || p.question,
        };
      })
      .filter((d) => d.options.length >= 2);

    if (docs.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid predictions generated' }, { status: 502 });
    }

    const created = await Prediction.insertMany(docs);

    return NextResponse.json({ success: true, count: created.length, predictions: created });
  } catch (error: any) {
    console.error('predictions generate error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
