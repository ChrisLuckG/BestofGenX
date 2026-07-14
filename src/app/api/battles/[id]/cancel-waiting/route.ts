import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import { sendPushNotification } from '@/lib/webpush';

// POST - Cancel an active battle where you're waiting for opponent
// Both players get their wager refunded
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
    const battle = await Battle.findById(id);
    
    if (!battle) {
      return NextResponse.json({ success: false, error: 'Battle not found' }, { status: 404 });
    }
    
    // Check if battle is active
    if (battle.status !== 'active') {
      return NextResponse.json({ success: false, error: 'Battle is not active' }, { status: 400 });
    }
    
    // Check if user is part of this battle
    const isCreator = battle.creator.toString() === oderId;
    const isOpponent = battle.opponent?.toString() === oderId;
    
    if (!isCreator && !isOpponent) {
      return NextResponse.json({ success: false, error: 'You are not part of this battle' }, { status: 403 });
    }
    
    // Check that the requesting user has already played (they're waiting)
    const creatorPlayed = (battle.creatorResults?.length || 0) > 0;
    const opponentPlayed = (battle.opponentResults?.length || 0) > 0;
    
    const userHasPlayed = (isCreator && creatorPlayed) || (isOpponent && opponentPlayed);
    const otherHasPlayed = (isCreator && opponentPlayed) || (isOpponent && creatorPlayed);
    
    if (!userHasPlayed) {
      return NextResponse.json({ success: false, error: 'You must play first before you can cancel' }, { status: 400 });
    }
    
    if (otherHasPlayed) {
      return NextResponse.json({ success: false, error: 'Both players have played - battle should complete' }, { status: 400 });
    }
    
    // Refund both players
    await User.findByIdAndUpdate(battle.creator, {
      $inc: { bogxCoins: battle.wager }
    });
    
    if (battle.opponent) {
      await User.findByIdAndUpdate(battle.opponent, {
        $inc: { bogxCoins: battle.wager }
      });
    }
    
    // Update battle status
    battle.status = 'cancelled';
    await battle.save();
    
    // Notify the other player
    const otherPlayerId = isCreator ? battle.opponent : battle.creator;
    if (otherPlayerId) {
      const otherPlayer = await User.findById(otherPlayerId);
      const canceller = await User.findById(oderId);
      
      if (otherPlayer?.pushSubscription) {
        try {
          await sendPushNotification(otherPlayer.pushSubscription, {
            title: '⚠️ Battle Cancelled',
            body: `${canceller?.username || 'Opponent'} cancelled the battle. Your ${battle.wager} wager was refunded.`,
            tag: `battle-cancelled-${battle._id}`,
            url: '/mobile?tab=arcade',
            type: 'challenge'
          });
        } catch (pushError) {
          console.error('Cancel push failed:', pushError);
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Battle cancelled, both players refunded',
      refunded: battle.wager
    });
    
  } catch (error: any) {
    console.error('Cancel waiting battle error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
