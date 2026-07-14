import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import { sendPushNotification } from '@/lib/webpush';

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
    
    // Check if battle is active
    if (battle.status !== 'active') {
      return NextResponse.json({ success: false, error: 'Can only forfeit active battles' }, { status: 400 });
    }
    
    // Check if user is part of this battle
    const isCreator = battle.creator._id.toString() === oderId;
    const isOpponent = battle.opponent?._id.toString() === oderId;
    
    if (!isCreator && !isOpponent) {
      return NextResponse.json({ success: false, error: 'You are not part of this battle' }, { status: 403 });
    }
    
    // ── No-play cancel: you can't "forfeit" a game you never started ──────────
    // If the requesting user hasn't played a single round yet, this is a CANCEL,
    // not a forfeit. Refund BOTH players — nobody wins, nobody loses.
    const creatorPlayed = (battle.creatorResults?.length || 0) > 0;
    const opponentPlayed = (battle.opponentResults?.length || 0) > 0;
    const userHasPlayed = (isCreator && creatorPlayed) || (isOpponent && opponentPlayed);

    if (!userHasPlayed) {
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
    battle.completedAt = new Date();
    await battle.save();
    
    // Send push notification to winner
    if (winner?.pushSubscription) {
      try {
        await sendPushNotification(winner.pushSubscription, {
          title: '🏆 Battle Won!',
          body: `${loser?.username || 'Opponent'} forfeited! You won ${totalPot.toFixed(2)} BOGX!`,
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
