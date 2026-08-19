import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import GameResult from '@/models/GameResult';
import { berlinDateAt, berlinOffsetMinutes } from '@/lib/berlinTime';

// Current Berlin calendar parts + hour
function berlinParts(date: Date = new Date()) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour === '24' ? '0' : map.hour),
  };
}

// UTC Date for a specific Berlin wall-clock Y-M-D at hour:00 (DST-safe)
function berlinInstant(year: number, month1to12: number, day: number, hour: number): Date {
  const provisional = new Date(Date.UTC(year, month1to12 - 1, day, hour, 0, 0));
  const offset = berlinOffsetMinutes(provisional);
  return new Date(provisional.getTime() - offset * 60000);
}

// Start of the CURRENT ranking day = most recent 10:00 Berlin boundary
function rankingDayStartInstant(now: Date = new Date()): Date {
  const todayTen = berlinDateAt(0, 10);
  return now.getTime() >= todayTen.getTime() ? todayTen : berlinDateAt(-1, 10);
}

// Start of the CURRENT ranking month = 10:00 Berlin on the 1st
function rankingMonthStartInstant(now: Date = new Date()): Date {
  const { year, month } = berlinParts(now);
  return berlinInstant(year, month, 1, 10);
}

// Start of the CURRENT ranking year = 10:00 Berlin on Jan 1st
function rankingYearStartInstant(now: Date = new Date()): Date {
  const { year } = berlinParts(now);
  return berlinInstant(year, 1, 1, 10);
}

// Build rankings and find user's position
async function getUserRankInPeriod(userId: string, startInstant: Date): Promise<number> {
  const results = await GameResult.aggregate([
    { $match: { playedAt: { $gte: startInstant } } },
    {
      $group: {
        _id: '$userId',
        periodPoints: { $sum: '$pointsChange' },
      },
    },
    { $match: { periodPoints: { $gt: 0 } } },
    { $sort: { periodPoints: -1 } },
  ]);

  // Find user's position (1-based) - compare as strings
  const userIndex = results.findIndex(r => r._id?.toString() === userId);
  return userIndex !== -1 ? userIndex + 1 : 0;
}

// Get rank positions for daily, monthly, yearly periods
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ dailyRank: 0, monthlyRank: 0, yearlyRank: 0 });
    }

    await dbConnect();

    const now = new Date();
    const dayStart = rankingDayStartInstant(now);
    const monthStart = rankingMonthStartInstant(now);
    const yearStart = rankingYearStartInstant(now);

    const [dailyRank, monthlyRank, yearlyRank] = await Promise.all([
      getUserRankInPeriod(userId, dayStart),
      getUserRankInPeriod(userId, monthStart),
      getUserRankInPeriod(userId, yearStart),
    ]);

    return NextResponse.json({
      dailyRank,
      monthlyRank,
      yearlyRank,
    });
  } catch (error) {
    console.error('Error fetching rank positions:', error);
    return NextResponse.json({ dailyRank: 0, monthlyRank: 0, yearlyRank: 0 });
  }
}
