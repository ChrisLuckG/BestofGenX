import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import Notification from '@/models/Notification';
import Battle from '@/models/Battle';

// POST - Mark notifications as read
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }
    
    // Mark all notifications as read in Notification collection
    await Notification.updateMany(
      { userId: userId, read: false },
      { $set: { read: true } }
    );
    
    // Get all pending challenges and add them to dismissed list
    // This way they won't be counted as "new" anymore
    const pendingChallenges = await Battle.find({
      challengedUser: userId,
      status: 'open',
      isPrivate: true
    }).select('_id').lean();
    
    const challengeIds = pendingChallenges.map(b => `battle-challenge-${b._id}`);
    
    // Update user's lastNotificationView and add challenge IDs to dismissed
    if (challengeIds.length > 0) {
      await User.findByIdAndUpdate(userId, {
        lastNotificationView: new Date(),
        $addToSet: { dismissedNotifications: { $each: challengeIds } }
      });
    } else {
      await User.findByIdAndUpdate(userId, {
        lastNotificationView: new Date()
      });
    }
    
    return NextResponse.json({ success: true, markedRead: challengeIds.length });
  } catch (error: any) {
    console.error('Failed to mark notifications as read:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
