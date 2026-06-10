import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import { sendPushNotification } from '@/lib/webpush';

// POST - Decline a battle challenge (refunds creator)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    
    const { oderId } = await request.json();
    const battleId = params.id;
    
    if (!oderId) {
      return NextResponse.json({ success: false, error: 'Missing user ID' }, { status: 400 });
    }
    
    // Find the battle
    const battle = await Battle.findById(battleId);
    
    if (!battle) {
      return NextResponse.json({ success: false, error: 'Battle not found' }, { status: 404 });
    }
    
    // Check if battle is still open
    if (battle.status !== 'open') {
      return NextResponse.json({ success: false, error: 'Battle is no longer open' }, { status: 400 });
    }
    
    // Check if user is the challenged user
    if (battle.challengedUser?.toString() !== oderId) {
      return NextResponse.json({ success: false, error: 'You are not the challenged user' }, { status: 403 });
    }
    
    // Get users for notification
    const decliner = await User.findById(oderId);
    const creator = await User.findById(battle.creator);
    
    // Refund the creator
    await User.findByIdAndUpdate(battle.creator, {
      $inc: { points: battle.wager }
    });
    
    // Cancel the battle
    battle.status = 'cancelled';
    await battle.save();
    
    // Send push notification to creator that challenge was declined
    if (creator?.pushSubscription) {
      try {
        await sendPushNotification(creator.pushSubscription, {
          title: '😔 Challenge Declined',
          body: `${decliner?.username || 'Your opponent'} declined your ${battle.topic.toUpperCase()} battle. ${battle.wager} coins refunded.`,
          tag: `battle-declined-${battle._id}`,
          url: '/mobile?tab=notifications',
          type: 'challenge'
        });
      } catch (pushError) {
        console.error('Decline push failed:', pushError);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Challenge declined and creator refunded'
    });
    
  } catch (error: any) {
    console.error('Failed to decline battle:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
