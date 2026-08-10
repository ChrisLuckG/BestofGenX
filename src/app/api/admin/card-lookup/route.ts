import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Card from '@/models/Card';

/**
 * Read-only lookup to inspect which theme a Card is tagged with.
 *
 * Used to distinguish the two causes of "battle labelled TV but asks GAMING questions":
 *   1. the battle pulled cards from a foreign theme  -> see /api/admin/battle-topic-audit
 *   2. the Card itself is mis-tagged (theme=TV SHOWS holding a gaming question)
 *      -> only visible by looking up the actual question text, which is what this does.
 *
 * GET ?q=<substring of question text>
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    if (!q) {
      return NextResponse.json({ success: false, error: 'Missing ?q= search text' }, { status: 400 });
    }

    // Escape regex metacharacters so the caller can paste raw question text
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const cards = await Card.find({ 'questions.question': { $regex: safe, $options: 'i' } })
      .select('_id theme topic subCategory active questions')
      .limit(20)
      .lean();

    const results = cards.map((c: any) => ({
      cardId: c._id.toString(),
      theme: c.theme,
      topic: c.topic,
      subCategory: c.subCategory,
      active: c.active,
      matchingQuestions: (c.questions || [])
        .filter((v: any) => new RegExp(safe, 'i').test(v.question || ''))
        .map((v: any) => ({ question: v.question, difficultyText: v.difficultyText })),
    }));

    return NextResponse.json({ success: true, count: results.length, results });
  } catch (error: any) {
    console.error('Card lookup error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
