import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import GameResult from '@/models/GameResult';
import { berlinDateAt } from '@/lib/berlinTime';

// POST - Reconcile wallet (bogxCoins) and the GameResult ledger so they MATCH.
// Two modes:
//   mode=walletFromLedger  → SET wallet = sum of all GameResults (trust the ledger).
//                            Use for BOTS or any wallet that was artificially set.
//   mode=ledgerFromWallet  → ADD an adjustment GameResult = (wallet - ledger)
//                            (trust the wallet; for real users with untracked bonuses).
// Targets: ?username=X (single) or ?all=true&bots=true / &realUsers=true
// Usage: POST /api/admin/coin-audit?secret=cleanup2024&mode=walletFromLedger&all=true&bots=true
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    if (searchParams.get('secret') !== 'cleanup2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const username = searchParams.get('username');
    const mode = searchParams.get('mode') || 'walletFromLedger';
    const all = searchParams.get('all') === 'true';
    const botsOnly = searchParams.get('bots') === 'true';
    const realOnly = searchParams.get('realUsers') === 'true';

    // Build the target filter
    const filter: any = {};
    if (username) filter.username = username;
    else if (botsOnly) filter.isBot = true;
    else if (realOnly) filter.isBot = { $ne: true };
    else if (!all) {
      return NextResponse.json({ error: 'Specify ?username, or ?all=true with &bots=true / &realUsers=true' }, { status: 400 });
    }

    const users = await User.find(filter).select('_id username bogxCoins').lean();

    const today = new Date().toLocaleString('en-CA', {
      timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
    }).split(',')[0];

    const adjustments: any[] = [];
    for (const u of users) {
      const userId = (u as any)._id.toString();
      const agg = await GameResult.aggregate([
        { $match: { userId } },
        { $group: { _id: null, sum: { $sum: '$pointsChange' } } }
      ]);
      const wallet = Math.round(((u as any).bogxCoins || 0) * 100) / 100;
      const lifetime = Math.round((agg[0]?.sum || 0) * 100) / 100;
      const gap = Math.round((wallet - lifetime) * 100) / 100;

      if (gap === 0) continue;

      if (mode === 'walletFromLedger') {
        // Trust the ledger: set the wallet to the lifetime GameResult sum
        await User.findByIdAndUpdate(userId, { $set: { bogxCoins: lifetime } });
        adjustments.push({ username: (u as any).username, walletBefore: wallet, walletAfter: lifetime });
      } else {
        // Trust the wallet: add an adjustment GameResult to close the gap
        await GameResult.create({
          userId,
          username: (u as any).username || 'Unknown',
          cardId: 'reconcile-adjustment',
          question: 'Balance reconciliation (untracked earnings)',
          userAnswer: null,
          correctAnswer: '-',
          isCorrect: gap > 0,
          pointsChange: gap,
          pointsBefore: lifetime,
          pointsAfter: wallet,
          timeUsed: 0,
          difficulty: 1,
          skipped: false,
          timedOut: false,
          gameDate: today,
        });
        adjustments.push({ username: (u as any).username, addedToLedger: gap });
      }
    }

    return NextResponse.json({ success: true, mode, reconciled: adjustments.length, adjustments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Diagnostic: shows WHY wallet (bogxCoins) and ranking (today's GameResults) differ.
// Usage: GET /api/admin/coin-audit?username=Bacon77
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const userIdParam = searchParams.get('userId');

    const user = username
      ? await User.findOne({ username }).select('_id username bogxCoins').lean()
      : await User.findById(userIdParam).select('_id username bogxCoins').lean();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = (user as any)._id.toString();

    // Ranking day start (10:00 Berlin) - same as rankings
    const now = new Date();
    const todayTen = berlinDateAt(0, 10);
    const todayStart = now.getTime() >= todayTen.getTime() ? todayTen : berlinDateAt(-1, 10);

    // Lifetime sum of ALL GameResults
    const lifetime = await GameResult.aggregate([
      { $match: { userId } },
      { $group: { _id: null, sum: { $sum: '$pointsChange' }, count: { $sum: 1 } } }
    ]);

    // Today's sum (what the ranking shows)
    const today = await GameResult.aggregate([
      { $match: { userId, playedAt: { $gte: todayStart } } },
      { $group: { _id: null, sum: { $sum: '$pointsChange' }, count: { $sum: 1 } } }
    ]);

    // Before today (leftover wallet from previous days)
    const before = await GameResult.aggregate([
      { $match: { userId, playedAt: { $lt: todayStart } } },
      { $group: { _id: null, sum: { $sum: '$pointsChange' }, count: { $sum: 1 } } }
    ]);

    const walletBalance = Math.round(((user as any).bogxCoins || 0) * 100) / 100;
    const lifetimeSum = Math.round((lifetime[0]?.sum || 0) * 100) / 100;
    const todaySum = Math.round((today[0]?.sum || 0) * 100) / 100;
    const beforeSum = Math.round((before[0]?.sum || 0) * 100) / 100;

    // Recent 15 GameResults for inspection
    const recent = await GameResult.find({ userId })
      .sort({ playedAt: -1 })
      .limit(15)
      .select('cardId pointsChange playedAt isCorrect')
      .lean();

    return NextResponse.json({
      username: (user as any).username,
      todayStart: todayStart.toISOString(),
      summary: {
        walletBalance,            // shown in coin pill + profile
        rankingTodaySum: todaySum, // shown in leaderboard TODAY
        lifetimeGameResultSum: lifetimeSum,
        beforeTodaySum: beforeSum,
        // Discrepancy explanations:
        walletVsLifetime: Math.round((walletBalance - lifetimeSum) * 100) / 100, // !=0 means coins earned WITHOUT a GameResult
        walletVsToday: Math.round((walletBalance - todaySum) * 100) / 100,        // = beforeTodaySum if everything tracked
      },
      recentResults: recent,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
