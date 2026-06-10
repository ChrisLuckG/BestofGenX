import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { getQuestionsForUser, recordQuestionAnswer } from '@/lib/questionService';

/**
 * GET - Get smart questions for a user (avoiding recently seen)
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const theme = searchParams.get('theme') || undefined;
    const count = parseInt(searchParams.get('count') || '10');
    const context = (searchParams.get('context') || 'game') as 'game' | 'battle';
    const date = searchParams.get('date'); // For daily cards
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }
    
    const questions = await getQuestionsForUser(userId, {
      theme,
      count,
      context,
    });
    
    // If date filter is provided, filter by gameDate
    let filteredQuestions = questions;
    if (date) {
      filteredQuestions = questions.filter(q => q.gameDate === date);
    }
    
    return NextResponse.json({
      success: true,
      questions: filteredQuestions,
      total: filteredQuestions.length,
      hasUnseen: filteredQuestions.some(q => !q._seenByUser),
    });
    
  } catch (error: any) {
    console.error('Smart questions error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Record that a user answered a question
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { userId, cardId, questionText, correct, context, battleId } = await request.json();
    
    if (!userId || !cardId || !questionText || correct === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    await recordQuestionAnswer(
      userId,
      cardId,
      questionText,
      correct,
      context || 'game',
      battleId
    );
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('Record answer error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
