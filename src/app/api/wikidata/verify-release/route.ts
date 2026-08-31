import { NextRequest, NextResponse } from 'next/server';
import { formatReleaseDates, verifyRelease } from '@/lib/wikidataReleases';
import { releaseCategoryFor } from '@/lib/releaseCategory';

// POST /api/wikidata/verify-release
// Body: { title, year?, category?, month?, day? }
// Checks the date a reporter claimed against the title's own Wikidata entity.
// Never rejects on its own - it returns a status the UI shows as a badge.
export async function POST(request: NextRequest) {
  try {
    const { title, year, category, month, day } = await request.json();
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing title' }, { status: 400 });
    }

    const now = new Date();
    const m = Number(month) || now.getMonth() + 1;
    const d = Number(day) || now.getDate();

    const check = await verifyRelease(
      title,
      year ? Number(year) : undefined,
      m,
      d,
      releaseCategoryFor(category)
    );

    return NextResponse.json({
      success: true,
      status: check.status,
      matchedLabel: check.matchedLabel,
      // Pre-formatted for the card hint ("21.08.1987 (United States)")
      documentedDates: formatReleaseDates(check.dates),
      dates: check.dates,
    });
  } catch (error) {
    console.error('wikidata verify-release error:', error);
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
}
