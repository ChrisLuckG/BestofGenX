import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import GameResult from '@/models/GameResult';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { userId, amount, source, description, skipGameResult } = await request.json();

    if (!userId || typeof amount !== 'number') {
      return NextResponse.json({ success: false, error: 'Missing userId or amount' }, { status: 400 });
    }

    // Get user before update for pointsBefore
    const userBefore = await User.findById(userId).select('bogxCoins username');
    if (!userBefore) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Update bogxCoins (can be positive or negative)
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { bogxCoins: amount } },
      { new: true }
    );

    // Save GameResult for ranking system (unless explicitly skipped)
    // This tracks ALL BOGX earnings: games, voting, articles, etc.
    if (!skipGameResult && amount !== 0) {
      // Use Berlin time for gameDate to match ranking system
      const today = new Date().toLocaleString('en-CA', { 
        timeZone: 'Europe/Berlin',
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit'
      }).split(',')[0];
      await GameResult.create({
        userId,
        username: userBefore.username,
        cardId: source || 'bogx-update',
        question: description || (amount > 0 ? 'BOGX earned' : 'BOGX spent'),
        userAnswer: null,
        correctAnswer: '-',
        isCorrect: amount > 0,
        pointsChange: amount,
        pointsBefore: userBefore.bogxCoins || 0,
        pointsAfter: user.bogxCoins || 0,
        timeUsed: 0,
        difficulty: 1,
        skipped: false,
        timedOut: false,
        gameDate: today,
      });
    }

    return NextResponse.json({ 
      success: true, 
      bogxCoins: user.bogxCoins,
      change: amount
    });

  } catch (error: any) {
    console.error('Update BOGX error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
