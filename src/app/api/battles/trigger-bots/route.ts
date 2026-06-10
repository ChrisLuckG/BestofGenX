import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import Card from '@/models/Card';

const TOPICS = ['sport', 'music', 'film', 'culture', 'fashion', 'games', 'tv'];
const WAGERS = [
  { amount: 10, rounds: 3 },
  { amount: 25, rounds: 3 },
  { amount: 50, rounds: 3 },
];

// Shadow Hunter is always available - find or ensure he has a battle
async function ensureShadowHunterBattle(): Promise<{ created: boolean; joined: boolean; error?: string; botId?: string }> {
  const result: { created: boolean; joined: boolean; error?: string; botId?: string } = { created: false, joined: false };
  
  // Find ShadowHunter bot by username (exact match or variations)
  const shadowHunter = await User.findOne({ 
    username: { $regex: /^shadowhunter$/i }
  });
  
  if (!shadowHunter) {
    result.error = 'ShadowHunter bot not found';
    console.log(result.error);
    return result;
  }
  
  // Mark as bot if not already
  if (!shadowHunter.isBot) {
    await User.findByIdAndUpdate(shadowHunter._id, { $set: { isBot: true } });
  }
  
  result.botId = shadowHunter._id.toString();
  console.log('Found ShadowHunter:', shadowHunter.username, 'ID:', shadowHunter._id);
  
  // Ensure Shadow Hunter has enough points (give him infinite points basically)
  if (shadowHunter.points < 1000) {
    await User.findByIdAndUpdate(shadowHunter._id, { $set: { points: 10000 } });
  }
  
  // Check if Shadow Hunter already has an open battle
  const existingBattle = await Battle.findOne({
    creator: shadowHunter._id,
    status: 'open'
  });
  
  if (!existingBattle) {
    // Create a new battle for Shadow Hunter
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    const wagerConfig = WAGERS[Math.floor(Math.random() * WAGERS.length)];
    
    const cards = await Card.find({ active: true }).limit(wagerConfig.rounds).lean();
    
    if (cards.length >= wagerConfig.rounds) {
      const questions = cards.map((card: any) => {
        const q = card.questions?.[0];
        return {
          cardId: card._id,
          question: q?.question || 'Question',
          answers: q?.options || ['A', 'B', 'C', 'D'],
          correctIndex: q?.options?.indexOf(q?.correctAnswer) || 0,
          topic: card.topic,
        };
      });
      
      await Battle.create({
        creator: shadowHunter._id,
        topic,
        wager: wagerConfig.amount,
        rounds: wagerConfig.rounds,
        status: 'open',
        questions,
        creatorResults: [],
        opponentResults: [],
      });
      
      result.created = true;
    }
  }
  
  // Shadow Hunter also joins any open battles from real users
  const openUserBattle = await Battle.findOne({
    status: 'open',
    creator: { $ne: shadowHunter._id },
  }).populate('creator', 'isBot username');
  
  if (openUserBattle) {
    const creator = openUserBattle.creator as any;
    // Only join if creator is NOT a bot (real user)
    if (!creator?.isBot) {
      openUserBattle.opponent = shadowHunter._id;
      openUserBattle.status = 'active';
      await openUserBattle.save();
      result.joined = true;
    }
  }
  
  return result;
}

// Check if bots were active recently (but Shadow Hunter is always active)
async function wasRecentBotActivity(): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const recentBotBattle = await Battle.findOne({
    createdAt: { $gte: oneHourAgo },
    $or: [
      { 'creator.isBot': true },
      { 'opponent.isBot': true }
    ]
  }).populate('creator opponent', 'isBot');
  
  // Also check by looking at bot usernames in recent battles
  if (!recentBotBattle) {
    const recentBattle = await Battle.findOne({
      createdAt: { $gte: oneHourAgo }
    }).populate('creator opponent', 'username isBot');
    
    if (recentBattle) {
      const creator = recentBattle.creator as any;
      const opponent = recentBattle.opponent as any;
      if (creator?.isBot || opponent?.isBot) {
        return true;
      }
    }
  }
  
  return !!recentBotBattle;
}

// POST - Trigger 1-2 bots to create/join battles (called when user visits battle page)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // ALWAYS ensure Shadow Hunter has a battle available and joins user battles
    const shadowHunterResult = await ensureShadowHunterBattle();
    
    // Check if there was recent bot activity (for other bots)
    const hadRecentActivity = await wasRecentBotActivity();
    if (hadRecentActivity) {
      return NextResponse.json({ 
        success: true, 
        message: 'Shadow Hunter active, other bots skipped',
        triggered: true,
        shadowHunter: shadowHunterResult
      });
    }
    
    // Get 1-2 random active bots with enough points
    const bots = await User.aggregate([
      { 
        $match: { 
          $or: [{ isBot: true }, { botActive: true }],
          points: { $gte: 25 }
        } 
      },
      { $sample: { size: 2 } }
    ]);
    
    if (bots.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No bots available',
        triggered: false 
      });
    }
    
    const results = {
      battlesCreated: 0,
      battlesJoined: 0,
    };
    
    for (const bot of bots) {
      // 50% chance to create a battle, 50% to join an existing one
      const shouldCreate = Math.random() > 0.5;
      
      if (shouldCreate) {
        // Create a new battle
        const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
        const wagerConfig = WAGERS[Math.floor(Math.random() * WAGERS.length)];
        
        if (bot.points >= wagerConfig.amount) {
          // Get cards for this battle
          const cards = await Card.find({ active: true })
            .limit(wagerConfig.rounds)
            .lean();
          
          if (cards.length >= wagerConfig.rounds) {
            const questions = cards.map((card: any) => {
              const q = card.questions?.[0];
              return {
                cardId: card._id,
                question: q?.question || 'Question',
                answers: q?.options || ['A', 'B', 'C', 'D'],
                correctIndex: q?.options?.indexOf(q?.correctAnswer) || 0,
                topic: card.topic,
              };
            });
            
            await Battle.create({
              creator: bot._id,
              topic,
              wager: wagerConfig.amount,
              rounds: wagerConfig.rounds,
              status: 'open',
              questions,
              creatorResults: [],
              opponentResults: [],
            });
            
            // Deduct wager
            await User.findByIdAndUpdate(bot._id, {
              $inc: { points: -wagerConfig.amount }
            });
            
            results.battlesCreated++;
          }
        }
      } else {
        // Try to join an open battle (not created by a bot)
        const openBattle = await Battle.findOne({
          status: 'open',
          creator: { $ne: bot._id },
        }).populate('creator', 'isBot');
        
        if (openBattle && bot.points >= openBattle.wager) {
          const creator = openBattle.creator as any;
          
          // Don't join if creator is also a bot (avoid bot vs bot)
          if (!creator?.isBot) {
            openBattle.opponent = bot._id;
            openBattle.status = 'active';
            await openBattle.save();
            
            // Deduct wager
            await User.findByIdAndUpdate(bot._id, {
              $inc: { points: -openBattle.wager }
            });
            
            results.battlesJoined++;
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      triggered: true,
      results,
      shadowHunter: shadowHunterResult,
    });
    
  } catch (error: any) {
    console.error('Trigger bots error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET - Debug endpoint to check bot status
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Find all bots
    const allBots = await User.find({ 
      $or: [{ isBot: true }, { botActive: true }] 
    }).select('username isBot botActive points avatar country').limit(20);
    
    // Find Shadow Hunter specifically
    const shadowHunter = await User.findOne({ 
      username: { $regex: /shadow/i }
    }).select('username isBot botActive points _id');
    
    // Find open battles
    const openBattles = await Battle.find({ status: 'open' })
      .populate('creator', 'username isBot')
      .limit(10);
    
    return NextResponse.json({
      success: true,
      bots: allBots,
      shadowHunter: shadowHunter || 'NOT FOUND',
      openBattles: openBattles.map(b => ({
        id: b._id,
        creator: (b.creator as any)?.username,
        isBot: (b.creator as any)?.isBot,
        wager: b.wager,
        topic: b.topic,
      })),
    });
    
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
