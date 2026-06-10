import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// POST: Save push subscription for user
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { userId, subscription } = await request.json();

    if (!userId || !subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }

    // Save subscription to user
    await User.findByIdAndUpdate(userId, {
      pushSubscription: subscription,
      pushSubscriptionUpdatedAt: new Date()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Remove push subscription
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    await User.findByIdAndUpdate(userId, {
      $unset: { pushSubscription: 1 }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing push subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
