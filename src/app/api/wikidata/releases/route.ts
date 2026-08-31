import { NextRequest, NextResponse } from 'next/server';
import { fetchReleasePool } from '@/lib/wikidataReleases';
import { releaseCategoryFor } from '@/lib/releaseCategory';

// GET /api/wikidata/releases?category=movies-tv[&month=&day=]
// Verified list of things released on that calendar day within EVENT_ERA.
// Fetched once per event search and split across the reporters, because the
// underlying SPARQL query needs several seconds.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = releaseCategoryFor(searchParams.get('category') || undefined);
    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Unsupported category. Wikidata release dates cover movies-tv, music and gaming.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);
    const day = parseInt(searchParams.get('day') || String(now.getDate()), 10);
    if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) {
      return NextResponse.json({ success: false, error: 'Invalid month/day' }, { status: 400 });
    }

    const items = await fetchReleasePool(month, day, category);
    return NextResponse.json({ success: true, month, day, category, items });
  } catch (error) {
    console.error('wikidata releases GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load release pool' }, { status: 500 });
  }
}
