import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Card from '@/models/Card';

/**
 * GET - Get a pool of individual questions from all cards
 * Supports filtering by theme, difficulty, and count
 * Returns flattened questions (not grouped by card)
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const theme = searchParams.get('theme'); // MUSIC, MOVIES, etc. or null for all
    const difficulty = searchParams.get('difficulty'); // easy, medium, hard or null for all
    const count = parseInt(searchParams.get('count') || '10');
    const excludeIds = searchParams.get('excludeIds')?.split(',').filter(Boolean) || [];
    
    // Build query for cards
    const cardQuery: any = { 
      active: true,
      'questions.0': { $exists: true } // Must have at least one question
    };
    
    if (theme && theme !== 'MIX' && theme !== 'ALL') {
      cardQuery.theme = theme;
    }
    
    // Get all matching cards with their questions
    const cards = await Card.find(cardQuery)
      .select('_id theme topic questions previewImage playerImage')
      .lean();
    
    // Flatten all questions from all cards
    const allQuestions: any[] = [];
    
    for (const card of cards) {
      if (!card.questions || !Array.isArray(card.questions)) continue;
      
      for (const question of card.questions) {
        // Skip if no question text
        if (!question.question) continue;
        
        // Filter by difficulty if specified
        if (difficulty) {
          const difficultyText = question.difficultyText?.toLowerCase() || '';
          if (difficulty.toLowerCase() !== difficultyText) continue;
        }
        
        // Create unique ID for this question
        const questionId = `${card._id}_${question.difficulty || 0}`;
        
        // Skip excluded questions
        if (excludeIds.includes(questionId)) continue;
        
        allQuestions.push({
          questionId,
          cardId: card._id,
          theme: card.theme,
          topic: card.topic,
          question: question.question,
          options: question.options,
          correctAnswer: question.correctAnswer,
          highlightWords: question.highlightWords || [],
          difficulty: question.difficulty,
          difficultyText: question.difficultyText,
          maxReward: question.maxReward,
          previewImage: card.previewImage,
          playerImage: card.playerImage,
        });
      }
    }
    
    // Shuffle the questions
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    
    // Return requested count
    const result = shuffled.slice(0, count);
    
    return NextResponse.json({
      success: true,
      questions: result,
      total: result.length,
      availableTotal: allQuestions.length,
    });
    
  } catch (error: any) {
    console.error('Question pool error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
