import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Card from '@/models/Card';
import UserQuestionHistory from '@/models/UserQuestionHistory';
import crypto from 'crypto';

// Simple hash for question matching
function hashQuestion(text: string): string {
  return crypto.createHash('md5').update(text.toLowerCase().replace(/[^a-z0-9]/g, '')).digest('hex');
}

// GET cards - optionally filter by date and user's question history
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId'); // Optional: for smart question selection
    
    // Get all active cards (no date filtering - questions are tracked per user)
    const cards = await Card.find({ active: true }).sort({ createdAt: -1 }).lean();
    
    // If userId provided, select questions user hasn't seen recently
    if (userId) {
      // Get user's question history (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const history = await UserQuestionHistory.find({
        userId,
        answeredAt: { $gte: thirtyDaysAgo }
      }).select('questionHash').lean();
      
      const seenHashes = new Set(history.map((h: any) => h.questionHash));
      
      // For each card, pick a question the user hasn't seen
      const cardsWithSmartQuestions = cards.map((card: any) => {
        if (!card.questions || card.questions.length === 0) return card;
        
        // Find unseen questions
        const unseenQuestions = card.questions.filter((q: any) => {
          if (!q.question) return true;
          const hash = hashQuestion(q.question);
          return !seenHashes.has(hash);
        });
        
        // Pick from unseen, or random if all seen
        const selectedQuestion = unseenQuestions.length > 0
          ? unseenQuestions[Math.floor(Math.random() * unseenQuestions.length)]
          : card.questions[Math.floor(Math.random() * card.questions.length)];
        
        return {
          ...card,
          _selectedQuestion: selectedQuestion
        };
      });
      
      return NextResponse.json({ success: true, cards: cardsWithSmartQuestions });
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

// POST create new card
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const data = await request.json();
    
    const card = await Card.create(data);
    
    return NextResponse.json({ success: true, card });
  } catch (error: any) {
    console.error('Error creating card:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create card' },
      { status: 500 }
    );
  }
}
