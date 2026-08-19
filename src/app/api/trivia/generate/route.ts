import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Question from '@/models/Question';
import UserQuestionHistory from '@/models/UserQuestionHistory';
import OpenAI from 'openai';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { combinePrompts } from '@/lib/loadPrompt';

// 6 months cooldown for questions
const QUESTION_COOLDOWN_DAYS = 180;

// Load modular prompts
const systemPrompt = combinePrompts(['core.txt', 'trivia.txt']);

// Category mapping from frontend to database themes
const CATEGORY_MAP: Record<string, string[]> = {
  'music': ['MUSIC'],
  'movies': ['TV & MOVIES'],
  'tv': ['TV & MOVIES'],
  'tv & movies': ['TV & MOVIES'],
  'sports': ['SPORTS'],
  'gaming': ['GAMING'],
  'politik': ['POLITIK'],
};

const VALID_THEMES = ['MUSIC', 'SPORTS', 'TV & MOVIES', 'GAMING', 'POLITIK'] as const;
type ValidTheme = typeof VALID_THEMES[number];

// Generate questions with OpenAI and save to DB
async function generateAndSaveQuestions(count: number, category: string | null): Promise<any[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const openai = new OpenAI({ apiKey });
  const theme = category ? (CATEGORY_MAP[category]?.[0] || 'TV & MOVIES') : 'TV & MOVIES';
  
  const categoryPrompt = category 
    ? `Focus on the category: ${category}. All questions should be about ${category}.`
    : 'Mix questions from: Music, Movies, Sports, Gaming, Politik.';

  const userPrompt = `Generate ${count} trivia questions for a quiz game.

${categoryPrompt}

Target audience: Gen X (born 1965-1980), so include references to 80s, 90s, and early 2000s.

Return a JSON array:
[
  {
    "question": "The question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "The correct option text",
    "difficulty": "Easy|Medium|Hard",
    "topic": "Short topic name"
  }
]

Requirements:
- Each question has exactly 4 options
- correctAnswer must match one of the options exactly
- Return ONLY the JSON array`;

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
  
  let questions;
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    questions = JSON.parse(jsonMatch[0]);
  } else {
    questions = JSON.parse(content);
  }

  // Save each question to DB
  const savedQuestions = [];
  for (const q of questions) {
    if (!q.question || !q.options || q.options.length !== 4) continue;
    if (!q.options.includes(q.correctAnswer)) continue;

    const questionHash = crypto.createHash('md5').update(q.question.toLowerCase().trim()).digest('hex');
    
    // Check if already exists
    const existing = await Question.findOne({ questionHash });
    if (existing) continue;

    const difficulty = ['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : 'Medium';
    const maxReward = difficulty === 'Easy' ? 0.05 : difficulty === 'Medium' ? 0.10 : 0.15;

    await Question.create({
      question: q.question,
      options: q.options.map((o: any) => String(o)),
      correctAnswer: String(q.correctAnswer),
      theme: theme as ValidTheme,
      topic: q.topic || '',
      difficulty,
      maxReward,
      active: true,
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

    // Build query
    const query: any = { active: true };
    
    if (category && CATEGORY_MAP[category]) {
      query.theme = { $in: CATEGORY_MAP[category] };
    }

    // Get questions the user has seen
    let excludeIds: mongoose.Types.ObjectId[] = [];
    
    if (userId) {
      const cooldownDate = new Date();
      cooldownDate.setDate(cooldownDate.getDate() - QUESTION_COOLDOWN_DAYS);
      
      const seenHistory = await UserQuestionHistory.find({
        userId: new mongoose.Types.ObjectId(userId),
        answeredAt: { $gte: cooldownDate }
      }).select('questionId').lean();
      
      excludeIds = seenHistory
        .filter(h => h.questionId)
        .map(h => h.questionId);
      
      console.log(`User ${userId} has seen ${excludeIds.length} questions in last 6 months`);
    }

    // Count available
    const totalAvailable = await Question.countDocuments(query);
    const unseenCount = totalAvailable - excludeIds.length;
    
    console.log(`Total questions: ${totalAvailable}, Unseen: ${unseenCount}, Requested: ${count}`);

    // Exclude seen questions
    if (excludeIds.length > 0) {
      query._id = { $nin: excludeIds };
    }
    
    // Get random questions
    let questions = await Question.aggregate([
      { $match: query },
      { $sample: { size: count } }
    ]);

    // If pool is low, generate more in background
    if (unseenCount < 50 && unseenCount > 0) {
      console.log(`Low pool (${unseenCount}), generating more...`);
      generateAndSaveQuestions(20, category).catch(e => 
        console.error('Background generation failed:', e)
      );
    }

    // If not enough, include seen questions (oldest first)
    if (questions.length < count && userId && excludeIds.length > 0) {
      const needed = count - questions.length;
      
      const oldestSeen = await UserQuestionHistory.find({
        userId: new mongoose.Types.ObjectId(userId),
      })
        .sort({ answeredAt: 1 })
        .limit(needed * 2)
        .select('questionId')
        .lean();
      
      const oldIds = oldestSeen.filter(h => h.questionId).map(h => h.questionId);
      
      if (oldIds.length > 0) {
        const oldQuestions = await Question.aggregate([
          { $match: { _id: { $in: oldIds }, active: true } },
          { $sample: { size: needed } }
        ]);
        questions = [...questions, ...oldQuestions];
      }
    }

    // Still not enough? Generate fresh
    if (questions.length < count) {
      console.log(`Only ${questions.length}, generating fresh...`);
      const generated = await generateAndSaveQuestions(count, category);
      
      if (questions.length === 0) {
        return NextResponse.json({ 
          success: true, 
          questions: generated.slice(0, count) 
        });
      }
    }

    // Transform to frontend format
    const result = questions.map(q => {
      const correctIndex = q.options.findIndex((o: string) => o === q.correctAnswer);
      if (correctIndex === -1) {
        console.error('Invalid question:', q._id);
        return null;
      }

      return {
        _id: q._id,
        question: q.question,
        options: q.options,
        correctIndex,
        category: q.theme,
        difficulty: q.difficulty,
      };
    }).filter(Boolean);

    return NextResponse.json({ 
      success: true, 
      questions: result.slice(0, count) 
    });

  } catch (error: any) {
    console.error('Trivia fetch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
