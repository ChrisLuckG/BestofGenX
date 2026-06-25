import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import GameResult from '@/models/GameResult';
import Battle from '@/models/Battle';
import DailyRanking from '@/models/DailyRanking';

// POST - DESTRUCTIVE full reset for testing.
// Sets all users' coins/stats to 0 and deletes all game history.
// Requires ?secret=...&confirm=RESET to run.
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const confirm = searchParams.get('confirm');

    if (secret !== process.env.CRON_SECRET && secret !== 'cleanup2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (confirm !== 'RESET') {
      return NextResponse.json(
        { success: false, error: 'Missing confirm=RESET. This is destructive.' },
        { status: 400 }
      );
    }

    await dbConnect();

    // 1. Reset all users' coins and stats to 0
    const usersReset = await User.updateMany(
      {},
      {
        $set: {
          bogxCoins: 0,
          points: 0,
          authorEarnings: 0,
          wins: 0,
          gamesPlayed: 0,
        },
      }
    );

    // 2. Delete all game history (rankings recompute from this)
    const gameResults = await GameResult.deleteMany({});

    // 3. Delete all battles (open/active/completed)
    const battles = await Battle.deleteMany({});

    // 4. Delete ranking snapshots (historical views recompute fresh)
    const snapshots = await DailyRanking.deleteMany({});

    return NextResponse.json({
      success: true,
      message: 'All users fully reset to 0 and game history cleared',
      usersReset: usersReset.modifiedCount,
      gameResultsDeleted: gameResults.deletedCount,
      battlesDeleted: battles.deletedCount,
      snapshotsDeleted: snapshots.deletedCount,
    });
  } catch (error: any) {
    console.error('Reset all users error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
