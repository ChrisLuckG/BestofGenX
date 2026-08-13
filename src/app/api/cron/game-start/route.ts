import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import Game from '@/models/Game';
import Card from '@/models/Card';
import { sendPushNotification } from '@/lib/webpush';
import { sendEmail, createNewMatchEmail } from '@/lib/email';

// This endpoint is called by Vercel Cron at 10:00 AM German time (8:00 UTC)
// Creates new Game entry and sends notifications
export async function GET(request: Request) {
  try {
    // Verify cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('Game start cron triggered');
    }

    await dbConnect();
    
    // Create or update today's game
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const displayDate = today.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    // Get the next game number
    const lastGame = await Game.findOne().sort({ gameNumber: -1 });
    const nextGameNumber = lastGame ? lastGame.gameNumber + 1 : 1;
    
    // Count today's cards
    const todayCards = await Card.countDocuments({ gameDate: dateStr, active: true });
    
    // Create or update game
    const game = await Game.findOneAndUpdate(
      { date: dateStr },
      {
        $setOnInsert: { gameNumber: nextGameNumber },
        date: dateStr,
        displayDate,
        status: 'active',
        totalCards: todayCards,
      },
      { upsert: true, new: true }
    );
    
    console.log(`Game ${game.gameNumber} started for ${displayDate} with ${todayCards} cards`);
    
    // Send push notifications
    const usersWithPush = await User.find({
      pushSubscription: { $ne: null }
    }).select('username pushSubscription').lean();
    
    console.log(`Sending game start notification to ${usersWithPush.length} push users`);
    
    let pushSent = 0;
    let pushFailed = 0;
    
    for (const user of usersWithPush) {
      if (user.pushSubscription) {
        try {
          await sendPushNotification(user.pushSubscription, {
            title: '🎮 Neues Spiel gestartet!',
            body: 'Die heutige Challenge ist live! Teste jetzt dein Wissen und sammle Punkte!',
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
    
    // Email notifications disabled - only push notifications for game start
    
    return NextResponse.json({ 
      success: true, 
      message: 'Game start notifications sent',
      push: { sent: pushSent, failed: pushFailed, total: usersWithPush.length }
    });
  } catch (error) {
    console.error('Game start cron error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
