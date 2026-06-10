import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// GET - Check if a user has push subscription enabled
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const username = searchParams.get('username');
    
    let user;
    if (userId) {
      user = await User.findById(userId).select('username pushSubscription pushSubscriptionUpdatedAt').lean();
    } else if (username) {
      user = await User.findOne({ username }).select('username pushSubscription pushSubscriptionUpdatedAt').lean();
    } else {
      return NextResponse.json({ error: 'Provide userId or username' }, { status: 400 });
    }
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const hasPush = !!user.pushSubscription;
    const subscription = user.pushSubscription as any;
    
    return NextResponse.json({
      username: user.username,
      hasPushSubscription: hasPush,
      subscriptionUpdatedAt: user.pushSubscriptionUpdatedAt,
      endpoint: hasPush ? subscription?.endpoint?.substring(0, 60) + '...' : null,
      hasKeys: hasPush ? !!(subscription?.keys?.p256dh && subscription?.keys?.auth) : false
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
