import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    
    const user = await User.findById(params.id).select('-password');
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Calculate additional stats
    const winRate = user.gamesPlayed > 0 
      ? (user.wins / user.gamesPlayed) * 100 
      : 0;

    // Get user's rank
    const higherRanked = await User.countDocuments({ points: { $gt: user.points } });
    const rank = higherRanked + 1;

    // TODO: These would come from a GameHistory collection in a real app
    // For now, we'll simulate some stats based on existing data
    const avgAnswerTime = user.gamesPlayed > 0 
      ? 3 + Math.random() * 5 // Simulated: 3-8 seconds
      : null;
    
    const accuracy = user.gamesPlayed > 0 
      ? 50 + (user.wins / Math.max(user.gamesPlayed, 1)) * 50 // Simulated based on win rate
      : null;

    return NextResponse.json({
      _id: user._id,
      username: user.username,
      avatar: user.avatar,
      country: user.country,
      countryFlag: user.countryFlag,
      points: user.points,
      wins: user.wins,
      gamesPlayed: user.gamesPlayed,
      createdAt: user.createdAt,
      rank,
      winRate,
      avgAnswerTime,
      accuracy,
      currentStreak: null, // TODO: Implement streak tracking
      bestStreak: null,    // TODO: Implement streak tracking
    });

  } catch (error: any) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user stats' },
      { status: 500 }
    );
  }
}
