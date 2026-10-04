import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import Battle from '@/models/Battle';

// GET - Compact player info for the QuizzBattle scoreboard: overall rank, wallet
// balance and the real quizzbattle record for up to 4 users at once.
//
// Deliberately NOT /api/users/[id]/stats: that route runs three GameResult
// aggregations plus a full Battle scan per user, which is far too much for a
// banner that only needs a rank and a win count - and the scoreboard needs it
// for TWO users at the same time.
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const ids = (searchParams.get('ids') || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)
      .slice(0, 4);

    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: 'ids required' }, { status: 400 });
    }

    const users = await User.find({ _id: { $in: ids } })
      .select('_id username avatar country countryFlag bogxCoins wins gamesPlayed')
      .lean();

    const players = await Promise.all(users.map(async (u: any) => {
      const coins = u.bogxCoins || 0;
      // Rank by wallet balance, same definition the leaderboard uses.
      const [higherRanked, battles] = await Promise.all([
        User.countDocuments({
          bogxCoins: { $gt: coins },
          isReporter: { $ne: true },
          isAIReporter: { $ne: true },
          isDeleted: { $ne: true },
        }),
        Battle.find({
          status: 'completed',
          $or: [{ creator: String(u._id) }, { opponent: String(u._id) }],
        }).select('winner').lean(),
      ]);

      let battleWins = 0;
      let battleLosses = 0;
      for (const b of battles as any[]) {
        if (!b.winner) continue; // ties count for neither side
        if (String(b.winner) === String(u._id)) battleWins += 1;
        else battleLosses += 1;
      }

      return {
        _id: String(u._id),
        username: u.username,
        avatar: u.avatar,
        country: u.country,
        countryFlag: u.countryFlag,
        coins: Math.round(coins * 100) / 100,
        rank: higherRanked + 1,
        battleWins,
        battleLosses,
      };
    }));

    // Head-to-head, but only for an actual pairing. "60W 103L overall" says nothing
    // about the matchup on screen - "you lead 3:1 against this player" does.
    let h2h: { wins: Record<string, number>; ties: number; total: number } | null = null;
    if (ids.length === 2) {
      const [a, b] = ids;
      const direct = await Battle.find({
        status: 'completed',
        $or: [
          { creator: a, opponent: b },
          { creator: b, opponent: a },
        ],
      }).select('winner').lean();

      const wins: Record<string, number> = { [a]: 0, [b]: 0 };
      let ties = 0;
      for (const battle of direct as any[]) {
        const winner = battle.winner ? String(battle.winner) : null;
        if (!winner) { ties += 1; continue; }
        if (wins[winner] !== undefined) wins[winner] += 1;
      }
      h2h = { wins, ties, total: direct.length };
    }

    return NextResponse.json({ success: true, players, h2h });
  } catch (error: any) {
    console.error('battle-info error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
