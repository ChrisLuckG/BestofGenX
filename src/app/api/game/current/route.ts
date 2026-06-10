import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Game from '@/models/Game';

// GET - Get current or latest game info
export async function GET() {
  try {
    await dbConnect();
    
    const today = new Date().toISOString().split('T')[0];
    
    // Try to find today's game first
    let game = await Game.findOne({ date: today });
    
    // If no game today, get the latest one
    if (!game) {
      game = await Game.findOne().sort({ gameNumber: -1 });
    }
    
    // If still no game, return default (Game 1)
    if (!game) {
      const displayDate = new Date().toLocaleDateString('de-DE', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
      
      return NextResponse.json({
        success: true,
        game: {
          gameNumber: 1,
          date: today,
          displayDate,
          status: 'active',
          totalPlayers: 0,
          totalCards: 0,
        },
        isDefault: true,
      });
    }
    
    return NextResponse.json({
      success: true,
      game: {
        gameNumber: game.gameNumber,
        date: game.date,
        displayDate: game.displayDate,
        status: game.status,
        totalPlayers: game.totalPlayers,
        totalCards: game.totalCards,
        winnerId: game.winnerId,
        winnerUsername: game.winnerUsername,
      },
    });
  } catch (error: any) {
    console.error('Get current game error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
