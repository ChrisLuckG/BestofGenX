import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import Question from '@/models/Question';
import { TOPIC_TO_THEME } from '@/lib/battleTopics';

// NOTE: culture removed - not enough DB questions for this theme yet
const TOPICS = ['sport', 'music', 'film', 'fashion', 'games', 'tv'];
// BOGX wager amounts - 3 rounds for ≤0.75, 5 rounds for >0.75
const WAGERS = [
  { amount: 0.25, rounds: 3 },
  { amount: 0.50, rounds: 3 },
  { amount: 0.75, rounds: 3 },
  { amount: 1.00, rounds: 5 },
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
  
  // NOTE: We deliberately do NOT top up the bot's wallet here.
  // The wallet (bogxCoins) MUST always equal the sum of the bot's GameResults
  // (its real earnings), so it stays consistent everywhere (invite = ranking).
  // The bot earns coins naturally via the bot-activity cron (which creates
  // GameResults). If it cannot afford a wager, it simply skips creating a
  // battle this round. NO artificial wallet manipulation.
  
  // Check if Shadow Hunter already has an open battle
  const existingBattle = await Battle.findOne({
    creator: shadowHunter._id,
    status: 'open'
  });
  
  if (!existingBattle) {
    // Create a new battle for Shadow Hunter
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    const wagerConfig = WAGERS[Math.floor(Math.random() * WAGERS.length)];
    
    // Get random cards using aggregation with $sample - MUST match the battle topic,
    // otherwise the battle is labelled e.g. FILM but serves SPORTS questions.
    const questions = await Question.aggregate([
      { $match: { active: true, theme: TOPIC_TO_THEME[topic] } },
      { $sample: { size: wagerConfig.rounds } }
    ]);
    
    if (questions.length >= wagerConfig.rounds) {
      const battleQuestions = questions.map((q: any) => {
        const correctIndex = q.options?.indexOf(q.correctAnswer) ?? 0;
        return {
          questionId: q._id.toString(),
          question: q.question || 'Question',
          answers: q.options || ['A', 'B', 'C', 'D'],
          correctIndex: correctIndex >= 0 ? correctIndex : 0,
          topic: q.topic,
        };
      });
      
      await Battle.create({
        creator: shadowHunter._id,
        topic,
        wager: wagerConfig.amount,
        rounds: wagerConfig.rounds,
        status: 'open',
        questions: battleQuestions,
        creatorResults: [],
        opponentResults: [],
        createdVia: 'trigger-bots:ensureShadowHunterBattle',
      });
      
      result.created = true;
    }
  }
  
  // Shadow Hunter also joins any open PUBLIC battles from real users
  // NEVER join private battles or battles with a specific challengedUser!
  const openUserBattle = await Battle.findOne({
    status: 'open',
    creator: { $ne: shadowHunter._id },
    isPrivate: { $ne: true },           // Don't join private battles
    challengedUser: { $exists: false }, // Don't join direct challenges
  }).populate('creator', 'isBot username');
  
  if (openUserBattle) {
    const creator = openUserBattle.creator as any;
    // Only join if creator is NOT a bot (real user), and it can afford the wager
    if (!creator?.isBot && (shadowHunter.bogxCoins || 0) >= openUserBattle.wager) {
      // CRITICAL: simulate the bot's answers immediately upon joining.
      // Without this, the bot becomes "opponent" but never actually plays,
      // leaving the real creator's battle permanently stuck waiting for an
      // opponent who can never finish (they'd submit their side and just
      // get "waiting for opponent" forever, with no way to ever see a result).
      const botSkill = 0.5 + Math.random() * 0.4; // 50-90% accuracy
      const opponentResults = openUserBattle.questions.map((_: any, idx: number) => {
        const correct = Math.random() < botSkill;
        const timeMs = 2000 + Math.random() * 6000;
        const pct = Math.max(10000 - timeMs, 0) / 10000;
        const points = correct ? Math.round(300 * pct) : 0;
        return { round: idx, correct, timeMs, points };
      });

      // Claim the battle atomically on `status: 'open'`.
      //
      // The previous read-modify-`save()` was a lost update: a real user could accept
      // the battle between the findOne above and the save below, and the bot's save
      // then overwrote `opponent` and `status` with its own values. The user's wager
      // had already been deducted by the accept route, so they ended up paying for a
      // battle that now belonged to creator + bot - and every later call answered
      // "You are not part of this battle". Note /api/battles/trigger-bots runs on
      // every BattlesPage mount, i.e. exactly while users are accepting battles.
      const claimed = await Battle.findOneAndUpdate(
        { _id: openUserBattle._id, status: 'open' },
        {
          $set: {
            opponent: shadowHunter._id,
            status: 'active',
            acceptedAt: new Date(),
            acceptedVia: 'trigger-bots:ensureShadowHunterBattle',
            opponentResults,
            opponentTotalPoints: opponentResults.reduce((sum: number, r: any) => sum + r.points, 0),
          },
        },
        { new: true }
      );

      if (claimed) {
        console.log('[BATTLE JOIN] trigger-bots ShadowHunter joined', openUserBattle._id.toString(),
          'creator=', (creator as any)?.username, 'createdAt=', openUserBattle.createdAt);
        // Only after the claim succeeded - otherwise the bot pays for nothing.
        await User.findByIdAndUpdate(shadowHunter._id, { $inc: { bogxCoins: -openUserBattle.wager } });
        result.joined = true;
      }
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
    
    // Get up to 8 random active bots with enough points.
    // Each bot can only have 1 open battle at a time.
    // MUST match on isBot only. Matching `botActive: true` as an alternative was a
    // severe bug: botActive defaults to true on normal user accounts, so real users
    // were picked as "bots" and had battles created under their name (wager deducted
    // from them) without ever clicking anything.
    const bots = await User.aggregate([
      { 
        $match: { 
          isBot: true,
          botActive: { $ne: false },
          bogxCoins: { $gte: 0.25 } // Minimum wager
        } 
      },
      { $sample: { size: 8 } }
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
      // Check if this bot already has an open battle
      const existingBotBattle = await Battle.findOne({
        creator: bot._id,
        status: 'open'
      });
      
      if (existingBotBattle) {
        // Bot already has an open battle, skip
        continue;
      }
      
      // 70% chance to create a battle, 30% to join an existing one
      const shouldCreate = Math.random() > 0.3;
      
      if (shouldCreate) {
        // Create a new battle - each bot gets a different wager based on their index
        const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
        // Assign wager based on bot index for variety
        const botIndex = bots.indexOf(bot);
        const wagerConfig = WAGERS[botIndex % WAGERS.length];
        
        if (bot.bogxCoins >= wagerConfig.amount) {
          // Get random questions for this battle
          const dbQuestions = await Question.aggregate([
            { $match: { active: true, theme: TOPIC_TO_THEME[topic] } },
            { $sample: { size: wagerConfig.rounds } }
          ]);
          
          if (dbQuestions.length >= wagerConfig.rounds) {
            const battleQuestions = dbQuestions.map((q: any) => {
              const correctIndex = q.options?.indexOf(q.correctAnswer) ?? 0;
              return {
                questionId: q._id.toString(),
                question: q.question || 'Question',
                answers: q.options || ['A', 'B', 'C', 'D'],
                correctIndex: correctIndex >= 0 ? correctIndex : 0,
                topic: q.topic,
              };
            });
            
            await Battle.create({
              creator: bot._id,
              topic,
              wager: wagerConfig.amount,
              rounds: wagerConfig.rounds,
              status: 'open',
              questions: battleQuestions,
              creatorResults: [],
              opponentResults: [],
              createdVia: 'trigger-bots:botLoop',
            });
            
            // Deduct wager
            await User.findByIdAndUpdate(bot._id, {
              $inc: { bogxCoins: -wagerConfig.amount }
            });
            
            results.battlesCreated++;
          }
        }
      } else {
        // Try to join an open PUBLIC battle (not created by a bot)
        // NEVER join private battles or direct challenges!
        const openBattle = await Battle.findOne({
          status: 'open',
          creator: { $ne: bot._id },
          isPrivate: { $ne: true },           // Don't join private battles
          challengedUser: { $exists: false }, // Don't join direct challenges
        }).populate('creator', 'isBot');
        
        if (openBattle && bot.bogxCoins >= openBattle.wager) {
          const creator = openBattle.creator as any;
          
          // Don't join if creator is also a bot (avoid bot vs bot)
          if (!creator?.isBot) {
            // Simulate the bot's answers immediately upon joining — without
            // this the battle gets permanently stuck waiting for an
            // opponent who can never finish (same bug as ShadowHunter's join path).
            const botSkill = 0.5 + Math.random() * 0.4;
            const opponentResults = openBattle.questions.map((_: any, idx: number) => {
              const correct = Math.random() < botSkill;
              const timeMs = 2000 + Math.random() * 6000;
              const pct = Math.max(10000 - timeMs, 0) / 10000;
              const points = correct ? Math.round(300 * pct) : 0;
              return { round: idx, correct, timeMs, points };
            });

            // Atomic claim - see the ShadowHunter path above for why a plain
            // save() here silently stole battles a real user had just accepted.
            const claimed = await Battle.findOneAndUpdate(
              { _id: openBattle._id, status: 'open' },
              {
                $set: {
                  opponent: bot._id,
                  status: 'active',
                  acceptedAt: new Date(),
                  acceptedVia: 'trigger-bots:botLoop',
                  opponentResults,
                  opponentTotalPoints: opponentResults.reduce((sum: number, r: any) => sum + r.points, 0),
                },
              },
              { new: true }
            );

            if (claimed) {
              console.log('[BATTLE JOIN] trigger-bots bot joined', openBattle._id.toString(), 'bot=', bot.username);
              await User.findByIdAndUpdate(bot._id, {
                $inc: { bogxCoins: -openBattle.wager }
              });
              results.battlesJoined++;
            }
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
    // isBot only — `botActive: true` is the default on every user account and would
    // list real users as bots here.
    const allBots = await User.find({ 
      isBot: true 
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
