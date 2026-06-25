import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import GameResult from '@/models/GameResult';
import User from '@/models/User';

// POST - save a single game result
export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const {
      userId, cardId, question, userAnswer, correctAnswer,
      isCorrect, pointsChange, timeUsed, difficulty, skipped, timedOut,
    } = body;

    if (!userId || !cardId) {
      return NextResponse.json({ error: 'userId and cardId required' }, { status: 400 });
    }

    const user = await User.findById(userId).select('username bogxCoins');
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const balanceAfter = user.bogxCoins || 0;
    const pointsBefore = balanceAfter - pointsChange; // balance already updated
    // Use Berlin time for gameDate to match ranking system
    const berlinDate = new Date().toLocaleString('en-CA', { 
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit'
    }).split(',')[0];
    const today = berlinDate;

    const result = await GameResult.create({
      userId,
      username: user.username,
      cardId,
      question,
      userAnswer: userAnswer ?? null,
      correctAnswer,
      isCorrect,
      pointsChange,
      pointsBefore,
      pointsAfter: balanceAfter,
      timeUsed: timeUsed ?? 0,
      difficulty: difficulty ?? 1,
      skipped: skipped ?? false,
      timedOut: timedOut ?? false,
      gameDate: today,
    });

    return NextResponse.json({ success: true, id: result._id });
  } catch (error) {
    console.error('Save game result error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE - delete game results for a user (optionally filtered by date)
export async function DELETE(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const date = searchParams.get('date');

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const query: Record<string, unknown> = { userId };
    if (date) query.gameDate = date;

    const result = await GameResult.deleteMany(query);

    return NextResponse.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    console.error('Delete game results error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// GET - fetch history for a user
export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const date = searchParams.get('date');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const query: Record<string, unknown> = { userId };
    if (date) query.gameDate = date;

    const results = await GameResult.find(query)
      .sort({ playedAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Fetch game results error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
