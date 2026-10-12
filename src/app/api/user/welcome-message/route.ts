import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import GameResult from '@/models/GameResult';
import { getUserLevel, getLevelIndex, getLevelProgress, LEVELS } from '@/utils/levels';
import { cache, CACHE_TTL } from '@/lib/cache';
import { berlinDateAt } from '@/lib/berlinTime';
import { buildWhileAwayEvents } from '@/lib/whileAwayEvents';

// GET - Personalized welcome data for the welcome-back screen.
// Returns ranking, points, streak, and "while you were away" events.
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    const user = await User.findById(userId).select(
      'bogxCoins lastSeenRank lastSeenRankAt pushSubscription username streak lastPlayedAt avatar'
    );

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Current rank = number of users with strictly more BOGX + 1
    const higherRanked = await User.countDocuments({ bogxCoins: { $gt: user.bogxCoins || 0 } });
    const currentRank = higherRanked + 1;

    const previousRank: number | null =
      typeof user.lastSeenRank === 'number' ? user.lastSeenRank : null;

    // Determine direction of change
    let rankChange: { from: number; to: number; direction: 'up' | 'down' | 'same' } | null = null;
    if (previousRank !== null && previousRank !== currentRank) {
      rankChange = {
        from: previousRank,
        to: currentRank,
        direction: currentRank > previousRank ? 'down' : 'up',
      };
    }

    // Total points (wallet balance)
    const totalPoints = user.bogxCoins || 0;

    // Points earned in the current ranking day (10:00 Berlin -> 10:00 Berlin).
    // GameResult has NO createdAt - it is `playedAt`. Matching on createdAt found
    // nothing, so "earned today" was always 0 and yesterday never had a winner.
    const now = new Date();
    const todayTen = berlinDateAt(0, 10);
    const todayStart = now >= todayTen ? todayTen : berlinDateAt(-1, 10);
    const yesterdayStart = now >= todayTen ? berlinDateAt(-1, 10) : berlinDateAt(-2, 10);

    const todayResults = await GameResult.aggregate([
      { $match: { userId: userId, playedAt: { $gte: todayStart } } },
      { $group: { _id: null, total: { $sum: '$pointsChange' } } },
    ]);
    const pointsToday = todayResults[0]?.total || 0;

    // Points needed to reach next rank
    let pointsToNextRank = 0;
    if (currentRank > 1) {
      const nextRankUser = await User.findOne({ bogxCoins: { $gt: totalPoints } })
        .sort({ bogxCoins: 1 })
        .select('bogxCoins')
        .lean();
      if (nextRankUser) {
        pointsToNextRank = (nextRankUser.bogxCoins || 0) - totalPoints + 1;
      }
    }

    // Streak (days in a row)
    const streak = user.streak || 0;

    // "While you were away" - player-related events (see src/lib/whileAwayEvents.ts)
    const since = user.lastSeenRankAt ? new Date(user.lastSeenRankAt) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [whileAwayEvents, totalPlayers] = await Promise.all([
      buildWhileAwayEvents({ userId, username: user.username, coins: totalPoints, since, todayStart, yesterdayStart }),
      cache.getOrFetch('welcome:totalPlayers', () => User.countDocuments({ isDeleted: { $ne: true } }), CACHE_TTL.MEDIUM),
    ]);

    // Daily reward ready (simple: always true for now, can be enhanced later)
    const dailyRewardReady = true;

    // Remember the previous lastSeenAt before updating
    const lastSeenAt = user.lastSeenRankAt ? user.lastSeenRankAt.toISOString() : null;

    // Persist the rank the user just saw
    user.lastSeenRank = currentRank;
    user.lastSeenRankAt = new Date();
    await user.save();

    // Level system - use wallet balance (bogxCoins), same as Rankings page
    const walletBalance = user.bogxCoins || 0;
    const userLevel = getUserLevel(walletBalance);
    const levelIndex = getLevelIndex(walletBalance);
    const levelProgress = getLevelProgress(walletBalance);
    const nextLevel = levelIndex < LEVELS.length - 1 ? LEVELS[levelIndex + 1] : null;
    const pointsToNextLevel = nextLevel ? nextLevel.minBogx - walletBalance : 0;

    return NextResponse.json({
      success: true,
      currentRank,
      previousRank,
      rankChange,
      totalPoints,
      pointsToday,
      pointsToNextRank,
      streak,
      whileAwayEvents,
      lastSeenAt,
      dailyRewardReady,
      totalPlayers,
      // Level data
      avatar: user.avatar || null,
      level: levelIndex + 1,
      levelName: userLevel.name,
      levelProgress,
      pointsToNextLevel,
    });
  } catch (error: any) {
    console.error('Failed to get welcome message:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
