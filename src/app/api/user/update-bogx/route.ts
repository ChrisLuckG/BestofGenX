import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { userId, amount } = await request.json();

    if (!userId || typeof amount !== 'number') {
      return NextResponse.json({ success: false, error: 'Missing userId or amount' }, { status: 400 });
    }

    // Update bogxCoins (can be positive or negative)
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { bogxCoins: amount } },
      { new: true }
    );

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
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
