import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import crypto from 'crypto';

// GET - Get or create referral code for user
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    
    // Generate referral code if not exists
    if (!user.referralCode) {
      user.referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      await user.save();
    }
    
    const referralUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://bestofgenx.com'}/join?ref=${user.referralCode}`;
    
    return NextResponse.json({ 
      success: true, 
      referralCode: user.referralCode,
      referralUrl,
      referralCount: user.referralCount || 0,
      referralBonus: 500 // Points earned per successful referral
    });
  } catch (error: any) {
    console.error('Failed to get referral code:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Process a referral (when new user signs up with code)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { referralCode, newUserId } = await request.json();
    
    if (!referralCode || !newUserId) {
      return NextResponse.json({ success: false, error: 'Missing referralCode or newUserId' }, { status: 400 });
    }
    
    // Find referrer by code
    const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
    if (!referrer) {
      return NextResponse.json({ success: false, error: 'Invalid referral code' }, { status: 404 });
    }
    
    // Check if new user exists and hasn't been referred before
    const newUser = await User.findById(newUserId);
    if (!newUser) {
      return NextResponse.json({ success: false, error: 'New user not found' }, { status: 404 });
    }
    
    if (newUser.referredBy) {
      return NextResponse.json({ success: false, error: 'User already has a referrer' }, { status: 400 });
    }
    
    // Can't refer yourself
    if (referrer._id.toString() === newUserId) {
      return NextResponse.json({ success: false, error: 'Cannot refer yourself' }, { status: 400 });
    }
    
    const REFERRAL_BONUS = 500;
    
    // Update referrer
    await User.findByIdAndUpdate(referrer._id, {
      $inc: { points: REFERRAL_BONUS, referralCount: 1 }
    });
    
    // Update new user
    await User.findByIdAndUpdate(newUserId, {
      referredBy: referrer._id
    });
    
    return NextResponse.json({ 
      success: true, 
      message: `Referral successful! ${referrer.username} earned ${REFERRAL_BONUS} points.`,
      referrerUsername: referrer.username,
      bonus: REFERRAL_BONUS
    });
  } catch (error: any) {
    console.error('Failed to process referral:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
