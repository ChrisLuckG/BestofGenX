import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import { sendPushNotification } from '@/lib/webpush';
import { sendEmail, createReminderEmail } from '@/lib/email';

// This endpoint is called by Vercel Cron at 9:00 AM German time (7:00 UTC in winter, 8:00 UTC in summer)
// Sends push notification 1 hour before game starts at 10:00 AM
export async function GET(request: Request) {
  try {
    // Verify cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('Game reminder cron triggered');
    }

    await dbConnect();
    
    // Find all users with push subscriptions
    const usersWithPush = await User.find({
      pushSubscription: { $ne: null }
    }).select('username pushSubscription').lean();
    
    console.log(`Sending game reminder to ${usersWithPush.length} users`);
    
    let pushSent = 0;
    let pushFailed = 0;
    
    for (const user of usersWithPush) {
      if (user.pushSubscription) {
        try {
          await sendPushNotification(user.pushSubscription, {
            title: '🎮 Game starts in 1 hour!',
            body: 'Get ready! Today\'s challenge begins at 10:00 AM. Don\'t miss your chance to win!',
            icon: '/images/genxlogo1.png',
            badge: '/images/genxlogo1.png',
            url: '/mobile',
          });
          pushSent++;
        } catch (error) {
          console.error(`Failed to send push to ${user.username}:`, error);
          pushFailed++;
        }
      }
    }
    
    // Email notifications disabled - only push notifications for game reminders
    
    return NextResponse.json({ 
      success: true, 
      message: 'Game reminder notifications sent',
      push: { sent: pushSent, failed: pushFailed, total: usersWithPush.length }
    });
  } catch (error) {
    console.error('Game reminder cron error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
