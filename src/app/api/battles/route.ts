import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import Card from '@/models/Card';
import OpenAI from 'openai';
import { combinePrompts } from '@/lib/loadPrompt';
import { getQuestionsForUser } from '@/lib/questionService';
import { themeForTopic } from '@/lib/battleTopics';

// GET - List open battles
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic');
    const status = searchParams.get('status') || 'open';
    const userId = searchParams.get('userId'); // Current user ID to show their private battles
    const countOnly = searchParams.get('countOnly') === 'true';

    // Fast path: just return counts for the welcome modal / nav badge
    if (countOnly && userId) {
      const [pendingChallenges, activeBattles, myOpenBattles] = await Promise.all([
        Battle.countDocuments({ challengedUser: userId, status: 'open' }),
        Battle.countDocuments({
          $or: [{ creator: userId }, { opponent: userId }],
          status: 'active',
        }),
        // Battles the user created themselves, still waiting for an opponent to join
        Battle.countDocuments({ creator: userId, status: 'open' }),
      ]);
      return NextResponse.json({ success: true, pendingChallenges, activeBattles, myOpenBattles });
    }
    
    const query: any = { status };
    if (topic && topic !== 'all') {
      query.topic = topic;
    }
    
    // Only show battles where creator has already played (has results)
    // EXCEPTION: Bot battles don't need creator results (bot plays when opponent joins)
    // Exclude private battles UNLESS they belong to current user or user is challenged
    if (status === 'open') {
      // Get bot user IDs to exclude from "must have results" rule
      const bots = await User.find({ isBot: true }).select('_id');
      const botIds = bots.map(b => b._id);
      
      // Show battles where: creator has played OR creator is a bot
      const creatorConditions: any[] = [
        { 'creatorResults.0': { $exists: true } },
        { creator: { $in: botIds } },
      ];
      // Always include user's own open battles (sent invitations) even without results
      if (userId) creatorConditions.push({ creator: userId });

      query.$and = [{ $or: creatorConditions }];
      
      if (userId) {
        // Show: public battles OR my private battles OR battles where I'm challenged
        query.$and.push({
          $or: [
            { isPrivate: { $ne: true } },
            { isPrivate: true, creator: userId },
            { isPrivate: true, challengedUser: userId }
          ]
        });
      } else {
        // No user ID - only show public battles
        query.isPrivate = { $ne: true };
      }
    }
    
    // Special case: fetch declined battles for the modal
    if (status === 'declined' && userId) {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // last 48h
      const declined = await Battle.find({
        creator: userId,
        status: 'cancelled',
        declinedBy: { $exists: true },
        declinedAt: { $gte: cutoff },
        dismissedByCreator: { $ne: true },
      })
        .select('_id topic wager rounds status challengedUser declinedBy declinedAt createdAt')
        .populate('declinedBy', 'username avatar')
        .sort({ declinedAt: -1 })
        .limit(10);
      return NextResponse.json({ success: true, battles: declined });
    }

    const battles = await Battle.find(query)
      .select('_id creator opponent topic wager rounds status questions creatorResults opponentResults creatorTotalPoints opponentTotalPoints winner isPrivate challengedUser createdAt acceptedAt createdVia acceptedVia')
      .populate('creator', 'username avatar country countryFlag points bogxCoins isBot')
      .populate('opponent', 'username avatar country countryFlag points bogxCoins isBot')
      .populate('challengedUser', 'username avatar country countryFlag')
      .sort({ createdAt: -1 })
      .limit(50);
    
    // Get ranking for all users (sorted by bogxCoins)
    const allUsers = await User.find({ isAdmin: { $ne: true } })
      .select('_id bogxCoins')
      .sort({ bogxCoins: -1 })
      .lean();
    
    // Create rank map
    const rankMap = new Map<string, number>();
    allUsers.forEach((u, idx) => rankMap.set(u._id.toString(), idx + 1));
    
    // Add rank to each battle's creator
    const battlesWithRank = battles.map(b => {
      const battle = b.toObject();
      if (battle.creator?._id) {
        battle.creator.rank = rankMap.get(battle.creator._id.toString()) || null;
      }
      if (battle.opponent?._id) {
        battle.opponent.rank = rankMap.get(battle.opponent._id.toString()) || null;
      }
      return battle;
    });
    
    // Auto-trigger bot battles if pool is too empty (async, don't wait)
    if (status === 'open' && battles.length < 3) {
      triggerBotBattles().catch(console.error);
    }
    
    // Return with no-cache headers to ensure fresh data globally
    return NextResponse.json(
      { success: true, battles: battlesWithRank },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  } catch (error: any) {
    console.error('Failed to get battles:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Helper to trigger bot battles without blocking
async function triggerBotBattles() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000';
  
  try {
    await fetch(`${baseUrl}/api/cron/bot-battles`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    // Ignore errors - this is a background task
  }
}

// POST - Create new battle
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const { creatorId, topic, wager, rounds, isPrivate, challengedUserId, source } = body;

    const createdVia = source || 'unknown';
    const createdUserAgent = request.headers.get('user-agent') || '';
    const createdReferer = request.headers.get('referer') || '';

    console.log('[BATTLE CREATE]', JSON.stringify({
      at: new Date().toISOString(),
      creatorId, topic, wager, rounds, isPrivate, challengedUserId,
      createdVia, createdReferer, createdUserAgent,
    }));
    
    // Validate
    if (!creatorId || !topic || !wager || !rounds) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    
    // Check if creator exists and has enough points
    const creator = await User.findById(creatorId);
    if (!creator) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    
    if ((creator.bogxCoins || 0) < wager) {
      return NextResponse.json({ success: false, error: 'Not enough coins' }, { status: 400 });
    }
    
    // Map topic to theme for Card model. Resolved BEFORE the wager is deducted so an
    // unknown topic can be rejected without having to refund.
    const theme = themeForTopic(topic);
    // Fail loudly instead of silently falling back to another theme - a fallback would
    // label the battle with one topic while serving questions from a different one.
    if (!theme) {
      console.error(`Battle create: unknown topic "${topic}" - no theme mapping`);
      return NextResponse.json({ success: false, error: `Unknown topic: ${topic}` }, { status: 400 });
    }
    
    // Deduct wager from creator immediately (with atomic check to prevent negative)
    const updateResult = await User.findOneAndUpdate(
      { _id: creatorId, bogxCoins: { $gte: wager } },
      { $inc: { bogxCoins: -wager } },
      { new: true }
    );
    
    if (!updateResult) {
      return NextResponse.json({ success: false, error: 'Not enough coins' }, { status: 400 });
    }
    
    // 1. Try to get existing cards from database first, using the same smart
    // rotation Solo Trivia uses: prioritize cards the creator has never seen,
    // then recycle the oldest-seen ones once the pool runs out. This scales
    // automatically as more questions get added - no manual tuning needed.
    let battleQuestions: any[] = [];

    // For direct challenges, also avoid cards the challenged opponent has
    // already seen (both players will face the same questions in this battle).
    let opponentExcludeIds: string[] = [];
    if (challengedUserId) {
      const UserQuestionHistory = (await import('@/models/UserQuestionHistory')).default;
      const opponentHistory = await UserQuestionHistory.find({ userId: challengedUserId })
        .select('cardId')
        .lean();
      opponentExcludeIds = opponentHistory.map((h: any) => h.cardId?.toString()).filter(Boolean);
    }

    // Fetch more candidate cards than rounds needed, since each card may fail
    // validation (missing/invalid question data) and get skipped below.
    const candidateCards = await getQuestionsForUser(creatorId, {
      theme,
      count: rounds * 6,
      context: 'battle',
      excludeCardIds: opponentExcludeIds,
    });

    console.log(`Found ${candidateCards.length} candidate cards for theme "${theme}" (topic: ${topic})`);

    for (const card of candidateCards) {
      if (battleQuestions.length >= rounds) break;
      if (!card.questions || !Array.isArray(card.questions) || card.questions.length === 0) continue;

      // Pick a random difficulty variant from this card
      const q = card.questions[Math.floor(Math.random() * card.questions.length)];
      if (!q.question || !q.options || q.options.length !== 4) continue;

      const correctIndex = q.options.indexOf(q.correctAnswer);
      // NO FALLBACK - skip invalid questions
      if (correctIndex === -1) {
        console.error('Correct answer not found in options, skipping card:', card._id);
        continue;
      }

      battleQuestions.push({
        questionId: `${card._id}_${q.difficulty || 0}`,
        cardId: card._id,
        question: q.question,
        answers: q.options,
        correctIndex,
        points: q.maxReward || 100,
        difficulty: q.difficulty,
        difficultyText: q.difficultyText,
      });
    }

    console.log(`Using ${battleQuestions.length} questions for battle (topic: ${topic}, candidates: ${candidateCards.length})`);
    
    // 2. If not enough cards, generate FULL quiz sets (Easy/Medium/Hard) with ChatGPT
    //    Each card stored properly with all 3 variants so it can be reused later in normal play
    const questionsNeeded = rounds - battleQuestions.length;
    if (questionsNeeded > 0) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        if (battleQuestions.length === 0) {
          return NextResponse.json({ success: false, error: 'Not enough questions available' }, { status: 500 });
        }
      } else {
        const openai = new OpenAI({ apiKey });
        const systemPrompt = combinePrompts(['core.txt', 'trivia.txt']);

        console.log(`Generating ${questionsNeeded} NEW full quiz-sets (Easy+Medium+Hard) for theme: ${theme}`);

        // Generate one full quiz-set per missing question, in parallel for speed
        const generationPromises = Array.from({ length: questionsNeeded }, async (_, idx) => {
          try {
            const completion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Generate 3 quiz questions (Easy, Medium, Hard) STRICTLY about: ${theme}. The questions MUST be about ${theme === 'GAMES' ? 'video games, board games, or gaming' : theme === 'MUSIC' ? 'music, bands, songs, or musicians' : theme === 'SPORTS' ? 'sports, athletes, or sporting events' : theme === 'FILM' || theme === 'MOVIES' ? 'movies, films, actors, or directors' : theme === 'TV' ? 'TV shows, series, or TV personalities' : theme}. Do NOT mix categories! Respond with a valid JSON object.` }
              ],
              temperature: 1.0,
              response_format: { type: 'json_object' },
            });

            const content = completion.choices[0]?.message?.content;
            if (!content) return null;
            const quizData = JSON.parse(content);

            // Validate all 3 variants
            const isValid = (v: any) =>
              v && v.question && Array.isArray(v.options) && v.options.length === 4
              && v.correctAnswer && v.options.includes(v.correctAnswer);
            if (!isValid(quizData.easy) || !isValid(quizData.medium) || !isValid(quizData.hard)) {
              console.warn(`Battle gen ${idx}: incomplete quiz-set, skipping`);
              return null;
            }

            // Save full card with all 3 difficulties
            const newCard = await Card.create({
              type: 'quiz',
              theme: theme,
              topic: quizData.topic || topic,
              questions: [
                {
                  question: quizData.easy.question,
                  options: quizData.easy.options,
                  correctAnswer: quizData.easy.correctAnswer,
                  highlightWords: quizData.easy.highlightWords || [],
                  difficulty: 1,
                  difficultyText: 'Easy',
                  maxReward: 50,
                },
                {
                  question: quizData.medium.question,
                  options: quizData.medium.options,
                  correctAnswer: quizData.medium.correctAnswer,
                  highlightWords: quizData.medium.highlightWords || [],
                  difficulty: 3,
                  difficultyText: 'Medium',
                  maxReward: 100,
                },
                {
                  question: quizData.hard.question,
                  options: quizData.hard.options,
                  correctAnswer: quizData.hard.correctAnswer,
                  highlightWords: quizData.hard.highlightWords || [],
                  difficulty: 5,
                  difficultyText: 'Hard',
                  maxReward: 150,
                },
              ],
              timeLimit: 10,
              active: true,
              guestCard: false,
            });

            // Use Medium variant for the actual battle (fair difficulty)
            const med = quizData.medium;
            const correctIndex = med.options.indexOf(med.correctAnswer);
            // NO FALLBACK - validation already done above, but double-check
            if (correctIndex === -1) {
              console.error(`Battle gen ${idx}: correctAnswer not in options, skipping`);
              return null;
            }
            console.log(`Battle gen ${idx}: Saved full card (Easy/Medium/Hard): ${quizData.topic || med.question.substring(0, 40)}`);
            return {
              questionId: newCard._id,
              question: med.question,
              answers: med.options,
              correctIndex: correctIndex,
              points: 300,
            };
          } catch (e: any) {
            console.error(`Battle gen ${idx} failed:`, e?.message);
            return null;
          }
        });

        const generated = (await Promise.all(generationPromises)).filter((q): q is NonNullable<typeof q> => q !== null);
        battleQuestions.push(...generated);
      }
    }
    
    // Final check - do we have enough questions?
    if (battleQuestions.length < rounds) {
      // Refund the wager since we can't create the battle
      await User.findByIdAndUpdate(creatorId, { $inc: { bogxCoins: wager } });
      return NextResponse.json({ success: false, error: 'Not enough questions available for this topic' }, { status: 500 });
    }
    
    // Trim to exact number needed
    battleQuestions = battleQuestions.slice(0, rounds);
    
    console.log(`Battle ready with ${battleQuestions.length} questions`);
    
    // Create battle
    const battle = await Battle.create({
      creator: creatorId,
      topic,
      wager,
      rounds,
      questions: battleQuestions,
      status: 'open',
      isPrivate: isPrivate || false,
      challengedUser: challengedUserId || null,
      createdVia,
      createdUserAgent,
      createdReferer
    });

    console.log('[BATTLE CREATE] done', battle._id.toString(), 'via', createdVia);
    
    // Populate creator and challengedUser info
    await battle.populate('creator', 'username avatar country countryFlag points isBot');
    if (challengedUserId) {
      await battle.populate('challengedUser', 'username avatar country countryFlag');
    }
    
    // NOTE: Push notification is sent AFTER creator finishes playing (in submit API)
    // This ensures the challenged user only gets notified when the battle is ready
    
    return NextResponse.json({ success: true, battle });
  } catch (error: any) {
    console.error('Failed to create battle:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
