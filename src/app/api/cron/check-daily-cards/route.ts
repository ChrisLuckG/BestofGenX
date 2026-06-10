import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Card from '@/models/Card';
import User from '@/models/User';
import webpush from 'web-push';

// Configure web-push
webpush.setVapidDetails(
  'mailto:admin@bestofgenx.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

// This cron job should run at 9:45 CET (15 minutes before game starts at 10:00)
// Vercel Cron: 45 7 * * * (7:45 UTC = 9:45 CET in summer, adjust for winter)

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Get today's date in German timezone
    const germanDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
    
    // Count active cards for today
    const todaysCards = await Card.countDocuments({ 
      active: true, 
      gameDate: germanDate 
    });
    
    console.log(`[Check Daily Cards] Date: ${germanDate}, Cards found: ${todaysCards}`);
    
    if (todaysCards === 0) {
      // No cards for today! Alert admins
      console.log('[Check Daily Cards] WARNING: No cards scheduled for today!');
      
      // Find all admin users with push subscriptions
      const admins = await User.find({ 
        isAdmin: true,
        pushSubscription: { $exists: true, $ne: null }
      });
      
      console.log(`[Check Daily Cards] Found ${admins.length} admins with push subscriptions`);
      
      const notifications = [];
      
      for (const admin of admins) {
        if (admin.pushSubscription) {
          try {
            const payload = JSON.stringify({
              title: '⚠️ No Cards for Today!',
              body: `Game starts in 15 minutes but no cards are scheduled for ${germanDate}. Add cards now!`,
              tag: 'admin-alert',
              url: '/admin'
            });
            
            await webpush.sendNotification(admin.pushSubscription, payload);
            notifications.push({ admin: admin.username, status: 'sent' });
          } catch (err: any) {
            console.error(`Failed to notify admin ${admin.username}:`, err.message);
            notifications.push({ admin: admin.username, status: 'failed', error: err.message });
          }
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        warning: true,
        message: 'No cards for today - admins notified',
        date: germanDate,
        cardsCount: 0,
        notifications
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      warning: false,
      message: `${todaysCards} cards ready for today`,
      date: germanDate,
      cardsCount: todaysCards
    });
    
  } catch (error: any) {
    console.error('Check daily cards error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST for manual trigger
export async function POST(request: NextRequest) {
  return GET(request);
}
