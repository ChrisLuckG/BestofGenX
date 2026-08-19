import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Question from '@/models/Question';
import OpenAI from 'openai';
import crypto from 'crypto';
import { combinePrompts } from '@/lib/loadPrompt';

const systemPrompt = combinePrompts(['core.txt', 'trivia.txt']);

// Official 5 categories
const THEMES = ['MUSIC', 'SPORTS', 'TV & MOVIES', 'GAMING', 'POLITIK'] as const;
type Theme = typeof THEMES[number];

// Get existing topics to avoid repetition
async function getExistingTopics(theme: string): Promise<string[]> {
  const questions = await Question.find({ theme: theme as Theme })
    .select('topic question')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  
  const topics = new Set<string>();
  for (const q of questions) {
    if (q.topic) topics.add(q.topic);
  }
  return Array.from(topics).slice(0, 30);
}

// Generate a SINGLE question
async function generateSingleQuestion(
  openai: OpenAI, 
  theme: string,
  difficulty: 'Easy' | 'Medium' | 'Hard',
  avoidTopics: string[]
): Promise<boolean> {
  
  const avoidList = avoidTopics.length > 0 
    ? `\nAVOID these topics (already exist): ${avoidTopics.slice(0, 20).join(', ')}`
    : '';
  
  const difficultyGuide = {
    'Easy': 'Basic knowledge that most people would know',
    'Medium': 'Requires some specific knowledge',
    'Hard': 'Obscure facts that only enthusiasts would know',
  };

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Generate ONE ${difficulty} trivia question for: ${theme}

Difficulty: ${difficultyGuide[difficulty]}
${avoidList}

Pick an interesting, unexpected topic. Return JSON:
{
  "topic": "The specific subject",
  "question": "The question text",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": "The correct option (must be one of the options)"
}`
        }
      ],
      temperature: 1.2,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return false;
    
    const data = JSON.parse(content);
    
    // Validate
    if (!data.question || !Array.isArray(data.options) || data.options.length !== 4 ||
        !data.correctAnswer || !data.options.includes(data.correctAnswer)) {
      console.log(`Invalid question format, skipping`);
      return false;
    }

    // Check for duplicate
    const questionHash = crypto.createHash('md5')
      .update(data.question.toLowerCase().trim())
      .digest('hex');
    
    const existing = await Question.findOne({ questionHash });
    if (existing) {
      console.log(`Duplicate: ${data.question.slice(0, 40)}...`);
      return false;
    }

    // Save
    const maxReward = difficulty === 'Easy' ? 0.05 : difficulty === 'Medium' ? 0.10 : 0.15;
    
    await Question.create({
      question: data.question,
      options: data.options,
      correctAnswer: data.correctAnswer,
      theme: theme as Theme,
      topic: data.topic || 'General',
      difficulty,
      maxReward,
      questionHash,
      active: true,
      source: 'generated',
      timesPlayed: 0,
      timesCorrect: 0,
    });
    
    console.log(`Saved: [${difficulty}] ${data.question.slice(0, 50)}...`);
    return true;
    
  } catch (e) {
    console.error(`Error generating question:`, e);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { count = 10, theme, difficulty } = await request.json();
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'OpenAI API key not configured' }, { status: 500 });
    }
    
    const openai = new OpenAI({ apiKey });
    
    // Get current counts
    const totalBefore = await Question.countDocuments({ active: true });
    
    let generated = 0;
    const difficulties: ('Easy' | 'Medium' | 'Hard')[] = ['Easy', 'Medium', 'Hard'];
    
    // If specific difficulty requested, use only that
    const getDifficulty = (index: number): 'Easy' | 'Medium' | 'Hard' => {
      if (difficulty && ['Easy', 'Medium', 'Hard'].includes(difficulty)) {
        return difficulty as 'Easy' | 'Medium' | 'Hard';
      }
      return difficulties[index % 3]; // Rotate if no specific difficulty
    };
    
    if (theme) {
      // Generate for specific theme
      const avoidTopics = await getExistingTopics(theme);
      
      for (let i = 0; i < count; i++) {
        const diff = getDifficulty(i);
        const success = await generateSingleQuestion(openai, theme, diff, avoidTopics);
        if (success) generated++;
      }
    } else {
      // Generate evenly across all themes
      const perTheme = Math.ceil(count / THEMES.length);
      
      for (const t of THEMES) {
        const avoidTopics = await getExistingTopics(t);
        
        for (let i = 0; i < perTheme; i++) {
          const diff = getDifficulty(i);
          const success = await generateSingleQuestion(openai, t, diff, avoidTopics);
          if (success) generated++;
        }
      }
    }
    
    // Get new counts
    const totalAfter = await Question.countDocuments({ active: true });
    
    const newCounts: Record<string, number> = {};
    for (const t of THEMES) {
      newCounts[t] = await Question.countDocuments({ theme: t as Theme, active: true });
    }
    
    return NextResponse.json({
      success: true,
      generated,
      totalBefore,
      totalAfter,
      countsByTheme: newCounts,
    });
    
  } catch (error: any) {
    console.error('Question generation error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET: Return current counts
export async function GET() {
  try {
    await dbConnect();
    
    const counts: Record<string, number> = {};
    for (const t of THEMES) {
      counts[t] = await Question.countDocuments({ theme: t as Theme, active: true });
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    
    return NextResponse.json({
      success: true,
      total,
      countsByTheme: counts,
    });
    
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
