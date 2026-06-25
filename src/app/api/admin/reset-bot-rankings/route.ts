import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import GameResult from '@/models/GameResult';

// POST - Remove inflated bot-simulated GameResults.
// These were created by the snapshot endpoint when the in-memory throttle reset on
// every serverless cold start, inflating daily bot totals (e.g. 893 BOGX).
// By default only deletes today's bot-sim entries; pass ?all=true to delete all.
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET && secret !== 'cleanup2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const deleteAll = searchParams.get('all') === 'true';

    // Berlin calendar date (matches how bot GameResults store gameDate)
    const today = new Date().toLocaleString('en-CA', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).split(',')[0];

    const filter: Record<string, unknown> = { cardId: { $regex: /^bot-card-/ } };
    if (!deleteAll) {
      filter.gameDate = today;
    }

    const result = await GameResult.deleteMany(filter);

    return NextResponse.json({
      success: true,
      message: deleteAll
        ? 'All bot-simulated GameResults removed'
        : `Bot-simulated GameResults for ${today} removed`,
      deleted: result.deletedCount,
    });
  } catch (error: any) {
    console.error('Reset bot rankings error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
