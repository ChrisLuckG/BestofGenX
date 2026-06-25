import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import GameResult from '@/models/GameResult';

// This endpoint should be called by a cron job daily (e.g., Vercel Cron at midnight)
// It simulates bot activity for the day, creating real GameResults

export async function GET(request: Request) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
    
    // Find all active bots
    const bots = await User.find({ 
      $or: [
        { isBot: true },
        { email: { $regex: /@bot\.sporttock\.com$/ } }
      ],
      botActive: { $ne: false } // Skip deactivated bots
    });
    
    if (bots.length === 0) {
      return NextResponse.json({ success: true, message: 'No active bots found' });
    }
    
    let botsPlayed = 0;
    let totalGames = 0;
    
    for (const bot of bots) {
      // 85% chance a bot plays today (realistic - some days off)
      if (Math.random() < 0.85) {
        // Each bot plays 3-15 games per day
        const gamesToPlay = Math.floor(Math.random() * 13) + 3;
        
        for (let i = 0; i < gamesToPlay; i++) {
          // 55-70% win rate depending on bot "skill"
          const botSkill = 0.55 + (Math.random() * 0.15);
          const isCorrect = Math.random() < botSkill;
          
          // BOGX scale (matches real gameplay): win = 0.05-0.30, lose = -0.01 to -0.10
          const difficulty = [1, 2, 3][Math.floor(Math.random() * 3)];
          const maxReward = 0.10 * difficulty; // 0.10, 0.20, 0.30
          const penalty = difficulty === 1 ? 0.01 : difficulty === 2 ? 0.05 : 0.10;
          const rawChange = isCorrect
            ? Math.round((maxReward * (0.5 + Math.random() * 0.5)) * 100) / 100
            : -penalty;
          
          const balanceBefore = bot.bogxCoins || 0;
          // Don't let the bot go below 0
          const pointsChange = Math.max(-balanceBefore, rawChange);
          
          await GameResult.create({
            userId: bot._id.toString(),
            username: bot.username,
            cardId: `bot-card-${Date.now()}-${i}`,
            question: 'Bot simulated game',
            userAnswer: isCorrect ? 'correct' : 'wrong',
            correctAnswer: 'correct',
            gameDate: targetDate,
            isCorrect,
            pointsChange,
            pointsBefore: balanceBefore,
            pointsAfter: balanceBefore + pointsChange,
            timeUsed: Math.random() * 8 + 2, // 2-10 seconds
            difficulty,
            skipped: false,
            timedOut: false,
          });
          
          // Update user totals (BOGX is the single source of truth)
          const updatedBot = await User.findByIdAndUpdate(bot._id, {
            $inc: {
              bogxCoins: pointsChange,
              gamesPlayed: 1,
              wins: isCorrect ? 1 : 0,
            }
          }, { new: true });
          // Keep local balance in sync for the next iteration's floor check
          bot.bogxCoins = updatedBot?.bogxCoins ?? balanceBefore + pointsChange;
          
          totalGames++;
        }
        
        botsPlayed++;
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      date: targetDate,
      totalBots: bots.length,
      botsPlayed,
      totalGames,
      message: `${botsPlayed} bots played ${totalGames} games for ${targetDate}`
    });
  } catch (error: any) {
    console.error('Bot activity error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
