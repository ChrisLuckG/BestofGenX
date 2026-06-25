import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import DailyRanking from '@/models/DailyRanking';
import GameResult from '@/models/GameResult';
import { berlinDateAt, berlinOffsetMinutes } from '@/lib/berlinTime';

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

// ============================================================
// PERIOD BOUNDARIES — all aligned to the 10:00 Berlin cutoff.
// The "ranking day" runs from 10:00 Berlin to the next 10:00.
// Months/years start at 10:00 Berlin on the 1st / Jan 1st so
// that every period shares the SAME boundary as the day.
// We filter by the GameResult.playedAt timestamp (precise),
// NOT by the midnight-based gameDate string.
// ============================================================

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

// Build rankings from the GameResult collection (single source of truth) over a
// [start, end) playedAt window. This guarantees consistency across day/month/year
// (e.g. month always includes today) since they all sum the same events.
async function buildPeriodRankings(startInstant: Date, endInstant?: Date) {
  const playedAtMatch: any = { $gte: startInstant };
  if (endInstant) playedAtMatch.$lt = endInstant;

  const results = await GameResult.aggregate([
    { $match: { playedAt: playedAtMatch } },
    {
      $group: {
        _id: '$userId',
        username: { $first: '$username' },
        periodPoints: { $sum: '$pointsChange' },
        gamesPlayed: { $sum: 1 },
        wins: { $sum: { $cond: ['$isCorrect', 1, 0] } },
        lastPlayedAt: { $max: '$playedAt' },
      },
    },
  ]);

  const userIds = results.map(r => r._id);
  const users = await User.find({ _id: { $in: userIds }, isDeleted: { $ne: true } })
    .select('username avatar country countryFlag bogxCoins isBot botActive')
    .lean();
  const userMap = new Map(users.map(u => [u._id.toString(), u]));

  const ONLINE_THRESHOLD_MS = 10 * 60 * 1000;
  const nowMs = Date.now();

  const rankings = results
    .filter(r => userMap.has(r._id?.toString() || '')) // exclude deleted users
    .map(result => {
      const user = userMap.get(result._id?.toString() || '') as any;
      const isBot = user.isBot === true;
      const lastPlayed = result.lastPlayedAt ? new Date(result.lastPlayedAt).getTime() : 0;
      const isOnline = isBot ? user.botActive !== false : (nowMs - lastPlayed) < ONLINE_THRESHOLD_MS;
      return {
        _id: result._id,
        username: result.username || user.username || 'Unknown',
        avatar: user.avatar || '',
        country: user.country || 'World',
        countryFlag: user.countryFlag || '🌍',
        points: Math.round(result.periodPoints * 100) / 100,
        wins: result.wins || 0,
        totalPoints: user.bogxCoins || 0,
        gamesPlayed: result.gamesPlayed || 0,
        isActive: false,
        isOnline,
        isBot,
        recentPoints: 0,
      };
    });

  rankings.sort((a, b) => b.points - a.points || b.totalPoints - a.totalPoints);
  const active = rankings.filter(r => r.points > 0);
  return active.slice(0, 100).map((r, index) => ({ ...r, rank: index + 1 }));
}

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

// Store recently active bot IDs (in-memory, resets on server restart)
let recentlyActiveBots: { oderId: string; pointsGained: number; timestamp: number }[] = [];

// Throttle bot activity: bots play roughly every 5-15 minutes (spread over the day).
// IMPORTANT: On serverless (Vercel) each request can be a fresh instance, so an
// in-memory throttle does NOT persist and bots would "play" on nearly every request,
// massively inflating daily totals. We therefore gate on the most recent bot
// GameResult timestamp stored in the database.
const BOT_PLAY_INTERVAL_MS = 5 * 60 * 1000; // minimum 5 minutes between bot sims

async function maybeSimulateBotActivity() {
  // Only during active hours (10:00 - 09:00 Berlin, skip the 9-10 break)
  const berlinHour = parseInt(new Date().toLocaleString('en-US', { 
    timeZone: 'Europe/Berlin', hour: '2-digit', hour12: false 
  }));
  if (berlinHour === 9) return; // matchday break
  
  // DB-backed throttle: find the latest bot-sim GameResult and skip if too recent.
  const lastBotResult = await GameResult.findOne({ cardId: { $regex: /^bot-card-/ } })
    .sort({ playedAt: -1 })
    .select('playedAt')
    .lean();
  
  if (lastBotResult?.playedAt) {
    const elapsed = Date.now() - new Date(lastBotResult.playedAt).getTime();
    if (elapsed < BOT_PLAY_INTERVAL_MS) return;
  }
  
  await simulateBotActivity();
}

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
    
    // Use Berlin time to match ranking system
    const today = new Date().toLocaleString('en-CA', { 
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit'
    }).split(',')[0];
    
    // Pick 1-3 random bots to "play" each request
    const numBotsToPlay = Math.floor(Math.random() * 3) + 1;
    const shuffled = bots.sort(() => Math.random() - 0.5);
    const botsToPlay = shuffled.slice(0, Math.min(numBotsToPlay, bots.length));
    
    const activeBots: { oderId: string; pointsGained: number }[] = [];
    
    for (const bot of botsToPlay) {
      // Simulate realistic game: Easy (40%), Medium (35%), Hard (25%)
      const diffRoll = Math.random();
      const difficulty = diffRoll < 0.4 ? 1 : diffRoll < 0.75 ? 2 : 3;
      // BOGX scale matches real gameplay (same as cron/bot-activity)
      const maxReward = 0.10 * difficulty; // 0.10, 0.20, or 0.30 BOGX
      
      // 70% chance correct answer
      const isCorrect = Math.random() < 0.7;
      
      // If correct: random BOGX based on answer time (50%-100% of max)
      // If wrong: fixed penalty
      const penalty = difficulty === 1 ? 0.01 : difficulty === 2 ? 0.05 : 0.10;
      const pointsChange = isCorrect 
        ? Math.round((maxReward * (0.5 + Math.random() * 0.5)) * 100) / 100 // 0.05-0.10, 0.10-0.20, 0.15-0.30
        : -penalty; // -0.01, -0.05, or -0.10 BOGX
      
      // Don't go below 0 BOGX
      const safePointsChange = Math.max(-(bot.bogxCoins || 0), pointsChange);
      
      // Update user BOGX
      await User.findByIdAndUpdate(bot._id, {
        $inc: {
          bogxCoins: safePointsChange,
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
        pointsBefore: bot.bogxCoins || 0,
        pointsAfter: (bot.bogxCoins || 0) + safePointsChange,
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
    
    // Get current rankings (lifetime wallet balance = bogxCoins)
    const users = await User.find({})
      .select('username avatar country countryFlag bogxCoins wins')
      .sort({ bogxCoins: -1 })
      .limit(100)
      .lean();
    
    // Create ranking entries
    const rankings = users.map((user, index) => ({
      userId: user._id,
      username: user.username,
      avatar: user.avatar || '',
      country: user.country || 'World',
      countryFlag: user.countryFlag || '🌍',
      points: user.bogxCoins || 0,
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
    
    // MONTH rankings - coins earned THIS MONTH (10:00 Berlin on the 1st → now).
    // Unified source: sum of GameResult.pointsChange in the period window.
    if (period === 'month') {
      const now = new Date();
      const cur = berlinParts(now);
      const targetMonth = monthString || `${cur.year}-${String(cur.month).padStart(2, '0')}`;
      const currentMonth = `${cur.year}-${String(cur.month).padStart(2, '0')}`;
      const [y, m] = targetMonth.split('-').map(Number);

      const start = berlinInstant(y, m, 1, 10);
      const isCurrent = targetMonth === currentMonth;
      // Also trigger bot activity on month view
      if (isCurrent) await maybeSimulateBotActivity();
      // Historical month ends at 10:00 Berlin on the 1st of the next month
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;
      const end = isCurrent ? undefined : berlinInstant(nextY, nextM, 1, 10);

      const rankings = await buildPeriodRankings(start, end);
      return NextResponse.json(
        { rankings, isLive: isCurrent, period: 'month', month: targetMonth },
        { headers: NO_CACHE_HEADERS }
      );
    }
    
    // YEAR rankings - coins earned THIS YEAR (10:00 Berlin on Jan 1st → now).
    // Unified source: sum of GameResult.pointsChange in the period window.
    if (period === 'year') {
      const now = new Date();
      const cur = berlinParts(now);
      const targetYear = yearString || `${cur.year}`;
      const currentYear = `${cur.year}`;
      const y = Number(targetYear);

      const start = berlinInstant(y, 1, 1, 10);
      const isCurrent = targetYear === currentYear;
      // Historical year ends at 10:00 Berlin on Jan 1st of the next year
      const end = isCurrent ? undefined : berlinInstant(y + 1, 1, 1, 10);

      const rankings = await buildPeriodRankings(start, end);
      return NextResponse.json(
        { rankings, isLive: isCurrent, period: 'year', year: targetYear },
        { headers: NO_CACHE_HEADERS }
      );
    }
    
    // DAY rankings - show points earned TODAY ONLY
    // The "day" starts at 10:00 Berlin time (after the 9:00-10:00 break)
    // So we use the snapshot from the previous "ranking day"
    const today = getRankingDayString(); // Uses Berlin time, accounts for 10:00 cutoff
    
    // For today (current ranking day), calculate from GameResults using the
    // precise 10:00 Berlin boundary (playedAt >= ranking day start).
    if (!dateString || dateString === today) {
      // Let bots play occasionally (throttled, spread over the day)
      await maybeSimulateBotActivity();
      
      const rankedResults = await buildPeriodRankings(rankingDayStartInstant());
      
      return NextResponse.json(
        { rankings: rankedResults, isLive: true, date: today },
        { headers: NO_CACHE_HEADERS }
      );
    }
    
    // Historical day: the ranking day labelled D runs from D 10:00 Berlin to
    // D+1 09:00 Berlin (the 09:00-10:00 window is the daily break, excluded).
    // Same unified GameResult source as the live day/month/year views.
    const [dy, dm, dd] = dateString.split('-').map(Number);
    const dayStart = berlinInstant(dy, dm, dd, 10);
    // Compute the next calendar day for the break boundary
    const nextCal = new Date(Date.UTC(dy, dm - 1, dd + 1));
    const dayEnd = berlinInstant(
      nextCal.getUTCFullYear(),
      nextCal.getUTCMonth() + 1,
      nextCal.getUTCDate(),
      9 // break starts at 09:00 → day ends here
    );

    const rankedResults = await buildPeriodRankings(dayStart, dayEnd);

    return NextResponse.json(
      { rankings: rankedResults, isLive: false, date: dateString },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Get snapshot error:', error);
    return NextResponse.json({ error: 'Failed to get rankings' }, { status: 500 });
  }
}
