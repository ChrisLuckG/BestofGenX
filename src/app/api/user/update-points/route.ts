import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function POST(request: Request) {
  try {
    await dbConnect();
    
    const { userId, pointsChange, isWin } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // Get current user to check points
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Calculate safe coin change (never go below 0) — uses bogxCoins (single source of truth)
    const currentBalance = currentUser.bogxCoins || 0;
    const safePointsChange = pointsChange < 0 
      ? Math.max(-currentBalance, pointsChange) // Don't go below 0
      : pointsChange;
    
    // Update user coins and stats
    const incData: { bogxCoins: number; gamesPlayed: number; wins?: number } = {
      bogxCoins: safePointsChange,
      gamesPlayed: 1,
    };
    
    if (isWin) {
      incData.wins = 1;
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: incData },
      { new: true }
    );
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      points: user.bogxCoins, // kept key name for backward compat with callers
      bogxCoins: user.bogxCoins,
      wins: user.wins,
      gamesPlayed: user.gamesPlayed,
    });
  } catch (error) {
    console.error('Update points error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
