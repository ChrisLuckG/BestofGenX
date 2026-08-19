import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Question from '@/models/Question';
import UserQuestionHistory from '@/models/UserQuestionHistory';
import mongoose from 'mongoose';

const QUESTION_COOLDOWN_DAYS = 180;

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const count = parseInt(searchParams.get('count') || '5');
    const theme = searchParams.get('theme');
    
    // Build query
    const query: any = { active: true };
    
    if (theme && theme !== 'ALL') {
      // Map frontend categories to DB themes
      const themeMap: Record<string, string> = {
        'MUSIC': 'MUSIC',
        'SPORTS': 'SPORTS',
        'TV & MOVIES': 'TV & MOVIES',
        'TV': 'TV & MOVIES',
        'MOVIES': 'TV & MOVIES',
        'GAMING': 'GAMING',
        'POLITIK': 'POLITIK',
      };
      query.theme = themeMap[theme.toUpperCase()] || theme;
    }

    // Get questions user has seen recently
    let excludeIds: mongoose.Types.ObjectId[] = [];
    
    if (userId && userId !== 'guest' && mongoose.Types.ObjectId.isValid(userId)) {
      const cooldownDate = new Date();
      cooldownDate.setDate(cooldownDate.getDate() - QUESTION_COOLDOWN_DAYS);
      
      const seenHistory = await UserQuestionHistory.find({
        userId: new mongoose.Types.ObjectId(userId),
        answeredAt: { $gte: cooldownDate }
      }).select('questionId').lean();
      
      excludeIds = seenHistory
        .filter(h => h.questionId)
        .map(h => h.questionId!);
    }

    // Exclude seen questions
    if (excludeIds.length > 0) {
      query._id = { $nin: excludeIds };
    }
    
    // Get random questions
    let questions = await Question.aggregate([
      { $match: query },
      { $sample: { size: count } }
    ]);

    // If not enough, include seen questions
    if (questions.length < count && excludeIds.length > 0) {
      delete query._id;
      const moreQuestions = await Question.aggregate([
        { $match: query },
        { $sample: { size: count } }
      ]);
      questions = moreQuestions;
    }

    // Transform to frontend format (compatible with old Card format)
    const result = questions.map(q => ({
      _id: q._id,
      theme: q.theme,
      topic: q.topic,
      // Wrap in questions array for backwards compatibility
      questions: [{
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        difficulty: q.difficulty,
      }],
    }));

    return NextResponse.json({ 
      success: true, 
      questions: result,
      total: result.length,
    });

  } catch (error: any) {
    console.error('Smart questions error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
