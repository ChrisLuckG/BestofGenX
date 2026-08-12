import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import GameResult from '@/models/GameResult';
import Reaction from '@/models/Reaction';

const MAIN_BOT_USERNAME = 'ShadowHunter';

// Reset all bot points (except ShadowHunter unless explicitly requested)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.json().catch(() => ({}));
    const includeMainBot = body.includeMainBot === true;
    
    // Build query - exclude ShadowHunter by default
    const query = includeMainBot 
      ? { isBot: true }
      : { isBot: true, username: { $ne: MAIN_BOT_USERNAME } };
    
    const bots = await User.find(query);
    const botIds = bots.map(b => b._id.toString());
    
    // Reset bots to 0 everything (fresh start like new users)
    await User.updateMany(query, { 
      $set: { 
        points: 0, 
        bogxCoins: 0, 
        gamesPlayed: 0, 
        wins: 0, 
        hasReceivedWelcomeBonus: false,
        readArticles: [],
        watchedVideos: [],
      } 
    });
    
    // Also delete their GameResults so ranking is correct
    const deletedResults = await GameResult.deleteMany({ userId: { $in: botIds } });
    
    // Delete their reactions
    const deletedReactions = await Reaction.deleteMany({ userId: { $in: botIds } });
    
    return NextResponse.json({ 
      success: true, 
      message: `Reset ${bots.length} bots to 0`,
      deletedGameResults: deletedResults.deletedCount,
      deletedReactions: deletedReactions.deletedCount,
      preserved: includeMainBot ? null : MAIN_BOT_USERNAME
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
