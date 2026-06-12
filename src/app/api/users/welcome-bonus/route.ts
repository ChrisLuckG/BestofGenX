import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// POST - Claim welcome bonus (500 points, only once per user)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      );
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if already received
    if (user.hasReceivedWelcomeBonus) {
      return NextResponse.json({
        success: true,
        alreadyReceived: true,
        points: user.points,
        message: 'Welcome bonus already claimed'
      });
    }

    // Give welcome bonus (5.00 BOGX)
    const WELCOME_BONUS = 5.00;
    user.points += WELCOME_BONUS;
    user.hasReceivedWelcomeBonus = true;
    await user.save();

    return NextResponse.json({
      success: true,
      alreadyReceived: false,
      bonusAmount: WELCOME_BONUS,
      points: user.points,
      message: 'Welcome bonus claimed!'
    });

  } catch (error: any) {
    console.error('Error claiming welcome bonus:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to claim bonus' },
      { status: 500 }
    );
  }
}

// GET - Check if user has received welcome bonus
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      );
    }

    const user = await User.findById(userId).select('hasReceivedWelcomeBonus points');
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      hasReceivedWelcomeBonus: user.hasReceivedWelcomeBonus || false,
      points: user.points
    });

  } catch (error: any) {
    console.error('Error checking welcome bonus:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check bonus' },
      { status: 500 }
    );
  }
}
