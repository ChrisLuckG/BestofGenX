import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import DailyRanking from '@/models/DailyRanking';
import GameResult from '@/models/GameResult';
import { berlinDateAt } from '@/lib/berlinTime';

// Helper to get the "ranking day" date string
// The ranking day starts at 10:00 Berlin time
// So before 10:00 Berlin, we're still in "yesterday's" ranking day
function getRankingDayString(date: Date = new Date()): string {
  // Get Berlin time components
  const berlinStr = date.toLocaleString('en-CA', { 
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    hour12: false
  });
  const [datePart, timePart] = berlinStr.split(', ');
  const hour = parseInt(timePart?.split(':')[0] || '12');
  
  // If before 10:00 Berlin time, use yesterday's date
  if (hour < 10) {
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toLocaleString('en-CA', { 
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit'
    }).split(',')[0];
  }
  
  return datePart;
}

// Store recently active bot IDs (in-memory, resets on server restart)
let recentlyActiveBots: { oderId: string; pointsGained: number; timestamp: number }[] = [];

// Simulate bot activity and create GameResult entries
async function simulateBotActivity(): Promise<{ oderId: string; pointsGained: number }[]> {
  try {
    const bots = await User.find({ 
      $or: [
        { isBot: true },
        { email: { $regex: /@bot\.sporttock\.com$/ } }
      ]
    });
    
    if (bots.length === 0) return [];
    
    const today = new Date().toISOString().split('T')[0];
    
    // Pick 1-3 random bots to "play" each request
    const numBotsToPlay = Math.floor(Math.random() * 3) + 1;
    const shuffled = bots.sort(() => Math.random() - 0.5);
    const botsToPlay = shuffled.slice(0, Math.min(numBotsToPlay, bots.length));
    
    const activeBots: { oderId: string; pointsGained: number }[] = [];
    
    for (const bot of botsToPlay) {
      // Simulate realistic game: Easy (40%), Medium (35%), Hard (25%)
      const diffRoll = Math.random();
      const difficulty = diffRoll < 0.4 ? 1 : diffRoll < 0.75 ? 2 : 3;
      // BOGX rewards: 0.05-0.10 (easy), 0.10-0.20 (medium), 0.15-0.30 (hard)
      const maxReward = 0.10 * difficulty; // 0.10, 0.20, or 0.30 BOGX
      const penalty = difficulty === 1 ? 0.01 : difficulty === 2 ? 0.05 : 0.10;
      
      // 70% chance correct answer
      const isCorrect = Math.random() < 0.7;
      
      // If correct: random BOGX based on answer time (50%-100% of max)
      // If wrong: fixed penalty
      const pointsChange = isCorrect 
        ? Math.round((maxReward * (0.5 + Math.random() * 0.5)) * 100) / 100 // 0.05-0.10, 0.10-0.20, 0.15-0.30 BOGX
        : -penalty; // -0.01, -0.05, or -0.10 BOGX
      
      // Don't go below 0 points
      const safePointsChange = Math.max(-bot.points, pointsChange);
      
      // Update user points
      await User.findByIdAndUpdate(bot._id, {
        $inc: {
          points: safePointsChange,
          gamesPlayed: 1,
          wins: isCorrect ? 1 : 0,
        }
      });
      
      // Create GameResult entry for the bot (so they appear in daily rankings)
      await GameResult.create({
        userId: bot._id,
        username: bot.username,
        cardId: `bot-card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        question: 'Bot simulated question',
        userAnswer: isCorrect ? 'correct' : 'wrong',
        correctAnswer: 'correct',
        isCorrect,
        pointsChange: safePointsChange,
        pointsBefore: bot.points,
        pointsAfter: bot.points + safePointsChange,
        timeUsed: Math.floor(Math.random() * 10) + 1,
        difficulty,
        skipped: false,
        timedOut: false,
        gameDate: today,
      });
      
      activeBots.push({ oderId: bot._id.toString(), pointsGained: safePointsChange });
    }
    
    // Update recently active list (keep last 10 seconds)
    const now = Date.now();
    recentlyActiveBots = [
      ...recentlyActiveBots.filter(b => now - b.timestamp < 10000),
      ...activeBots.map(b => ({ ...b, timestamp: now }))
    ];
    
    return activeBots;
  } catch (e) {
    console.error('Bot simulation error:', e);
    return [];
  }
}

// POST: Save current rankings as daily snapshot
// This should be called by a cron job at midnight
export async function POST(request: Request) {
  try {
    // Optional: Add secret key check for security
    const { secret } = await request.json().catch(() => ({}));
    const expectedSecret = process.env.CRON_SECRET || 'sporttock-cron-2024';
    
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    // Get today's date string
    const now = new Date();
    const dateString = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Check if we already have a snapshot for today
    const existing = await DailyRanking.findOne({ dateString });
    if (existing) {
      return NextResponse.json({ 
        message: 'Snapshot already exists for today',
        dateString 
      });
    }
    
    // Get current rankings
    const users = await User.find({})
      .select('username avatar country countryFlag points wins')
      .sort({ points: -1 })
      .limit(100)
      .lean();
    
    // Create ranking entries
    const rankings = users.map((user, index) => ({
      userId: user._id,
      username: user.username,
      avatar: user.avatar || '',
      country: user.country || 'World',
      countryFlag: user.countryFlag || '🌍',
      points: user.points,
      wins: user.wins,
      rank: index + 1,
    }));
    
    // Save snapshot
    await DailyRanking.create({
      date: now,
      dateString,
      rankings,
    });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Daily ranking snapshot saved',
      dateString,
      usersCount: rankings.length
    });
  } catch (error) {
    console.error('Snapshot error:', error);
    return NextResponse.json({ error: 'Failed to save snapshot' }, { status: 500 });
  }
}

// GET: Get ranking snapshot for a specific date/month/year
export async function GET(request: Request) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'day'; // day, month, year
    const dateString = searchParams.get('date'); // YYYY-MM-DD format
    const monthString = searchParams.get('month'); // YYYY-MM format
    const yearString = searchParams.get('year'); // YYYY format
    
    // MONTH rankings - show points earned THIS MONTH ONLY
    // Calculated as: current points - points at end of previous month
    if (period === 'month') {
      const targetMonth = monthString || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      
      // Get previous month's end date for baseline
      const [year, month] = targetMonth.split('-').map(Number);
      const prevMonthDate = new Date(year, month - 1, 0); // Last day of previous month
      const prevMonthString = prevMonthDate.toISOString().split('T')[0];
      
      // Try to find previous month's snapshot
      const prevSnapshot = await DailyRanking.findOne({ dateString: prevMonthString });
      const prevPointsMap = new Map<string, number>();
      
      if (prevSnapshot) {
        for (const entry of prevSnapshot.rankings) {
          prevPointsMap.set(entry.userId?.toString() || '', entry.points || 0);
        }
      }
      
      // For current month, calculate: current points - previous month end points
      if (targetMonth === currentMonth) {
        const allUsers = await User.find({ 
          isDeleted: { $ne: true }
        })
          .select('username avatar country countryFlag points wins')
          .lean();
        
        // If no previous month snapshot, all points count for this month
        const hasPrevSnapshot = prevPointsMap.size > 0;
        
        const rankings = allUsers.map(user => {
          const oderId = user._id.toString();
          const prevPoints = prevPointsMap.get(oderId) || 0;
          const monthlyPoints = hasPrevSnapshot ? (user.points || 0) - prevPoints : (user.points || 0);
          return {
            _id: user._id,
            username: user.username,
            avatar: user.avatar || '',
            country: user.country || 'World',
            countryFlag: user.countryFlag || '🌍',
            points: monthlyPoints, // Points earned THIS MONTH only
            wins: user.wins || 0,
            totalPoints: user.points || 0,
            isActive: false,
            recentPoints: 0,
          };
        });
        
        // Sort by monthly points
        rankings.sort((a, b) => b.points - a.points || b.totalPoints - a.totalPoints);
        
        // Filter out users with 0 or negative points
        const activeRankings = rankings.filter(r => r.points > 0);
        
        const rankedResults = activeRankings.slice(0, 100).map((r, index) => ({
          ...r,
          rank: index + 1,
        }));
        
        return NextResponse.json({ 
          rankings: rankedResults,
          isLive: true,
          period: 'month',
          month: targetMonth
        });
      }
      
      // For historical months, calculate difference between end of that month and end of previous month
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      const endOfMonthDate = `${targetMonth}-${String(lastDayOfMonth).padStart(2, '0')}`;
      
      const endSnapshot = await DailyRanking.findOne({ dateString: endOfMonthDate });
      
      if (endSnapshot && prevSnapshot) {
        // Get deleted user IDs to filter them out
        const deletedUsers = await User.find({ isDeleted: true }).select('_id').lean();
        const deletedIds = new Set(deletedUsers.map(u => u._id.toString()));
        
        // Calculate difference for each user, filtering out deleted users
        const rankings = endSnapshot.rankings
          .filter((entry: any) => !deletedIds.has(entry.userId?.toString() || ''))
          .map((entry: any, index: number) => {
            const oderId = entry.userId?.toString() || '';
            const prevPoints = prevPointsMap.get(oderId) || 0;
            const monthlyPoints = (entry.points || 0) - prevPoints;
            return {
              ...entry,
              points: monthlyPoints,
              totalPoints: entry.points,
              rank: index + 1,
            };
          });
        
        // Re-sort by monthly points
        rankings.sort((a: any, b: any) => b.points - a.points);
        rankings.forEach((r: any, i: number) => r.rank = i + 1);
        
        return NextResponse.json({ 
          rankings: rankings.slice(0, 100),
          isLive: false,
          period: 'month',
          month: targetMonth
        });
      }
      
      // No snapshots found, return empty
      return NextResponse.json({ 
        rankings: [],
        isLive: false,
        period: 'month',
        month: targetMonth,
        message: 'No snapshot available for this month'
      });
    }
    
    // YEAR rankings - show points earned THIS YEAR ONLY
    // Calculated as: current points - points at end of previous year
    if (period === 'year') {
      const targetYear = yearString || `${new Date().getFullYear()}`;
      const currentYear = `${new Date().getFullYear()}`;
      
      // Get previous year's end date for baseline (Dec 31 of previous year)
      const prevYearEnd = `${parseInt(targetYear) - 1}-12-31`;
      
      // Try to find previous year's snapshot
      const prevSnapshot = await DailyRanking.findOne({ dateString: prevYearEnd });
      const prevPointsMap = new Map<string, number>();
      
      if (prevSnapshot) {
        for (const entry of prevSnapshot.rankings) {
          prevPointsMap.set(entry.userId?.toString() || '', entry.points || 0);
        }
      }
      
      // For current year, calculate: current points - previous year end points
      if (targetYear === currentYear) {
        const allUsers = await User.find({ 
          isDeleted: { $ne: true }
        })
          .select('username avatar country countryFlag points wins')
          .lean();
        
        // If no previous year snapshot, all points count for this year
        const hasPrevSnapshot = prevPointsMap.size > 0;
        
        const rankings = allUsers.map(user => {
          const oderId = user._id.toString();
          const prevPoints = prevPointsMap.get(oderId) || 0;
          const yearlyPoints = hasPrevSnapshot ? (user.points || 0) - prevPoints : (user.points || 0);
          return {
            _id: user._id,
            username: user.username,
            avatar: user.avatar || '',
            country: user.country || 'World',
            countryFlag: user.countryFlag || '🌍',
            points: yearlyPoints, // Points earned THIS YEAR only
            wins: user.wins || 0,
            totalPoints: user.points || 0,
            isActive: false,
            recentPoints: 0,
          };
        });
        
        // Sort by yearly points
        rankings.sort((a, b) => b.points - a.points || b.totalPoints - a.totalPoints);
        
        // Filter out users with 0 or negative points
        const activeRankings = rankings.filter(r => r.points > 0);
        
        const rankedResults = activeRankings.slice(0, 100).map((r, index) => ({
          ...r,
          rank: index + 1,
        }));
        
        return NextResponse.json({ 
          rankings: rankedResults,
          isLive: true,
          period: 'year',
          year: targetYear
        });
      }
      
      // For historical years, calculate difference
      const endOfYearDate = `${targetYear}-12-31`;
      const endSnapshot = await DailyRanking.findOne({ dateString: endOfYearDate });
      
      if (endSnapshot) {
        // Get deleted user IDs to filter them out
        const deletedUsers = await User.find({ isDeleted: true }).select('_id').lean();
        const deletedIds = new Set(deletedUsers.map(u => u._id.toString()));
        
        const rankings = endSnapshot.rankings
          .filter((entry: any) => !deletedIds.has(entry.userId?.toString() || ''))
          .map((entry: any, index: number) => {
            const oderId = entry.userId?.toString() || '';
            const prevPoints = prevPointsMap.get(oderId) || 0;
            const yearlyPoints = (entry.points || 0) - prevPoints;
            return {
              ...entry,
              points: yearlyPoints,
              totalPoints: entry.points,
              rank: index + 1,
            };
          });
        
        // Re-sort by yearly points
        rankings.sort((a: any, b: any) => b.points - a.points);
        rankings.forEach((r: any, i: number) => r.rank = i + 1);
        
        return NextResponse.json({ 
          rankings: rankings.slice(0, 100),
          isLive: false,
          period: 'year',
          year: targetYear
        });
      }
      
      // No snapshot found
      return NextResponse.json({ 
        rankings: [],
        isLive: false,
        period: 'year',
        year: targetYear,
        message: 'No snapshot available for this year'
      });
    }
    
    // DAY rankings - show points earned TODAY ONLY
    // The "day" starts at 10:00 Berlin time (after the 9:00-10:00 break)
    // So we use the snapshot from the previous "ranking day"
    const today = getRankingDayString(); // Uses Berlin time, accounts for 10:00 cutoff
    
    // Get previous ranking day's date for baseline
    // This is the snapshot taken at 9:00 Berlin time (before the break)
    const todayDate = new Date(today + 'T00:00:00Z');
    const prevDay = new Date(todayDate);
    prevDay.setDate(prevDay.getDate() - 1);
    const yesterdayString = prevDay.toISOString().split('T')[0];
    
    // Try to find previous day's snapshot (taken at 9:00 Berlin time)
    const prevSnapshot = await DailyRanking.findOne({ dateString: yesterdayString });
    const prevPointsMap = new Map<string, number>();
    
    if (prevSnapshot) {
      for (const entry of prevSnapshot.rankings) {
        prevPointsMap.set(entry.userId?.toString() || '', entry.points || 0);
      }
    }
    
    // For today (current ranking day), calculate from GameResults
    if (!dateString || dateString === today) {
      const hasPrevSnapshot = prevPointsMap.size > 0;
      
      // Aggregate today's GameResults to get daily points
      const todayResults = await GameResult.aggregate([
        { $match: { gameDate: today } },
        { 
          $group: { 
            _id: '$userId',
            username: { $first: '$username' },
            dailyPoints: { $sum: '$pointsChange' },
            gamesPlayed: { $sum: 1 },
            wins: { $sum: { $cond: ['$isCorrect', 1, 0] } }
          } 
        }
      ]);
      
      // Get user details for avatars etc
      const userIds = todayResults.map(r => r._id);
      const users = await User.find({ _id: { $in: userIds } })
        .select('username avatar country countryFlag points')
        .lean();
      
      const userMap = new Map(users.map(u => [u._id.toString(), u]));
      
      const rankings = todayResults.map(result => {
        const user = userMap.get(result._id?.toString() || '') || {};
        return {
          _id: result._id,
          username: result.username || (user as any).username || 'Unknown',
          avatar: (user as any).avatar || '',
          country: (user as any).country || 'World',
          countryFlag: (user as any).countryFlag || '🌍',
          points: Math.round(result.dailyPoints * 100) / 100, // Points earned TODAY
          wins: result.wins || 0,
          totalPoints: (user as any).points || 0,
          gamesPlayed: result.gamesPlayed || 0,
          isActive: false,
          recentPoints: 0,
        };
      });
      
      // Sort by daily points
      rankings.sort((a, b) => b.points - a.points || b.totalPoints - a.totalPoints);
      
      // Filter out users with 0 or negative points
      const activeRankings = rankings.filter(r => r.points > 0);
      
      const rankedResults = activeRankings.slice(0, 100).map((r, index) => ({
        ...r,
        rank: index + 1,
      }));
      
      return NextResponse.json({ 
        rankings: rankedResults,
        isLive: true,
        date: today
      });
    }
    
    // For historical dates, calculate difference from previous day
    const prevDate = new Date(dateString);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateString = prevDate.toISOString().split('T')[0];
    
    const daySnapshot = await DailyRanking.findOne({ dateString });
    const prevDaySnapshot = await DailyRanking.findOne({ dateString: prevDateString });
    
    if (daySnapshot && prevDaySnapshot) {
      // Get deleted user IDs to filter them out
      const deletedUsers = await User.find({ isDeleted: true }).select('_id').lean();
      const deletedIds = new Set(deletedUsers.map(u => u._id.toString()));
      
      const prevDayMap = new Map<string, number>();
      for (const entry of prevDaySnapshot.rankings) {
        prevDayMap.set(entry.userId?.toString() || '', entry.points || 0);
      }
      
      const rankings = daySnapshot.rankings
        .filter((entry: any) => !deletedIds.has(entry.userId?.toString() || ''))
        .map((entry: any, index: number) => {
          const oderId = entry.userId?.toString() || '';
          const prevPoints = prevDayMap.get(oderId) || 0;
          const dailyPoints = (entry.points || 0) - prevPoints;
          return {
            ...entry,
            points: dailyPoints,
            totalPoints: entry.points,
            rank: index + 1,
          };
        });
      
      // Re-sort by daily points
      rankings.sort((a: any, b: any) => b.points - a.points);
      rankings.forEach((r: any, i: number) => r.rank = i + 1);
      
      return NextResponse.json({ 
        rankings: rankings.slice(0, 100),
        isLive: false,
        date: dateString
      });
    }
    
    // No snapshot found for this date
    return NextResponse.json({ 
      rankings: [],
      isLive: false,
      date: dateString,
      message: 'No snapshot available for this date'
    });
  } catch (error) {
    console.error('Get snapshot error:', error);
    return NextResponse.json({ error: 'Failed to get rankings' }, { status: 500 });
  }
}
