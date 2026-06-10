import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// Reset all bot points to similar values so they overtake each other
export async function POST() {
  try {
    await dbConnect();
    
    const bots = await User.find({ 
      $or: [
        { isBot: true },
        { email: { $regex: /@bot\.sporttock\.com$/ } }
      ]
    });
    
    // Reset all bots to 0 points, 0 games, 0 wins (fresh start)
    await User.updateMany(
      { $or: [{ isBot: true }, { email: { $regex: /@bot\.sporttock\.com$/ } }] },
      { $set: { points: 0, gamesPlayed: 0, wins: 0 } }
    );
    
    return NextResponse.json({ 
      success: true, 
      message: `Reset ${bots.length} bots to 0 points` 
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
