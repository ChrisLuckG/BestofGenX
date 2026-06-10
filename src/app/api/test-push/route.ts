import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import Notification from '@/models/Notification';
import webpush from 'web-push';

// Configure web-push
webpush.setVapidDetails(
  'mailto:admin@bestofgenx.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

// POST - Send a test push notification AND create a notification in the list
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    
    // Check if user has push subscription
    const hasPushSubscription = !!user.pushSubscription;
    
    // Create a notification in the database
    // If no push subscription, mark as read immediately (user will see it in the list anyway)
    const notification = await Notification.create({
      userId: userId,
      type: 'test',
      title: '🎉 Test Notification',
      message: `Hey ${user.username}, this is a test notification! Push notifications are working.`,
      read: !hasPushSubscription // Mark as read if no push subscription
    });
    
    // Now send push notification if subscription exists
    let pushSent = false;
    let pushError: string | null = null;
    
    if (!hasPushSubscription) {
      pushError = 'No push subscription. Enable push notifications in Notifications tab → Settings.';
    } else if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      pushError = 'Server VAPID keys missing - configure NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in env.';
    } else {
      try {
        const subscription = typeof user.pushSubscription === 'string' 
          ? JSON.parse(user.pushSubscription) 
          : user.pushSubscription;
          
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: '🎉 Test Notification!',
            body: `Hey ${user.username}, push is working!`,
            icon: '/images/genxlogo1.png',
            badge: '/images/genxlogo1.png',
            tag: 'test-push',
            url: '/mobile?tab=notifications'
          })
        );
        pushSent = true;
      } catch (err: any) {
        console.error('Push send error:', err);
        pushError = `${err.statusCode || 'Error'}: ${err.body || err.message || 'Unknown'}`;
        // Auto-cleanup if subscription is dead
        if (err.statusCode === 410 || err.statusCode === 404) {
          await User.findByIdAndUpdate(userId, { $unset: { pushSubscription: 1 } });
          pushError += ' (Subscription removed - please re-enable notifications)';
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: pushSent 
        ? 'Test notification created AND push sent!' 
        : `Test notification created in list. Push not sent: ${pushError}`,
      notificationId: notification._id,
      pushSent,
      pushError,
      hasPushSubscription
    });
    
  } catch (error: any) {
    console.error('Test push error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
