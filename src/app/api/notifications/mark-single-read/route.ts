import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import Notification from '@/models/Notification';

// POST - Mark a single notification as read (but NOT dismissed)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { userId, notificationId } = await request.json();
    
    if (!userId || !notificationId) {
      return NextResponse.json({ success: false, error: 'Missing userId or notificationId' }, { status: 400 });
    }
    
    // If it's a notification from the Notification collection, mark it as read
    if (notificationId.startsWith('notif-')) {
      const mongoId = notificationId.replace('notif-', '');
      await Notification.findByIdAndUpdate(mongoId, { read: true });
    }
    
    // For battle notifications, add to a "read" list (not dismissed)
    // We use a separate field to track read vs dismissed
    await User.findByIdAndUpdate(userId, {
      $addToSet: { readNotifications: notificationId }
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to mark notification as read:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
