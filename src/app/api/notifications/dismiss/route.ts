import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// POST - Dismiss a notification (or all)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { userId, notificationId, dismissAll } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }
    
    if (dismissAll) {
      // Mark all as dismissed by setting lastNotificationView to now
      await User.findByIdAndUpdate(userId, {
        lastNotificationView: new Date(),
        $set: { dismissedNotifications: [] } // Clear old dismissals
      });
    } else if (notificationId) {
      // Add single notification to dismissed list
      await User.findByIdAndUpdate(userId, {
        $addToSet: { dismissedNotifications: notificationId }
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to dismiss notification:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
