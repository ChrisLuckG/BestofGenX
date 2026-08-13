import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import GameResult from '@/models/GameResult';
import { sendPushNotification } from '@/lib/webpush';
import { sendEmail, createResultsEmail } from '@/lib/email';

// This endpoint is called by Vercel Cron at 9:00 AM German time (7:00 UTC)
// Sends push notification when game ends
export async function GET(request: Request) {
  try {
    // Verify cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('Game ending cron triggered');
    }

    await dbConnect();
    
    // Get yesterday's date for results
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // Get rankings for yesterday
    const rankings = await GameResult.aggregate([
      { $match: { gameDate: yesterdayStr } },
      { 
        $group: {
          _id: '$userId',
          dailyPoints: { $sum: '$pointsChange' }
        }
      },
      { $match: { dailyPoints: { $gt: 0 } } },
      { $sort: { dailyPoints: -1 } }
    ]);
    
    const rankMap = new Map(rankings.map((r, i) => [r._id.toString(), { rank: i + 1, points: r.dailyPoints }]));
    
    // Find all users with push subscriptions
    const usersWithPush = await User.find({
      pushSubscription: { $ne: null }
    }).select('_id username pushSubscription').lean();
    
    console.log(`Sending game ending notification to ${usersWithPush.length} users`);
    
    let pushSent = 0;
    let pushFailed = 0;
    
    for (const user of usersWithPush) {
      if (user.pushSubscription) {
        try {
          const userRank = rankMap.get(user._id.toString());
          const formattedPoints = userRank ? Number(userRank.points).toFixed(2) : '0';
          const rankText = userRank ? `Du bist #${userRank.rank} mit ${formattedPoints} Punkten!` : 'Schau dir das Ranking an!';
          
          await sendPushNotification(user.pushSubscription, {
            title: '🏆 Ergebnisse sind da!',
            body: rankText,
            icon: '/images/genxlogo1.png',
            badge: '/images/genxlogo1.png',
            url: '/mobile?tab=rankings',
          });
          pushSent++;
        } catch (error) {
          console.error(`Failed to send push to ${user.username}:`, error);
          pushFailed++;
        }
      }
    }
    
    // Email notifications disabled - only push notifications for game results
    
    return NextResponse.json({ 
      success: true, 
      message: 'Game ending notifications sent',
      push: { sent: pushSent, failed: pushFailed, total: usersWithPush.length }
    });
  } catch (error) {
    console.error('Game ending cron error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
