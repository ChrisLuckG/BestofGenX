import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// POST - Update game stats after a game ends
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { userId, won } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    // Increment gamesPlayed, and wins if won
    const updateData = won 
      ? { $inc: { gamesPlayed: 1, wins: 1 } }
      : { $inc: { gamesPlayed: 1 } };

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      gamesPlayed: user.gamesPlayed,
      wins: user.wins
    });

  } catch (error: any) {
    console.error('Update game stats error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
