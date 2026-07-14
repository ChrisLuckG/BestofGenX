import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import GameResult from '@/models/GameResult';
import { getUserLevel, getLevelIndex, getLevelProgress, LEVELS } from '@/utils/levels';

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

    // Points earned today (since 10:00 Berlin time)
    const now = new Date();
    const berlinOffset = 2; // CEST
    const todayStart = new Date(now);
    todayStart.setUTCHours(10 - berlinOffset, 0, 0, 0);
    if (now < todayStart) todayStart.setDate(todayStart.getDate() - 1);

    const todayResults = await GameResult.aggregate([
      { $match: { userId: userId, createdAt: { $gte: todayStart } } },
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

    // "While you were away" events - always show interesting info
    const whileAwayEvents: any[] = [];
    
    // 1. Find users who overtook this user since last visit
    if (user.lastSeenRankAt && previousRank && currentRank > previousRank) {
      const overtakers = await User.find({
        bogxCoins: { $gt: totalPoints },
        lastPlayedAt: { $gte: user.lastSeenRankAt },
      })
        .sort({ bogxCoins: -1 })
        .limit(2)
        .select('username avatar bogxCoins')
        .lean();
      
      for (const ot of overtakers) {
        const otRank = await User.countDocuments({ bogxCoins: { $gt: ot.bogxCoins || 0 } }) + 1;
        whileAwayEvents.push({
          type: 'overtook',
          avatar: ot.avatar,
          text: `${ot.username} overtook you`,
          highlight: `Now #${otRank}`,
        });
      }
    }

    // 2. Yesterday's winner (from GameResult aggregation)
    try {
      const GameResult = (await import('@/models/GameResult')).default;
      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStart = new Date(yesterdayDate);
      yesterdayStart.setHours(0, 0, 0, 0);
      const yesterdayEnd = new Date(yesterdayDate);
      yesterdayEnd.setHours(23, 59, 59, 999);
      
      const topYesterday = await GameResult.aggregate([
        { $match: { createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd } } },
        { $group: { _id: '$userId', points: { $sum: '$pointsChange' } } },
        { $sort: { points: -1 } },
        { $limit: 1 },
      ]);
      
      if (topYesterday.length > 0 && topYesterday[0].points > 0) {
        const winnerId = topYesterday[0]._id;
        const winnerUser = await User.findById(winnerId).select('username avatar country').lean();
        if (winnerUser && (winnerUser as any).username !== user.username) {
          const country = (winnerUser as any).country;
          const countryText = country ? ` from ${country}` : '';
          whileAwayEvents.push({
            type: 'winner',
            icon: '👑',
            avatar: (winnerUser as any).avatar,
            text: `${(winnerUser as any).username}${countryText} won yesterday`,
            highlight: `+${topYesterday[0].points.toFixed(1)} BOGX`,
          });
        }
      }
    } catch (e) {
      // Skip if aggregation fails
    }

    // 3. Total players in community
    const totalPlayers = await User.countDocuments({});
    if (totalPlayers > 10) {
      whileAwayEvents.push({
        type: 'community',
        text: `You're #${currentRank} of`,
        highlight: `${totalPlayers.toLocaleString()} players`,
      });
    }

    // 4. New players joined (last 24h)
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const newPlayersCount = await User.countDocuments({ createdAt: { $gte: yesterday } });
    if (newPlayersCount > 0) {
      whileAwayEvents.push({
        type: 'newPlayers',
        text: `${newPlayersCount} new player${newPlayersCount > 1 ? 's' : ''}`,
        highlight: 'joined today',
      });
    }

    // 5. Battles played recently (if Battle model exists)
    try {
      const Battle = (await import('@/models/Battle')).default;
      const battlesLast24h = await Battle.countDocuments({ 
        createdAt: { $gte: yesterday },
        status: 'completed'
      });
      if (battlesLast24h > 0) {
        whileAwayEvents.push({
          type: 'battles',
          icon: '⚔️',
          text: `${battlesLast24h} battle${battlesLast24h > 1 ? 's' : ''} played`,
          highlight: 'in the last 24h',
        });
      }
    } catch (e) {
      // Skip if Battle model doesn't exist
    }

    // 6. Top battle winner (most BOGX won in battles yesterday)
    try {
      const Battle = (await import('@/models/Battle')).default;
      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStart = new Date(yesterdayDate);
      yesterdayStart.setHours(0, 0, 0, 0);
      const yesterdayEnd = new Date(yesterdayDate);
      yesterdayEnd.setHours(23, 59, 59, 999);
      
      const topBattler = await Battle.aggregate([
        { $match: { completedAt: { $gte: yesterdayStart, $lte: yesterdayEnd }, status: 'completed' } },
        { $group: { _id: '$winner', wins: { $sum: 1 } } },
        { $sort: { wins: -1 } },
        { $limit: 1 },
      ]);
      
      if (topBattler.length > 0 && topBattler[0].wins >= 2) {
        const battlerId = topBattler[0]._id;
        const battlerUser = await User.findById(battlerId).select('username avatar country').lean();
        if (battlerUser && (battlerUser as any).username !== user.username) {
          whileAwayEvents.push({
            type: 'topBattler',
            icon: '🏆',
            avatar: (battlerUser as any).avatar,
            text: `${(battlerUser as any).username} dominated battles`,
            highlight: `${topBattler[0].wins} wins`,
          });
        }
      }
    } catch (e) {
      // Skip if aggregation fails
    }

    // 7. User's streak info
    if (streak > 1) {
      whileAwayEvents.push({
        type: 'streak',
        icon: '🔥',
        text: `You're on a ${streak}-day streak!`,
        highlight: 'Keep it going',
      });
    }

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
