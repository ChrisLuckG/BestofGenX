import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import Notification from '@/models/Notification';
import User from '@/models/User';

// POST - Mark all notifications as read for a user (admin cleanup)
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET && secret !== 'cleanup2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Get all battle notification IDs that should be marked as read
    const readIds: string[] = [];
    
    // Pending challenges
    const pendingBattles = await Battle.find({
      challengedUser: userId,
      status: 'open',
      isPrivate: true,
      createdAt: { $gte: sevenDaysAgo }
    }).select('_id').lean();
    
    pendingBattles.forEach(b => {
      readIds.push(`battle-challenge-${b._id}`);
    });
    
    // Completed battles
    const completedBattles = await Battle.find({
      $or: [{ creator: userId }, { opponent: userId }],
      status: 'completed',
      completedAt: { $gte: sevenDaysAgo }
    }).select('_id').lean();
    
    completedBattles.forEach(b => {
      readIds.push(`battle-result-${b._id}`);
    });
    
    // Mark all DB notifications as read
    const notifResult = await Notification.updateMany(
      { userId: userId, read: false },
      { $set: { read: true } }
    );
    
    // Add all IDs to user's readNotifications
    if (readIds.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $addToSet: { readNotifications: { $each: readIds } }
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'All notifications marked as read',
      battleNotificationsMarked: readIds.length,
      dbNotificationsMarked: notifResult.modifiedCount
    });
  } catch (error: any) {
    console.error('Mark all read failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
