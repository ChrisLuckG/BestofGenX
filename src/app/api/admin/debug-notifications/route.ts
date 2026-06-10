import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import Notification from '@/models/Notification';
import User from '@/models/User';

// GET - Debug notification count for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const userId = searchParams.get('userId');
    
    if (secret !== 'cleanup2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    await dbConnect();
    
    const user = await User.findById(userId).select('username dismissedNotifications readNotifications').lean();
    const dismissedIds = new Set((user?.dismissedNotifications || []).map(String));
    const readIds = new Set((user?.readNotifications || []).map(String));
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Pending challenges
    const pendingBattles = await Battle.find({
      challengedUser: userId,
      status: 'open',
      isPrivate: true,
      createdAt: { $gte: sevenDaysAgo }
    }).select('_id createdAt').lean();
    
    const pendingDetails = pendingBattles.map(b => ({
      id: b._id.toString(),
      notifId: `battle-challenge-${b._id}`,
      isDismissed: dismissedIds.has(`battle-challenge-${b._id}`),
      isRead: readIds.has(`battle-challenge-${b._id}`),
      createdAt: b.createdAt
    }));
    
    // Completed battles
    const completedBattles = await Battle.find({
      $or: [{ creator: userId }, { opponent: userId }],
      status: 'completed',
      completedAt: { $gte: sevenDaysAgo }
    }).select('_id completedAt').lean();
    
    const completedDetails = completedBattles.map(b => ({
      id: b._id.toString(),
      notifId: `battle-result-${b._id}`,
      isDismissed: dismissedIds.has(`battle-result-${b._id}`),
      isRead: readIds.has(`battle-result-${b._id}`),
      completedAt: b.completedAt
    }));
    
    // DB Notifications
    const dbNotifications = await Notification.find({
      userId: userId,
      read: false
    }).select('_id type title createdAt').lean();
    
    return NextResponse.json({ 
      success: true,
      username: user?.username,
      dismissedCount: dismissedIds.size,
      readCount: readIds.size,
      pendingChallenges: {
        total: pendingBattles.length,
        unread: pendingDetails.filter(p => !p.isDismissed && !p.isRead).length,
        details: pendingDetails
      },
      completedBattles: {
        total: completedBattles.length,
        unread: completedDetails.filter(c => !c.isDismissed && !c.isRead).length,
        details: completedDetails
      },
      dbNotifications: {
        unread: dbNotifications.length,
        details: dbNotifications
      }
    });
  } catch (error: any) {
    console.error('Debug failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
