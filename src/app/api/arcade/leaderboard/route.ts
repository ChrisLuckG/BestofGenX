import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import ArcadeScore from '@/models/ArcadeScore';
import User from '@/models/User';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const game = searchParams.get('game') || 'bogx-invaders';
    const limit = parseInt(searchParams.get('limit') || '10');

    // Aggregate to get best score per user for this game
    const topScores = await ArcadeScore.aggregate([
      { $match: { game: game } },
      { $sort: { score: -1 } },
      { $group: {
        _id: '$userId',
        score: { $max: '$score' },
        username: { $first: '$username' },
        avatar: { $first: '$avatar' },
      }},
      { $sort: { score: -1 } },
      { $limit: limit }
    ]);

    // Fetch country flags for the ranked users
    const userIds = topScores.map((s: { _id: string }) => s._id).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } }).select('countryFlag');
    const flagMap = new Map(users.map((u: { _id: { toString: () => string }; countryFlag: string }) => [u._id.toString(), u.countryFlag]));

    const leaderboard = topScores.map((result: { _id: string; username: string; avatar: string; score: number }, index: number) => ({
      rank: index + 1,
      userId: result._id?.toString() || '',
      username: result.username || 'Unknown',
      avatar: result.avatar || '/images/default-avatar.png',
      countryFlag: flagMap.get(result._id?.toString()) || '',
      score: result.score,
    }));

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json({ leaderboard: [] });
  }
}
