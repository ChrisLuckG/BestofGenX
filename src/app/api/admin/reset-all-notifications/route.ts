import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import Notification from '@/models/Notification';
import User from '@/models/User';

// POST - NUCLEAR OPTION: Reset ALL notifications for ALL users
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (secret !== 'cleanup2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    // 1. Mark ALL notifications in DB as read
    const notifResult = await Notification.updateMany(
      { read: false },
      { $set: { read: true } }
    );
    
    // 2. Get ALL battle IDs that could be notifications
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const allBattles = await Battle.find({
      createdAt: { $gte: sevenDaysAgo }
    }).select('_id').lean();
    
    // Create all possible notification IDs
    const allNotifIds: string[] = [];
    allBattles.forEach(b => {
      allNotifIds.push(`battle-challenge-${b._id}`);
      allNotifIds.push(`battle-result-${b._id}`);
      allNotifIds.push(`battle-active-${b._id}`);
    });
    
    // 3. Add ALL these IDs to ALL users' readNotifications
    const userResult = await User.updateMany(
      {},
      { $addToSet: { readNotifications: { $each: allNotifIds } } }
    );
    
    return NextResponse.json({ 
      success: true, 
      message: 'ALL notifications reset for ALL users',
      dbNotificationsMarkedRead: notifResult.modifiedCount,
      battleNotificationIds: allNotifIds.length,
      usersUpdated: userResult.modifiedCount
    });
  } catch (error: any) {
    console.error('Reset all failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
