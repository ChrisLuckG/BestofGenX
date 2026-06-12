import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// GET - Get current user points from DB
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 });
    }
    
    const user = await User.findById(userId).select('points bogxCoins coins wins gamesPlayed');
    
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      points: user.points || 0,
      bogxCoins: user.bogxCoins || 0,
      coins: user.coins || 0,
      wins: user.wins || 0,
      gamesPlayed: user.gamesPlayed || 0,
    });
    
  } catch (error: any) {
    console.error('Get points error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
