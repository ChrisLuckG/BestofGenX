import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';

// GET - Check if the user has any coins locked in a pending wager.
// A wager is "pending" when the user is the creator or opponent of a battle
// that is still 'open' (waiting) or 'active' (in progress) and not yet completed.
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    const pendingBattles = await Battle.find({
      status: { $in: ['open', 'active'] },
      $or: [{ creator: userId }, { opponent: userId }],
    }).select('wager').lean();

    const amount = pendingBattles.reduce((sum, b: any) => sum + (b.wager || 0), 0);

    return NextResponse.json(
      {
        success: true,
        hasPending: pendingBattles.length > 0,
        count: pendingBattles.length,
        amount: Math.round(amount * 100) / 100,
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error: any) {
    console.error('Failed to check pending wager:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
