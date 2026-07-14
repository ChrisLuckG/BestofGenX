import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import GameResult from '@/models/GameResult';

// POST - Add coins to a user
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { username, amount } = await request.json();
    
    if (!username || !amount) {
      return NextResponse.json({ success: false, error: 'Missing username or amount' }, { status: 400 });
    }
    
    const userBefore = await User.findOne({ username }).select('bogxCoins username');
    if (!userBefore) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const user = await User.findOneAndUpdate(
      { username },
      { $inc: { bogxCoins: amount } },
      { new: true }
    );
    
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Record ledger entry so ranking scores stay in sync with the wallet
    try {
      const today = new Date().toLocaleString('en-CA', {
        timeZone: 'Europe/Berlin',
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).split(',')[0];
      await GameResult.create({
        userId: user._id,
        username: user.username,
        cardId: 'admin-adjustment',
        question: 'Admin BOGX adjustment',
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
    } catch (e) {
      console.error('add-coins: failed to create GameResult:', e);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Added ${amount} BOGX to ${username}`,
      newBalance: user.bogxCoins
    });
  } catch (error: any) {
    console.error('Add coins error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
