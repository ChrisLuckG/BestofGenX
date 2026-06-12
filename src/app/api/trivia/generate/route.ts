import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Card from '@/models/Card';
import UserQuestionHistory from '@/models/UserQuestionHistory';
import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';

// 6 months cooldown for questions
const QUESTION_COOLDOWN_DAYS = 180;

// Load system prompt - NO FALLBACK
const systemPromptPath = join(process.cwd(), 'src/prompts/system-prompt.txt');
const systemPrompt = readFileSync(systemPromptPath, 'utf-8');

// Category mapping from frontend to database themes
const CATEGORY_MAP: Record<string, string[]> = {
  'music': ['MUSIC', 'Music', 'music'],
  'movies': ['MOVIES', 'Movies', 'movies', 'FILM', 'Film', 'film', 'TV', 'MOVIES & TV', 'Movies & TV'],
  'sports': ['SPORTS', 'Sports', 'sports', 'SPORT', 'Sport', 'sport'],
  'history': ['HISTORY', 'History', 'history'],
  'science': ['SCIENCE', 'Science', 'science', 'TECH', 'Tech', 'tech'],
};

const THEME_NAMES: Record<string, string> = {
  'music': 'MUSIC',
  'movies': 'FILM',
  'sports': 'SPORT',
  'history': 'HISTORY',
  'science': 'SCIENCE',
};

// Generate questions with OpenAI and save to DB
async function generateAndSaveQuestions(count: number, category: string | null): Promise<any[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const openai = new OpenAI({ apiKey });
  const theme = category ? THEME_NAMES[category] || 'GENERAL' : 'GENERAL';
  
  const categoryPrompt = category 
    ? `Focus on the category: ${category}. All questions should be about ${category}.`
    : 'Mix questions from various categories: Music, Movies & TV, Sports, History, Science, Pop Culture.';

  const userPrompt = `Generate ${count} trivia questions for a quiz game.

${categoryPrompt}

Target audience: Gen X (born 1965-1980), so include references to 80s, 90s, and early 2000s pop culture when relevant.

Return a JSON array with this exact format:
[
  {
    "topic": "Short topic name",
    "question": "The question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "The correct option text",
    "difficulty": 3,
    "difficultyText": "Medium"
  }
]

Requirements:
- Each question has exactly 4 options
- correctAnswer must match one of the options exactly
- difficulty is 1-5 (1=Easy, 5=Hard)
- Questions should be challenging but fair
- Return ONLY the JSON array, no other text`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.9,
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content || '[]';
  
  // Parse JSON
  let questions;
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    questions = JSON.parse(jsonMatch[0]);
  } else {
    questions = JSON.parse(content);
  }

  // Save each question to DB as a Card
  const savedQuestions = [];
  for (const q of questions) {
    if (!q.question || !q.options || q.options.length !== 4) continue;

    const questionHash = crypto.createHash('md5').update(q.question).digest('hex');
    
    // Check if already exists
    const existing = await Card.findOne({ questionHash });
    if (existing) continue;

    const card = await Card.create({
      type: 'quiz',
      theme: theme,
      topic: q.topic || 'General',
      questions: [{
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        highlightWords: [],
        difficulty: q.difficulty || 3,
        difficultyText: q.difficultyText || 'Medium',
        maxReward: 100,
      }],
      timeLimit: 10,
      active: true,
      guestCard: false,
      questionHash,
      source: 'generated',
    });

    savedQuestions.push({
      question: q.question,
      options: q.options,
      correctIndex: q.options.indexOf(q.correctAnswer),
      category: theme,
    });
  }

  return savedQuestions;
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { count = 10, category, userId } = await request.json();

    // Build query - get active cards
    const query: any = { active: true };
    
    // Filter by category if specified
    if (category && CATEGORY_MAP[category]) {
      query.theme = { $in: CATEGORY_MAP[category] };
    }

    // Get cards the user has seen in the last 6 months
    let excludeCardIds: mongoose.Types.ObjectId[] = [];
    if (userId) {
      const cooldownDate = new Date();
      cooldownDate.setDate(cooldownDate.getDate() - QUESTION_COOLDOWN_DAYS);
      
      const seenHistory = await UserQuestionHistory.find({
        userId: new mongoose.Types.ObjectId(userId),
        answeredAt: { $gte: cooldownDate }
      }).select('cardId').lean();
      
      excludeCardIds = seenHistory.map(h => h.cardId);
      console.log(`User ${userId} has seen ${excludeCardIds.length} questions in last 6 months`);
    }

    // Exclude seen cards
    if (excludeCardIds.length > 0) {
      query._id = { $nin: excludeCardIds };
    }

    // Get random cards from database
    let cards = await Card.aggregate([
      { $match: query },
      { $sample: { size: count } }
    ]);

    // If not enough questions, generate more
    if (!cards || cards.length < count) {
      console.log(`Only ${cards?.length || 0} questions in DB, generating ${count} more...`);
      const generated = await generateAndSaveQuestions(count, category);
      
      // Fetch again after generating
      cards = await Card.aggregate([
        { $match: query },
        { $sample: { size: count } }
      ]);
      
      // If still no cards, use the generated ones directly
      if (!cards || cards.length === 0) {
        return NextResponse.json({ 
          success: true, 
          questions: generated.slice(0, count) 
        });
      }
    }

    // Transform cards to trivia format - NO FALLBACKS
    const questions = cards.map(card => {
      const variants = card.questions || [];
      const variant = variants.length > 0 
        ? variants[Math.floor(Math.random() * variants.length)]
        : null;

      if (!variant) {
        console.error('Card has no question variants:', card._id);
        return null;
      }

      const correctAnswer = variant.correctAnswer;
      const options = variant.options?.map((o: any) => String(o));
      
      // Strict validation - NO FALLBACKS
      if (!variant.question || typeof variant.question !== 'string') {
        console.error('Invalid question text in card:', card._id);
        return null;
      }
      if (!Array.isArray(options) || options.length !== 4) {
        console.error('Invalid options in card:', card._id, options);
        return null;
      }
      
      const correctIndex = options.findIndex((o: string) => o === String(correctAnswer));
      if (correctIndex === -1) {
        console.error('Correct answer not found in options:', card._id, { correctAnswer, options });
        return null; // NO FALLBACK - reject invalid question
      }

      return {
        question: variant.question,
        options: options,
        correctIndex: correctIndex,
        category: card.theme || 'General'
      };
    }).filter(Boolean);

    return NextResponse.json({ 
      success: true, 
      questions: questions.slice(0, count) 
    });

  } catch (error: any) {
    console.error('Trivia fetch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
