import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import Card from '@/models/Card';
import UserQuestionHistory from '@/models/UserQuestionHistory';
import { sendPushNotification } from '@/lib/webpush';
import crypto from 'crypto';

// Helper to hash question text
function hashQuestion(text: string): string {
  return crypto.createHash('md5').update(text.toLowerCase().trim()).digest('hex');
}

// POST - Accept a battle
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    
    const { opponentId } = await request.json();
    const battleId = params.id;
    
    if (!opponentId) {
      return NextResponse.json({ success: false, error: 'Missing opponentId' }, { status: 400 });
    }
    
    // Find battle
    const battle = await Battle.findById(battleId);
    if (!battle) {
      return NextResponse.json({ success: false, error: 'Battle not found' }, { status: 404 });
    }
    
    if (battle.status !== 'open') {
      return NextResponse.json({ success: false, error: 'Battle is not open' }, { status: 400 });
    }
    
    // Can't accept own battle
    if (battle.creator.toString() === opponentId) {
      return NextResponse.json({ success: false, error: 'Cannot accept your own battle' }, { status: 400 });
    }
    
    // Check opponent has enough points
    const opponent = await User.findById(opponentId);
    if (!opponent) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    
    if ((opponent.bogxCoins || 0) < battle.wager) {
      return NextResponse.json({ 
        success: false, 
        error: 'Not enough coins',
        details: {
          required: battle.wager,
          available: opponent.bogxCoins || 0
        }
      }, { status: 400 });
    }
    
    // Deduct wager from opponent (with atomic check to prevent negative)
    const updateResult = await User.findOneAndUpdate(
      { _id: opponentId, bogxCoins: { $gte: battle.wager } },
      { $inc: { bogxCoins: -battle.wager } },
      { new: true }
    );
    
    if (!updateResult) {
      // Race condition - coins changed between check and update
      const freshUser = await User.findById(opponentId);
      return NextResponse.json({ 
        success: false, 
        error: 'Not enough coins',
        details: {
          required: battle.wager,
          available: freshUser?.bogxCoins ?? 0
        }
      }, { status: 400 });
    }
    
    // Update battle
    battle.opponent = opponentId;
    battle.status = 'active';
    battle.acceptedAt = new Date();
    
    // If creator is a bot, regenerate questions based on opponent's history
    // This ensures the user doesn't see questions they've already answered
    const battleCreator = await User.findById(battle.creator);
    if (battleCreator?.isBot) {
      console.log(`Bot battle accepted by ${opponentId}, regenerating questions...`);
      
      // Get questions the opponent has already seen (last 60 days)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      
      const seenHistory = await UserQuestionHistory.find({
        userId: opponentId,
        answeredAt: { $gte: sixtyDaysAgo }
      }).select('questionHash cardId').lean();
      
      const seenHashes = new Set(seenHistory.map((h: any) => h.questionHash));
      const seenCardIds = new Set(seenHistory.map((h: any) => h.cardId?.toString()));
      
      console.log(`User has seen ${seenHashes.size} questions in last 60 days`);
      
      // Get all active cards
      const allCards = await Card.find({ active: true }).lean();
      
      // Collect unseen questions
      const unseenQuestions: any[] = [];
      for (const card of allCards) {
        if (!card.questions || !Array.isArray(card.questions)) continue;
        for (const q of card.questions as any[]) {
          if (!q.question || !q.options || q.options.length < 2) continue;
          
          const qHash = hashQuestion(q.question);
          if (seenHashes.has(qHash)) continue; // Skip seen questions
          
          const correctIndex = q.options.indexOf(q.correctAnswer);
          if (correctIndex === -1) continue; // Skip invalid questions
          
          unseenQuestions.push({
            cardId: card._id,
            question: q.question,
            answers: q.options,
            correctIndex,
            topic: card.topic || card.theme,
          });
        }
      }
      
      // Shuffle and pick required number
      const shuffled = unseenQuestions.sort(() => Math.random() - 0.5);
      const newQuestions = shuffled.slice(0, battle.rounds);
      
      if (newQuestions.length >= battle.rounds) {
        battle.questions = newQuestions;
        console.log(`Regenerated ${newQuestions.length} unseen questions for battle`);
      } else {
        console.log(`Not enough unseen questions (${newQuestions.length}/${battle.rounds}), keeping original`);
      }
    }
    
    await battle.save();
    
    // Populate and return
    await battle.populate('creator', 'username avatar country countryFlag points isBot');
    await battle.populate('opponent', 'username avatar country countryFlag points isBot');
    
    // Send push notification to creator (if enabled)
    const creator = await User.findById(battle.creator._id || battle.creator);
    if (creator?.pushSubscription && creator?.notifyBattleAccepted !== false) {
      sendPushNotification(creator.pushSubscription, {
        title: '⚔️ Battle Accepted!',
        body: `${opponent.username} is playing your challenge right now! 🎮`,
        tag: `battle-accepted-${battle._id}`,
        url: '/battles',
        type: 'challenge'
      }).catch(console.error);
    }
    
    return NextResponse.json({ success: true, battle });
  } catch (error: any) {
    console.error('Failed to accept battle:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
