import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import Card from '@/models/Card';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// GET - List open battles
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic');
    const status = searchParams.get('status') || 'open';
    const userId = searchParams.get('userId'); // Current user ID to show their private battles
    
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
      query.$and = [
        {
          $or: [
            { 'creatorResults.0': { $exists: true } },
            { creator: { $in: botIds } }
          ]
        }
      ];
      
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
    
    const battles = await Battle.find(query)
      .select('_id creator opponent topic wager rounds status questions creatorResults opponentResults creatorTotalPoints opponentTotalPoints winner isPrivate challengedUser createdAt')
      .populate('creator', 'username avatar country countryFlag points isBot')
      .populate('opponent', 'username avatar country countryFlag points isBot')
      .sort({ createdAt: -1 })
      .limit(50);
    
    console.log('Battles query result - isPrivate values:', battles.map(b => ({ id: b._id, isPrivate: b.isPrivate })));
    
    // Auto-trigger bot battles if pool is too empty (async, don't wait)
    if (status === 'open' && battles.length < 3) {
      triggerBotBattles().catch(console.error);
    }
    
    // Return with no-cache headers to ensure fresh data globally
    return NextResponse.json(
      { success: true, battles },
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
    const { creatorId, topic, wager, rounds, isPrivate, challengedUserId } = body;
    
    console.log('Creating battle with:', { creatorId, topic, wager, rounds, isPrivate, challengedUserId });
    
    // Validate
    if (!creatorId || !topic || !wager || !rounds) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    
    // Check if creator exists and has enough points
    const creator = await User.findById(creatorId);
    if (!creator) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    
    if (creator.points < wager) {
      return NextResponse.json({ success: false, error: 'Not enough points' }, { status: 400 });
    }
    
    // Deduct wager from creator immediately (with atomic check to prevent negative)
    const updateResult = await User.findOneAndUpdate(
      { _id: creatorId, points: { $gte: wager } },
      { $inc: { points: -wager } },
      { new: true }
    );
    
    if (!updateResult) {
      return NextResponse.json({ success: false, error: 'Not enough points' }, { status: 400 });
    }
    
    // Map topic to theme for Card model
    const themeMap: { [key: string]: string } = {
      sport: 'SPORTS', music: 'MUSIC', film: 'FILM', culture: 'CULTURE',
      fashion: 'FASHION', games: 'GAMES', tv: 'TV', art: 'ART', food: 'FOOD'
    };
    const theme = themeMap[topic] || 'CULTURE';
    
    // 1. Try to get existing cards from database first
    // Prioritize today's cards, then fall back to archive
    let battleQuestions: any[] = [];
    const usedQuestionIds = new Set<string>();
    
    // Get questions the user has already seen (last 30 days)
    const UserQuestionHistory = (await import('@/models/UserQuestionHistory')).default;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const seenHistory = await UserQuestionHistory.find({ 
      userId: creatorId,
      answeredAt: { $gte: thirtyDaysAgo }
    }).select('cardId questionText').lean();
    
    const seenCardIds = new Set(seenHistory.map((h: any) => h.cardId?.toString()));
    const seenQuestionTexts = new Set(seenHistory.map((h: any) => h.questionText?.toLowerCase().trim()));
    
    console.log(`User ${creatorId} has seen ${seenCardIds.size} cards in last 30 days`);
    
    // Get all active cards for this theme (no date filtering)
    const allCards = await Card.find({ 
      theme: { $regex: new RegExp(theme, 'i') }, 
      active: true,
      'questions.2': { $exists: true } // Must have all 3 difficulties
    }).lean();
    
    // Shuffle cards
    allCards.sort(() => Math.random() - 0.5);
    
    // Flatten all questions from all cards (all difficulties)
    // Separate into unseen and seen questions
    const unseenQuestions: any[] = [];
    const seenQuestions: any[] = [];
    
    for (const card of allCards) {
      if (!card.questions || !Array.isArray(card.questions)) continue;
      for (const q of card.questions) {
        if (!q.question || !q.options || q.options.length !== 4) continue;
        const questionId = `${card._id}_${q.difficulty || 0}`;
        if (usedQuestionIds.has(questionId)) continue;
        
        const correctIndex = q.options.indexOf(q.correctAnswer);
        // NO FALLBACK - skip invalid questions
        if (correctIndex === -1) {
          console.error('Correct answer not found in options, skipping card:', card._id);
          continue;
        }
        
        const questionObj = {
          questionId,
          cardId: card._id,
          question: q.question,
          answers: q.options,
          correctIndex: correctIndex,
          points: q.maxReward || 100,
          difficulty: q.difficulty,
          difficultyText: q.difficultyText
        };
        
        // Check if user has seen this question
        const questionTextLower = q.question.toLowerCase().trim();
        if (seenQuestionTexts.has(questionTextLower)) {
          seenQuestions.push(questionObj);
        } else {
          unseenQuestions.push(questionObj);
        }
      }
    }
    
    // Prioritize unseen questions, only use seen if not enough unseen
    console.log(`Questions: ${unseenQuestions.length} unseen, ${seenQuestions.length} seen`);
    
    // Shuffle unseen questions first
    const shuffledUnseen = unseenQuestions.sort(() => Math.random() - 0.5);
    const shuffledSeen = seenQuestions.sort(() => Math.random() - 0.5);
    
    // Take from unseen first, then seen if needed
    if (shuffledUnseen.length >= rounds) {
      battleQuestions = shuffledUnseen.slice(0, rounds);
    } else {
      battleQuestions = [...shuffledUnseen, ...shuffledSeen.slice(0, rounds - shuffledUnseen.length)];
    }
    
    console.log(`Using ${battleQuestions.length} questions for battle (topic: ${topic}, total cards: ${allCards.length})`);
    
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
        const promptPath = path.join(process.cwd(), 'src', 'prompts', 'system-prompt.txt');
        const systemPrompt = fs.readFileSync(promptPath, 'utf-8');

        console.log(`Generating ${questionsNeeded} NEW full quiz-sets (Easy+Medium+Hard) for theme: ${theme}`);

        // Generate one full quiz-set per missing question, in parallel for speed
        const generationPromises = Array.from({ length: questionsNeeded }, async (_, idx) => {
          try {
            const completion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Generate 3 quiz questions (Easy, Medium, Hard) about: ${theme}` }
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
      await User.findByIdAndUpdate(creatorId, { $inc: { points: wager } });
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
      challengedUser: challengedUserId || null
    });
    
    // Populate creator info
    await battle.populate('creator', 'username avatar country countryFlag points isBot');
    
    // NOTE: Push notification is sent AFTER creator finishes playing (in submit API)
    // This ensures the challenged user only gets notified when the battle is ready
    
    return NextResponse.json({ success: true, battle });
  } catch (error: any) {
    console.error('Failed to create battle:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
