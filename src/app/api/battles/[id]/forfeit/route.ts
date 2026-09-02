import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import Notification from '@/models/Notification';
import { sendPushNotification } from '@/lib/webpush';
import { saveBattleGameResult } from '@/lib/battleLedger';

// POST - Forfeit an active battle (user gives up, opponent wins)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id } = await params;
    const { oderId } = await request.json();
    
    if (!oderId) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 });
    }
    
    // Find the battle
    const battle = await Battle.findById(id)
      .populate('creator', '_id username pushSubscription')
      .populate('opponent', '_id username pushSubscription');
    
    if (!battle) {
      return NextResponse.json({ success: false, error: 'Battle not found' }, { status: 404 });
    }
    
    if (battle.status !== 'active' && battle.status !== 'open') {
      return NextResponse.json({ success: false, error: 'Can only forfeit open or active battles' }, { status: 400 });
    }
    
    // Check if user is part of this battle
    const isCreator = battle.creator._id.toString() === oderId;
    const isOpponent = battle.opponent?._id.toString() === oderId;
    
    if (!isCreator && !isOpponent) {
      return NextResponse.json({ success: false, error: 'You are not part of this battle' }, { status: 403 });
    }
    
    // ── Open battle: nobody accepted yet, so only the creator's wager is at ───
    // stake. There is no opponent to award a pot to — cancel and refund.
    if (battle.status === 'open') {
      await User.findByIdAndUpdate(battle.creator._id, { $inc: { bogxCoins: battle.wager } });
      battle.status = 'cancelled';
      await battle.save();
      
      return NextResponse.json({
        success: true,
        cancelled: true,
        refunded: battle.wager,
        message: 'Battle cancelled before the opponent joined — wager refunded',
      });
    }
    
    // ── No-play cancel: you can't "forfeit" a game you never started ──────────
    // If the requesting user never armed the battle, this is a CANCEL, not a
    // forfeit. Refund BOTH players — nobody wins, nobody loses.
    //
    // "Started" means pressing START on the preparing screen (recorded by
    // /api/battles/[id]/start), NOT having answered a question. Keying this off the
    // results array alone let a player arm a battle, look at the first question and
    // leave with a full refund — burning the opponent's battle for free and leaving
    // a trail of armed-but-unplayed games behind.
    const creatorPlayed = (battle.creatorResults?.length || 0) > 0;
    const opponentPlayed = (battle.opponentResults?.length || 0) > 0;
    const userStarted = isCreator ? !!battle.creatorStartedAt : !!battle.opponentStartedAt;
    const userIsCommitted = userStarted || (isCreator ? creatorPlayed : opponentPlayed);

    if (!userIsCommitted) {
      // Refund both players
      await User.findByIdAndUpdate(battle.creator._id, { $inc: { bogxCoins: battle.wager } });
      if (battle.opponent?._id) {
        await User.findByIdAndUpdate(battle.opponent._id, { $inc: { bogxCoins: battle.wager } });
      }
      battle.status = 'cancelled';
      await battle.save();

      // Notify the other player (only if a human with push)
      const otherPlayer = isCreator ? battle.opponent : battle.creator;
      const canceller = isCreator ? battle.creator : battle.opponent;
      if ((otherPlayer as any)?.pushSubscription) {
        try {
          await sendPushNotification((otherPlayer as any).pushSubscription, {
            title: '⚠️ Battle Cancelled',
            body: `${(canceller as any)?.username || 'Opponent'} backed out before playing. Your ${battle.wager} wager was refunded.`,
            tag: `battle-cancelled-${battle._id}`,
            url: '/mobile?tab=arcade',
            type: 'challenge'
          });
        } catch (pushError) {
          console.error('Cancel push failed:', pushError);
        }
      }

      return NextResponse.json({
        success: true,
        cancelled: true,
        refunded: battle.wager,
        message: 'Battle cancelled before play — both players refunded',
      });
    }

    // Determine winner (the other player)
    const winnerId = isCreator ? battle.opponent?._id : battle.creator._id;
    const loserId = isCreator ? battle.creator._id : battle.opponent?._id;
    
    if (!winnerId) {
      return NextResponse.json({ success: false, error: 'No opponent found' }, { status: 400 });
    }
    
    // Get user details for notification
    const winner = await User.findById(winnerId);
    const loser = await User.findById(loserId);
    
    // Award full pot to winner (both wagers)
    const totalPot = battle.wager * 2;
    await User.findByIdAndUpdate(winnerId, {
      $inc: { bogxCoins: totalPot }
    });
    
    // Update battle
    battle.status = 'completed';
    battle.winner = winnerId;
    battle.forfeitedBy = loserId;
    battle.completedAt = new Date();
    await battle.save();
    
    // Journal the settlement. A forfeit is a real result - without these entries
    // the pot moves in the wallet but never in the rankings, and the two views
    // drift apart for good.
    await saveBattleGameResult(winnerId.toString(), loser?.username || 'opponent', battle.wager, true);
    if (loserId) {
      await saveBattleGameResult(loserId.toString(), winner?.username || 'opponent', -battle.wager, false);
    }
    
    // In-app notifications for BOTH sides. Without these the loser only saw the
    // notification derived from the battle document, which compared two empty result
    // arrays and told them the battle was "a tie" right after they gave up the pot.
    await Notification.create({
      userId: winnerId,
      type: 'battle_result',
      title: '🏆 Opponent Gave Up!',
      message: `${loser?.username || 'Your opponent'} gave up! +${battle.wager.toFixed(2)} BOGX earned.`,
      avatar: loser?.avatar,
      data: { battleId: battle._id.toString(), url: '/battles' }
    });
    if (loserId) {
      await Notification.create({
        userId: loserId,
        type: 'battle_result',
        title: '🏳️ Battle Forfeited',
        message: `You gave up. ${winner?.username || 'Your opponent'} takes the pot. -${battle.wager.toFixed(2)} BOGX lost.`,
        avatar: winner?.avatar,
        data: { battleId: battle._id.toString(), url: '/battles' }
      });
    }

    // Send push notification to winner
    if (winner?.pushSubscription) {
      try {
        await sendPushNotification(winner.pushSubscription, {
          title: 'Battle Won!',
          // Net gain, not the pot: the winner staked one wager themselves, so quoting
          // the full pot here contradicted the in-app message and the coin counter.
          body: `${loser?.username || 'Opponent'} gave up! +${battle.wager.toFixed(2)} BOGX earned.`,
          tag: `battle-forfeit-${battle._id}`,
          url: '/mobile?tab=arcade',
          type: 'challenge'
        });
      } catch (pushError) {
        console.error('Forfeit push failed:', pushError);
      }
    }
    
    // Dispatch event for UI update
    return NextResponse.json({ 
      success: true, 
      message: 'Battle forfeited',
      winner: winner?.username,
      amountLost: battle.wager
    });
    
  } catch (error: any) {
    console.error('Forfeit battle error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
