import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import Notification from '@/models/Notification';
import User from '@/models/User';

// GET - Get unread notification count
// Counts: pending challenges (not dismissed) + unread notifications
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }
    
    // Get user's dismissed and read notifications
    const user = await User.findById(userId).select('dismissedNotifications readNotifications').lean();
    const dismissedIds = new Set((user?.dismissedNotifications || []).map(String));
    const readIds = new Set((user?.readNotifications || []).map(String));
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Get pending challenges (someone challenged you)
    const pendingBattles = await Battle.find({
      challengedUser: userId,
      status: 'open',
      isPrivate: true,
      createdAt: { $gte: sevenDaysAgo }
    }).select('_id').lean();
    
    // Dismissed counts as read - if user dismissed, they saw it
    const pendingChallenges = pendingBattles.filter(b => {
      const notifId = `battle-challenge-${b._id}`;
      return !dismissedIds.has(notifId) && !readIds.has(notifId);
    }).length;
    
    // Get completed battles (results)
    const completedBattles = await Battle.find({
      $or: [{ creator: userId }, { opponent: userId }],
      status: 'completed',
      completedAt: { $gte: sevenDaysAgo }
    }).select('_id').lean();
    
    const unreadResults = completedBattles.filter(b => {
      const notifId = `battle-result-${b._id}`;
      return !dismissedIds.has(notifId) && !readIds.has(notifId);
    }).length;
    
    // Count unread notifications from Notification collection
    // Also need to exclude dismissed ones
    const dbNotifications = await Notification.find({
      userId: userId,
      read: false
    }).select('_id').lean();
    
    const unreadNotifications = dbNotifications.filter(n => {
      const notifId = `notif-${n._id}`;
      return !dismissedIds.has(notifId) && !readIds.has(notifId);
    }).length;
    
    // Note: We don't count "active" battles (opponent playing) as they are transient
    const totalCount = pendingChallenges + unreadResults + unreadNotifications;
    
    console.log('📊 Notification count debug:', {
      userId,
      dismissedCount: dismissedIds.size,
      readCount: readIds.size,
      pendingChallenges,
      unreadResults,
      unreadNotifications,
      totalCount
    });
    
    return NextResponse.json({ 
      success: true, 
      count: totalCount,
      breakdown: {
        challenges: pendingChallenges,
        results: unreadResults,
        notifications: unreadNotifications
      }
    });
  } catch (error: any) {
    console.error('Failed to get notification count:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
