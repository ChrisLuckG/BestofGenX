import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Find user with valid token
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired verification link' }, { status: 400 });
    }

    // Mark email as verified
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    // Now reward the referrer (if any) since email is verified
    const REFERRAL_REWARD = 500;
    if (user.referredBy) {
      await User.findByIdAndUpdate(user.referredBy, {
        $inc: { points: REFERRAL_REWARD, referralCount: 1 },
      });
    }

    return NextResponse.json({ success: true, message: 'Email verified successfully' });
  } catch (error: any) {
    console.error('Verify email error:', error);
    return NextResponse.json({ error: 'Failed to verify email' }, { status: 500 });
  }
}
