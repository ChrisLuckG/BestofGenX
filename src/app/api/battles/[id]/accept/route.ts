import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import { sendPushNotification } from '@/lib/webpush';

// POST - Accept a battle
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    
    const { opponentId } = await request.json();
    const battleId = params.id;
    
    if (!opponentId) {
      return NextResponse.json({ success: false, error: 'Missing opponentId' }, { status: 400 });
    }
    
    // Find battle
    const battle = await Battle.findById(battleId);
    if (!battle) {
      return NextResponse.json({ success: false, error: 'Battle not found' }, { status: 404 });
    }
    
    if (battle.status !== 'open') {
      return NextResponse.json({ success: false, error: 'Battle is not open' }, { status: 400 });
    }
    
    // Can't accept own battle
    if (battle.creator.toString() === opponentId) {
      return NextResponse.json({ success: false, error: 'Cannot accept your own battle' }, { status: 400 });
    }
    
    // Check opponent has enough points
    const opponent = await User.findById(opponentId);
    if (!opponent) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    
    if (opponent.points < battle.wager) {
      return NextResponse.json({ 
        success: false, 
        error: 'Not enough points',
        details: {
          required: battle.wager,
          available: opponent.points
        }
      }, { status: 400 });
    }
    
    // Deduct wager from opponent (with atomic check to prevent negative)
    const updateResult = await User.findOneAndUpdate(
      { _id: opponentId, points: { $gte: battle.wager } },
      { $inc: { points: -battle.wager } },
      { new: true }
    );
    
    if (!updateResult) {
      // Race condition - points changed between check and update
      const freshUser = await User.findById(opponentId);
      return NextResponse.json({ 
        success: false, 
        error: 'Not enough points',
        details: {
          required: battle.wager,
          available: freshUser?.points ?? 0
        }
      }, { status: 400 });
    }
    
    // Update battle
    battle.opponent = opponentId;
    battle.status = 'active';
    battle.acceptedAt = new Date();
    await battle.save();
    
    // Populate and return
    await battle.populate('creator', 'username avatar country countryFlag points isBot');
    await battle.populate('opponent', 'username avatar country countryFlag points isBot');
    
    // Send push notification to creator (if enabled)
    const creator = await User.findById(battle.creator._id || battle.creator);
    if (creator?.pushSubscription && creator?.notifyBattleAccepted !== false) {
      sendPushNotification(creator.pushSubscription, {
        title: '⚔️ Battle Accepted!',
        body: `${opponent.username} is playing your challenge right now! 🎮`,
        tag: `battle-accepted-${battle._id}`,
        url: '/battles',
        type: 'challenge'
      }).catch(console.error);
    }
    
    return NextResponse.json({ success: true, battle });
  } catch (error: any) {
    console.error('Failed to accept battle:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
