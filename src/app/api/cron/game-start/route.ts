import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Game from '@/models/Game';
import Card from '@/models/Card';
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
    
    
    return NextResponse.json({ 
      success: true, 
      message: 'Game started',
      gameNumber: game.gameNumber,
    });
  } catch (error) {
    console.error('Game start cron error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
