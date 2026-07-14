import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';

// GET - Get incoming challenges for a user (battles where they are challengedUser but haven't accepted yet)
// Also returns pending wager amount for backwards compatibility
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    // Find incoming challenges: open battles where user is the challengedUser (not creator)
    const incomingChallenges = await Battle.find({
      status: 'open',
      challengedUser: userId,
      creator: { $ne: userId }, // Not created by this user
    })
    .populate('creator', '_id username avatar')
    .sort({ createdAt: -1 })
    .lean();

    // Also calculate pending wager amount (for backwards compatibility)
    const allPendingBattles = await Battle.find({
      status: { $in: ['open', 'active'] },
      $or: [{ creator: userId }, { opponent: userId }],
    }).select('wager').lean();

    const amount = allPendingBattles.reduce((sum, b: any) => sum + (b.wager || 0), 0);

    return NextResponse.json(
      {
        success: true,
        battles: incomingChallenges,
        hasPending: allPendingBattles.length > 0,
        count: incomingChallenges.length,
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
    console.error('Failed to check pending challenges:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
