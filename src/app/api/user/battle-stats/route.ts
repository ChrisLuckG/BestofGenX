import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';

// QuizzBattle record for the profile, derived from completed Battle documents.
//
// Net BOGX per battle mirrors saveBattleGameResult (src/lib/battleLedger.ts):
// +wager on a win, -wager on a loss, 0 on a tie - the escrowed stake is not a loss.
const TOPIC_LABELS: Record<string, string> = {
  music: 'Music', sport: 'Sport', film: 'Movies', games: 'Gaming', politik: 'Politik',
  culture: 'Culture', fashion: 'Fashion', tv: 'TV', art: 'Art', food: 'Food',
};
const round2 = (n: number) => Math.round(n * 100) / 100;

type Outcome = 'W' | 'L' | 'D';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });

  try {
    await dbConnect();
    const battles = await Battle.find({
      status: 'completed',
      $or: [{ creator: userId }, { opponent: userId }],
    })
      .select('creator opponent winner wager topic creatorResults opponentResults completedAt updatedAt')
      .sort({ completedAt: 1, updatedAt: 1 })
      .lean();

    let wins = 0, losses = 0, draws = 0, net = 0, biggestWin = 0;
    let rounds = 0, correct = 0, timeMs = 0;
    let bestStreak = 0, run = 0;
    const outcomes: Outcome[] = [];
    const topics = new Map<string, { played: number; wins: number }>();
    const rivals = new Map<string, { played: number; wins: number; losses: number; draws: number; net: number }>();

    for (const b of battles as any[]) {
      const isCreator = String(b.creator) === userId;
      const rivalId = String(isCreator ? b.opponent : b.creator);
      const mine = (isCreator ? b.creatorResults : b.opponentResults) || [];
      const wager = b.wager || 0;

      const outcome: Outcome = !b.winner ? 'D' : String(b.winner) === userId ? 'W' : 'L';
      outcomes.push(outcome);
      const delta = outcome === 'W' ? wager : outcome === 'L' ? -wager : 0;
      net += delta;
      if (outcome === 'W') { wins++; biggestWin = Math.max(biggestWin, wager); run++; bestStreak = Math.max(bestStreak, run); }
      else { run = 0; if (outcome === 'L') losses++; else draws++; }

      for (const r of mine) { rounds++; if (r.correct) correct++; timeMs += r.timeMs || 0; }

      const t = topics.get(b.topic) || { played: 0, wins: 0 };
      t.played++; if (outcome === 'W') t.wins++;
      topics.set(b.topic, t);

      if (b.opponent) {
        const r = rivals.get(rivalId) || { played: 0, wins: 0, losses: 0, draws: 0, net: 0 };
        r.played++; r.net += delta;
        if (outcome === 'W') r.wins++; else if (outcome === 'L') r.losses++; else r.draws++;
        rivals.set(rivalId, r);
      }
    }

    // Current streak: same outcome counted back from the most recent battle.
    let streak: { type: Outcome; count: number } | null = null;
    for (let i = outcomes.length - 1; i >= 0; i--) {
      if (!streak) streak = { type: outcomes[i], count: 1 };
      else if (outcomes[i] === streak.type) streak.count++;
      else break;
    }

    const topicList = Array.from(topics.entries()).map(([key, t]) => ({
      key, label: TOPIC_LABELS[key] || key, played: t.played, wins: t.wins,
      winRate: Math.round((t.wins / t.played) * 100),
    })).sort((a, b) => b.played - a.played);

    const topRivalIds = Array.from(rivals.entries()).sort((a, b) => b[1].played - a[1].played).slice(0, 3);
    const rivalUsers = await User.find({ _id: { $in: topRivalIds.map(([id]) => id) } })
      .select('username avatar isBot').lean() as { _id: unknown; username: string; avatar?: string; isBot?: boolean }[];
    const userById = new Map(rivalUsers.map(u => [String(u._id), u]));

    const played = battles.length;
    return NextResponse.json({
      success: true,
      played, wins, losses, draws,
      winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null,
      net: round2(net),
      biggestWin: round2(biggestWin),
      accuracy: rounds > 0 ? Math.round((correct / rounds) * 100) : null,
      avgAnswerSec: rounds > 0 ? Math.round(timeMs / rounds / 100) / 10 : null,
      streak,
      bestStreak,
      topics: topicList,
      rivals: topRivalIds.map(([id, r]) => ({
        id,
        username: userById.get(id)?.username || 'Unknown',
        avatar: userById.get(id)?.avatar || null,
        isBot: userById.get(id)?.isBot === true,
        ...r,
        net: round2(r.net),
      })),
    });
  } catch (error) {
    console.error('Battle stats error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load battle stats' }, { status: 500 });
  }
}
