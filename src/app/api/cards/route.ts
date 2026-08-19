import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Question from '@/models/Question';
import UserQuestionHistory from '@/models/UserQuestionHistory';
import crypto from 'crypto';

// Simple hash for question matching
function hashQuestion(text: string): string {
  return crypto.createHash('md5').update(text.toLowerCase().replace(/[^a-z0-9]/g, '')).digest('hex');
}

/**
 * GET cards - COMPATIBILITY LAYER
 * Returns Questions in the old Card format for backwards compatibility
 * Each Question is wrapped to look like a Card with questions[] array
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    // Get all active questions
    const questions = await Question.find({ active: true }).sort({ createdAt: -1 }).lean();
    
    // Get user's seen questions
    let seenHashes = new Set<string>();
    if (userId) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const history = await UserQuestionHistory.find({
        userId,
        answeredAt: { $gte: thirtyDaysAgo }
      }).select('questionHash').lean();
      
      seenHashes = new Set(history.map((h: any) => h.questionHash));
    }
    
    // Transform Questions to Card format for backwards compatibility
    const cards = questions.map((q: any) => {
      const qHash = hashQuestion(q.question);
      const isSeen = seenHashes.has(qHash);
      
      // Wrap question in Card-like structure
      const questionVariant = {
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        difficulty: q.difficulty === 'Easy' ? 1 : q.difficulty === 'Medium' ? 3 : 5,
        difficultyText: q.difficulty,
        maxReward: q.maxReward,
        highlightWords: [],
      };
      
      return {
        _id: q._id,
        type: 'quiz',
        theme: q.theme,
        topic: q.topic || '',
        questions: [questionVariant],
        timeLimit: 10,
        previewImage: q.image || '',
        playerImage: q.image || '',
        active: q.active,
        guestCard: false,
        createdAt: q.createdAt,
        // Smart selection - mark if seen
        _selectedQuestion: questionVariant,
        _isSeen: isSeen,
      };
    });
    
    // Sort: unseen first
    if (userId) {
      cards.sort((a: any, b: any) => {
        if (a._isSeen && !b._isSeen) return 1;
        if (!a._isSeen && b._isSeen) return -1;
        return 0;
      });
    }
    
    return NextResponse.json({ success: true, cards });
    
  } catch (error: any) {
    console.error('Error fetching cards:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch cards' },
      { status: 500 }
    );
  }
}

// POST - redirect to questions API
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const data = await request.json();
    
    // Transform Card format to Question format
    const q = data.questions?.[0] || data;
    
    const question = await Question.create({
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      theme: data.theme,
      topic: data.topic,
      difficulty: q.difficultyText || 'Medium',
      maxReward: q.maxReward || 0.10,
      active: true,
      source: 'admin',
    });
    
    return NextResponse.json({ success: true, card: question });
  } catch (error: any) {
    console.error('Error creating card:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create card' },
      { status: 500 }
    );
  }
}
