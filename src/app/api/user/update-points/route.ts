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
    
    // Calculate safe points change (never go below 0)
    const safePointsChange = pointsChange < 0 
      ? Math.max(-currentUser.points, pointsChange) // Don't go below 0
      : pointsChange;
    
    // Update user points and stats
    const incData: { points: number; gamesPlayed: number; wins?: number } = {
      points: safePointsChange,
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
      points: user.points,
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
