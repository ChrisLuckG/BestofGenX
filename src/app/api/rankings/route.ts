import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import DailyRanking from '@/models/DailyRanking';

// Rankings show points earned in the specific period only
// DAY = today's points, MONTH = this month's points, YEAR = this year's points
export async function GET(request: Request) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'day';
    const date = searchParams.get('date');
    
    // Get all users
    const allUsers = await User.find({})
      .select('username avatar country countryFlag points wins gamesPlayed')
      .lean();
    
    // Determine baseline date based on period
    let baselineDate: string;
    const now = new Date();
    
    if (period === 'day') {
      // Yesterday's snapshot
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      baselineDate = yesterday.toISOString().split('T')[0];
    } else if (period === 'month') {
      // Last day of previous month
      const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      baselineDate = lastDayPrevMonth.toISOString().split('T')[0];
    } else {
      // Last day of previous year (Dec 31)
      baselineDate = `${now.getFullYear() - 1}-12-31`;
    }
    
    // Get baseline snapshot
    const baselineSnapshot = await DailyRanking.findOne({ dateString: baselineDate });
    const baselineMap = new Map<string, number>();
    
    if (baselineSnapshot) {
      for (const entry of baselineSnapshot.rankings) {
        baselineMap.set(entry.userId?.toString() || '', entry.points || 0);
      }
    }
    
    // Calculate period points for each user
    const rankings = allUsers.map(user => {
      const oderId = user._id.toString();
      const baselinePoints = baselineMap.get(oderId) || 0;
      const periodPoints = (user.points || 0) - baselinePoints;
      return {
        _id: user._id.toString(),
        username: user.username,
        avatar: user.avatar || '',
        country: user.country || 'World',
        countryFlag: user.countryFlag || '🌍',
        points: periodPoints, // Points earned in this period only
        wins: user.wins || 0,
        gamesPlayed: user.gamesPlayed || 0,
        totalPoints: user.points || 0,
      };
    });
    
    // Sort by period points
    rankings.sort((a, b) => b.points - a.points || b.totalPoints - a.totalPoints);
    
    // Add ranks
    const rankedResults = rankings.slice(0, 100).map((r, index) => ({
      ...r,
      rank: index + 1,
    }));
    
    return NextResponse.json({ 
      rankings: rankedResults,
      period,
      isLive: true
    });
  } catch (error) {
    console.error('Rankings error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
