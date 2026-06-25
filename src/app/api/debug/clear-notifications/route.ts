import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import Notification from '@/models/Notification';
import Battle from '@/models/Battle';

// POST - Clear all notifications for a user (DEBUG ONLY)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }
    
    // Delete all notifications from Notification collection
    const deletedNotifications = await Notification.deleteMany({ userId });
    
    // Clear dismissed notifications array
    await User.findByIdAndUpdate(userId, {
      $set: { dismissedNotifications: [] },
      lastNotificationView: new Date()
    });
    
    // Cancel all open challenges TO this user (refund creators)
    const openChallenges = await Battle.find({
      challengedUser: userId,
      status: 'open',
      isPrivate: true
    });
    
    for (const battle of openChallenges) {
      // Refund creator
      await User.findByIdAndUpdate(battle.creator, {
        $inc: { bogxCoins: battle.wager }
      });
      // Cancel battle
      battle.status = 'cancelled';
      await battle.save();
    }
    
    return NextResponse.json({ 
      success: true, 
      deleted: {
        notifications: deletedNotifications.deletedCount,
        challengesCancelled: openChallenges.length
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
