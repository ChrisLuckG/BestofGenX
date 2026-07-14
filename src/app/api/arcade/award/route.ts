import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { awardBogx } from '@/lib/awardBogx';
import User from '@/models/User';

// POST - award BOGX for arcade game kills
export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { userId, game, amount, metadata } = body;

    if (!userId || !game || typeof amount !== 'number') {
      return NextResponse.json({ error: 'userId, game, and amount required' }, { status: 400 });
    }

    // Validate amount (prevent cheating)
    if (amount < 0 || amount > 0.10) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const user = await User.findById(userId).select('username bogxCoins');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Award BOGX using the standard function (creates GameResult + updates wallet)
    const newBalance = await awardBogx({
      userId,
      amount,
      source: `${game}-kill`,
      description: metadata?.type || 'arcade kill'
    });

    return NextResponse.json({ 
      success: true, 
      newBalance: newBalance ?? (user.bogxCoins || 0) + amount 
    });
  } catch (error) {
    console.error('Arcade award error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
