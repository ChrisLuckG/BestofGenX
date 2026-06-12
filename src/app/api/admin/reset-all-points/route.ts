import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import DailyRanking from '@/models/DailyRanking';
import GameResult from '@/models/GameResult';

// POST: Reset all user points to 0 and create a fresh snapshot
export async function POST(request: Request) {
  try {
    await dbConnect();
    
    // Reset all user stats to 0
    const result = await User.updateMany(
      { isDeleted: { $ne: true } },
      { 
        $set: { 
          points: 0,
          wins: 0,
          gamesPlayed: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          totalAnswerTime: 0,
          bogxCoins: 0,
          coins: 0
        } 
      }
    );
    
    // Delete all existing snapshots (fresh start)
    await DailyRanking.deleteMany({});
    
    // Delete all game results (fresh start)
    await GameResult.deleteMany({});
    
    // Create a snapshot for today with everyone at 0
    const today = new Date().toLocaleString('en-CA', { 
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit'
    }).split(',')[0];
    
    const allUsers = await User.find({ isDeleted: { $ne: true } })
      .select('username avatar country countryFlag points wins')
      .lean();
    
    const rankings = allUsers.map((user, index) => ({
      userId: user._id,
      username: user.username,
      avatar: user.avatar || '',
      country: user.country || 'World',
      countryFlag: user.countryFlag || '🌍',
      points: 0,
      wins: user.wins || 0,
      rank: index + 1,
    }));
    
    await DailyRanking.create({
      date: new Date(),
      dateString: today,
      rankings,
    });
    
    return NextResponse.json({ 
      success: true, 
      message: `Reset ${result.modifiedCount} users to 0 points. Fresh snapshot created for ${today}.`,
      usersReset: result.modifiedCount,
      snapshotDate: today
    });
  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json({ error: 'Failed to reset' }, { status: 500 });
  }
}
