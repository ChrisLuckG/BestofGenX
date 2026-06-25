import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Article from '@/models/Article';

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Find the most recent occurrence of targetWeekday before or on baseDate
function getMatchingDate(baseDate: Date, targetWeekday: number): Date {
  const d = new Date(baseDate);
  let diff = d.getDay() - targetWeekday;
  if (diff <= 0) diff += 7; // always go back at least 1 day
  d.setDate(d.getDate() - diff);
  return d;
}

function formatNice(date: Date): string {
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    if (secret !== 'migrate2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Find old-style titles: "DAILY CHAMPIONS: MONDAY" (no comma/number = no date yet)
    const oldArticles = await Article.find({
      title: { $regex: /^daily champions:\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i }
    }).select('_id title createdAt').lean();

    if (oldArticles.length === 0) {
      return NextResponse.json({ success: true, message: 'No old articles to migrate', updated: 0 });
    }

    const updates: { id: string; oldTitle: string; newTitle: string }[] = [];

    for (const article of oldArticles) {
      const titleUpper = (article.title as string).toUpperCase();
      const dayName = DAYS.find(d => titleUpper.endsWith(d.toUpperCase()));
      if (!dayName) continue;

      const targetIdx = DAYS.indexOf(dayName);
      const baseDate = new Date(article.createdAt as Date);
      const coveredDate = getMatchingDate(baseDate, targetIdx);
      const newTitle = `Daily Champions: ${formatNice(coveredDate)}`;

      await Article.findByIdAndUpdate(article._id, { title: newTitle });
      updates.push({ id: String(article._id), oldTitle: article.title as string, newTitle });
    }

    return NextResponse.json({
      success: true,
      updated: updates.length,
      changes: updates,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed', details: String(error) }, { status: 500 });
  }
}
