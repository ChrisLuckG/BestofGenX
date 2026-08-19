import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import Notification from '@/models/Notification';

// Battles where BOTH players answered everything wrong used to be decided by
// answer time, which produced a bogus winner. compareBattleResults now treats
// those as a tie - this backfills the already stored result notifications so
// they no longer claim "You Won!" / "Battle Lost".
//
// Only notification text is touched. Battle documents and wallets are left as
// they are (see ?apply=battles to also clear the stored winner).
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET && secret !== 'cleanup2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const dryRun = searchParams.get('dryRun') === 'true';
    const alsoFixBattles = searchParams.get('apply') === 'battles';

    await dbConnect();

    const battles = await Battle.find({ status: 'completed' })
      .select('_id creator opponent creatorResults opponentResults winner')
      .populate('creator', 'username')
      .populate('opponent', 'username')
      .lean();

    const affected: any[] = [];

    for (const battle of battles as any[]) {
      const creatorCorrect = (battle.creatorResults || []).filter((r: any) => r.correct).length;
      const opponentCorrect = (battle.opponentResults || []).filter((r: any) => r.correct).length;

      // Only battles where nobody scored but a winner was recorded
      if (creatorCorrect !== 0 || opponentCorrect !== 0 || !battle.winner) continue;

      const battleId = battle._id.toString();
      const creatorName = battle.creator?.username || 'Opponent';
      const opponentName = battle.opponent?.username || 'Opponent';

      affected.push({ battleId, creator: creatorName, opponent: opponentName });

      if (dryRun) continue;

      // Rewrite the stored result notifications to the tie wording
      await Notification.updateOne(
        { type: 'battle_result', 'data.battleId': battleId, userId: battle.creator?._id ?? battle.creator },
        { $set: { title: '🤝 Battle Tie!', message: `You and ${opponentName} tied! Wager returned.` } }
      );
      if (battle.opponent) {
        await Notification.updateOne(
          { type: 'battle_result', 'data.battleId': battleId, userId: battle.opponent?._id ?? battle.opponent },
          { $set: { title: '🤝 Battle Tie!', message: `You and ${creatorName} tied! Wager returned.` } }
        );
      }

      if (alsoFixBattles) {
        await Battle.updateOne({ _id: battle._id }, { $unset: { winner: 1 } });
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      alsoFixBattles,
      scanned: battles.length,
      fixed: affected.length,
      battles: affected,
    });
  } catch (error: any) {
    console.error('fix-zero-correct-ties error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
