import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import Card from '@/models/Card';

const TOPICS = ['sport', 'music', 'film', 'culture', 'fashion', 'games', 'tv', 'art', 'food'];
const WAGERS = [
  { amount: 10, rounds: 3 },
  { amount: 25, rounds: 3 },
  { amount: 50, rounds: 3 },
  { amount: 100, rounds: 5 },
  { amount: 150, rounds: 5 },
];

// Known bot names
const BOT_NAMES = [
  'ShadowHunter', 'NightWolf', 'BlazeMaster', 'CyberNinja', 'StormRider',
  'PhoenixFire', 'IceQueen', 'ThunderBolt', 'DarkKnight', 'StarGazer',
  'MoonWalker', 'SunChaser', 'WildCard', 'LuckyStrike', 'GoldenEagle',
  'SilverFox', 'RedDragon', 'BlueTiger', 'GreenMamba', 'PurpleHaze',
  'CrimsonKing', 'JadeWarrior', 'OnyxBlade', 'DiamondDust', 'RubyFlash',
  'EmeraldEye', 'SapphireWave', 'TopazGlow', 'AmberLight', 'CoralReef'
];

// POST - Create bot battles and have bots accept open battles
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Get bots by isBot flag OR by known bot names
    const bots = await User.find({ 
      $or: [
        { isBot: true, botActive: { $ne: false } },
        { username: { $in: BOT_NAMES } }
      ]
    });
    
    if (bots.length === 0) {
      return NextResponse.json({ success: true, message: 'No active bots' });
    }
    
    // Check cards availability
    const activeCards = await Card.countDocuments({ active: true });
    
    const results = {
      battlesCreated: 0,
      battlesAccepted: 0,
      botsFound: bots.length,
      botsWithPoints: bots.filter(b => b.points >= 10).length,
      activeCards,
      openBattlesCount: 0,
      errors: [] as string[]
    };
    
    // 1. Create new battles from bots (keep pool active but realistic)
    const openBattles = await Battle.countDocuments({ status: 'open' });
    results.openBattlesCount = openBattles;
    const minBattles = 3;  // Minimum battles in pool
    const maxBattles = 8;  // Maximum battles in pool (don't flood)
    
    // Always create at least 1 if pool is empty, otherwise create 1-2 if below minimum
    const shouldCreate = openBattles === 0 || openBattles < minBattles;
    if (shouldCreate) {
      const battlesToCreate = openBattles === 0 ? 3 : Math.min(maxBattles - openBattles, 1 + Math.floor(Math.random() * 2));
      
      for (let i = 0; i < battlesToCreate; i++) {
        try {
          // Pick random bot
          const bot = bots[Math.floor(Math.random() * bots.length)];
          
          // Pick random topic and wager
          const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
          const wagerConfig = WAGERS[Math.floor(Math.random() * WAGERS.length)];
          
          // Check bot has enough points
          if (bot.points < wagerConfig.amount) continue;
          
          // Get questions
          const cards = await Card.aggregate([
            { $match: { active: true } },
            { $sample: { size: wagerConfig.rounds } }
          ]);
          
          if (cards.length < wagerConfig.rounds) continue;
          
          // NO FALLBACKS - strict validation
          const battleQuestions: any[] = [];
          for (const card of cards) {
            const q = card.questions?.[1] || card.questions?.[0];
            
            // Skip invalid cards
            if (!q || !q.question || !Array.isArray(q.options) || q.options.length !== 4) {
              console.error('Bot battle: Invalid card, skipping:', card._id);
              continue;
            }
            
            const correctIndex = q.options.indexOf(q.correctAnswer);
            if (correctIndex === -1) {
              console.error('Bot battle: Correct answer not in options, skipping:', card._id);
              continue;
            }
            
            battleQuestions.push({
              questionId: card._id,
              question: q.question,
              answers: q.options,
              correctIndex: correctIndex,
              points: 300
            });
          }
          
          // Skip if not enough valid questions
          if (battleQuestions.length < wagerConfig.rounds) {
            console.error(`Bot battle: Not enough valid questions (${battleQuestions.length}/${wagerConfig.rounds})`);
            continue;
          }
          
          // Bot plays their own battle immediately (so it shows in pool)
          const botSkill = 0.5 + Math.random() * 0.4; // 50-90% accuracy
          const creatorResults = battleQuestions.map((_: any, idx: number) => {
            const correct = Math.random() < botSkill;
            const timeMs = 2000 + Math.random() * 6000;
            const pct = Math.max(10000 - timeMs, 0) / 10000;
            const points = correct ? Math.round(300 * pct) : 0;
            return { round: idx + 1, correct, timeMs, points };
          });
          const creatorTotalPoints = creatorResults.reduce((sum: number, r: any) => sum + r.points, 0);
          
          await Battle.create({
            creator: bot._id,
            topic,
            wager: wagerConfig.amount,
            rounds: wagerConfig.rounds,
            questions: battleQuestions,
            status: 'open',
            creatorResults,
            creatorTotalPoints
          });
          
          results.battlesCreated++;
        } catch (err: any) {
          results.errors.push(`Create error: ${err.message}`);
        }
      }
    }
    
    // 2. Have bots accept open battles (only bot-created, not from admin)
    // This makes the pool dynamic - bots play against each other!
    const openBattlesToAccept = await Battle.find({ 
      status: 'open'
    }).populate('creator', 'username isBot').limit(5);
    
    // Filter out battles from admin (for testing) and non-bot creators
    const botBattlesToAccept = openBattlesToAccept.filter((b: any) => {
      const creatorUsername = b.creator?.username?.toLowerCase();
      // Skip battles from admin account (for testing)
      if (creatorUsername === 'admin') return false;
      // Only accept battles from other bots
      return b.creator?.isBot === true;
    });
    
    // Randomly pick 1-2 battles to accept (not all at once - realistic)
    const shuffled = botBattlesToAccept.sort(() => Math.random() - 0.5);
    const battlesToPick = Math.min(shuffled.length, 1 + Math.floor(Math.random() * 2));
    
    for (let i = 0; i < battlesToPick; i++) {
      const battle = shuffled[i];
      try {
        // Pick a random bot to accept (not the creator)
        const availableBots = bots.filter(b => 
          b.points >= battle.wager && 
          b._id.toString() !== battle.creator.toString()
        );
        
        if (availableBots.length === 0) continue;
        
        // 70% chance bot accepts a battle (adds randomness)
        if (Math.random() > 0.7) continue;
        
        const bot = availableBots[Math.floor(Math.random() * availableBots.length)];
        
        // Accept the battle
        battle.opponent = bot._id;
        battle.status = 'active';
        battle.acceptedAt = new Date();
        
        // Simulate bot playing (instant results for creator side if bot)
        const botSkillCreator = 0.5 + Math.random() * 0.4; // 50-90% accuracy
        const creatorResults = battle.questions.map((_: any, idx: number) => {
          const correct = Math.random() < botSkillCreator;
          const timeMs = 2000 + Math.random() * 6000;
          const pct = Math.max(10000 - timeMs, 0) / 10000;
          const points = correct ? Math.round(300 * pct) : 0;
          return { round: idx + 1, correct, timeMs, points };
        });
        
        // Simulate opponent bot playing
        const botSkillOpponent = 0.5 + Math.random() * 0.4;
        const opponentResults = battle.questions.map((_: any, idx: number) => {
          const correct = Math.random() < botSkillOpponent;
          const timeMs = 2000 + Math.random() * 6000;
          const pct = Math.max(10000 - timeMs, 0) / 10000;
          const points = correct ? Math.round(300 * pct) : 0;
          return { round: idx + 1, correct, timeMs, points };
        });
        
        battle.creatorResults = creatorResults;
        battle.creatorTotalPoints = creatorResults.reduce((sum: number, r: any) => sum + r.points, 0);
        battle.opponentResults = opponentResults;
        battle.opponentTotalPoints = opponentResults.reduce((sum: number, r: any) => sum + r.points, 0);
        
        // Complete the battle immediately for bot vs bot
        const creatorIsBot = bots.some(b => b._id.toString() === battle.creator.toString());
        if (creatorIsBot) {
          battle.status = 'completed';
          battle.completedAt = new Date();
          
          // Update points for bots
          const creatorWon = battle.creatorTotalPoints > battle.opponentTotalPoints;
          if (creatorWon) {
            await User.findByIdAndUpdate(battle.creator, { $inc: { points: battle.wager, wins: 1 } });
            await User.findByIdAndUpdate(bot._id, { $inc: { points: -battle.wager } });
          } else if (battle.opponentTotalPoints > battle.creatorTotalPoints) {
            await User.findByIdAndUpdate(bot._id, { $inc: { points: battle.wager, wins: 1 } });
            await User.findByIdAndUpdate(battle.creator, { $inc: { points: -battle.wager } });
          }
          // Tie = no point change
        }
        
        await battle.save();
        results.battlesAccepted++;
      } catch (err: any) {
        results.errors.push(`Accept error: ${err.message}`);
      }
    }
    
    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Bot battles cron error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET - Trigger via GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request);
}
