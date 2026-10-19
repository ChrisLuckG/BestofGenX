import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import Question from '@/models/Question';
import UserQuestionHistory from '@/models/UserQuestionHistory';
import { sendPushNotification } from '@/lib/webpush';
import { themeForTopic } from '@/lib/battleTopics';
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

    // Personal/private challenges (challengedUser set) can only be accepted
    // by the intended opponent — otherwise anyone could "steal" a challenge
    // meant for someone else.
    if (battle.challengedUser && battle.challengedUser.toString() !== opponentId) {
      return NextResponse.json({ success: false, error: 'This battle was challenged to a specific player' }, { status: 403 });
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
    
    // Claim the battle atomically on `status: 'open'`.
    //
    // The status check above plus a later `save()` was not enough: the bot join paths
    // (trigger-bots, cron/bot-battles) do their own read-modify-write, so between our
    // check and our save a bot could take the battle - or, worse, overwrite our accept
    // afterwards. The user's wager was already deducted at that point, leaving them
    // paying for a battle whose `opponent` was now a bot, and every later call
    // answering "You are not part of this battle".
    const claimed = await Battle.findOneAndUpdate(
      { _id: battleId, status: 'open' },
      {
        $set: {
          opponent: opponentId,
          status: 'active',
          acceptedAt: new Date(),
          acceptedVia: 'api:battles/[id]/accept',
        },
      },
      { new: true }
    );

    if (!claimed) {
      // Someone else got there first - give the wager straight back, it was
      // deducted a few lines above.
      await User.findByIdAndUpdate(opponentId, { $inc: { bogxCoins: battle.wager } });
      return NextResponse.json({ success: false, error: 'Battle is not open' }, { status: 400 });
    }

    battle.opponent = opponentId;
    battle.status = 'active';
    battle.acceptedAt = claimed.acceptedAt;
    battle.acceptedVia = 'api:battles/[id]/accept';
    
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
      
      // Only ever pull cards from the battle's OWN theme. Regenerating from every
      // active card was the cause of battles labelled e.g. TV serving GAMING or
      // SPORTS questions: the topic-correct questions picked at creation time were
      // silently replaced with random ones the moment the battle was accepted.
      const expectedTheme = themeForTopic(battle.topic);
      if (!expectedTheme) {
        console.error(`Accept: unknown topic "${battle.topic}" - keeping original questions`);
      } else {
        // Get all questions for this theme
        const allQuestions = await Question.find((expectedTheme === 'MIX' ? { active: true } : { active: true, theme: expectedTheme }) as any).lean();
        
        // Collect unseen questions
        const unseenQuestions: any[] = [];
        for (const q of allQuestions) {
          if (!q.question || !q.options || q.options.length < 4) continue;
          
          const qHash = hashQuestion(q.question);
          if (seenHashes.has(qHash)) continue;
          
          const correctIndex = q.options.indexOf(q.correctAnswer);
          if (correctIndex === -1) continue;
          
          unseenQuestions.push({
            _theme: (q as any).theme,
            questionId: q._id.toString(),
            question: q.question,
            answers: q.options,
            correctIndex,
            points: q.maxReward || 0.10,
            difficulty: q.difficulty,
          });
        }
        
        // Shuffle and pick required number
        let shuffled = unseenQuestions.sort(() => Math.random() - 0.5);
        if (expectedTheme === 'MIX') {
          // Mixed: take one per theme in turns instead of whatever the biggest theme has most of
          const byTheme = new Map<string, any[]>();
          for (const q of shuffled) byTheme.set(q._theme, [...(byTheme.get(q._theme) || []), q]);
          const lists = Array.from(byTheme.values()).sort(() => Math.random() - 0.5);
          const rr: any[] = [];
          for (let i = 0; lists.some(l => l[i]); i++) for (const l of lists) if (l[i]) rr.push(l[i]);
          shuffled = rr;
        }
        const newQuestions = shuffled.slice(0, battle.rounds).map(({ _theme, ...q }) => q);
        
        if (newQuestions.length >= battle.rounds) {
          battle.questions = newQuestions;
          console.log(`Regenerated ${newQuestions.length} unseen ${expectedTheme} questions for battle`);
        } else {
          console.log(`Not enough unseen ${expectedTheme} questions (${newQuestions.length}/${battle.rounds}), keeping original`);
        }
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
        category: 'battleUpdates',
        body: `${opponent.username} is playing your challenge right now! 🎮`,
        tag: `battle-accepted-${battle._id}`,
        url: '/?tab=battles',
        type: 'challenge'
      }).catch(console.error);
    }
    
    return NextResponse.json({ success: true, battle });
  } catch (error: any) {
    console.error('Failed to accept battle:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
