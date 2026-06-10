import { NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import { sendEmail, createVerificationEmail } from '@/lib/email';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://bestofgenx.com';

export async function POST(request: Request) {
  try {
    await dbConnect();
    
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      // Don't reveal if user exists
      return NextResponse.json({ 
        success: true, 
        message: 'If an account exists with this email, a verification link has been sent' 
      });
    }
    
    if (user.emailVerified) {
      return NextResponse.json({ 
        error: 'Email is already verified',
        alreadyVerified: true 
      }, { status: 400 });
    }
    
    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = verificationExpires;
    await user.save();
    
    // Send verification email
    const verificationUrl = `${BASE_URL}/verify-email?token=${verificationToken}`;
    const emailHtml = createVerificationEmail(user.username, verificationUrl);
    
    await sendEmail(email, 'Verify your email - Best of GenX', emailHtml);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Verification email sent' 
    });
  } catch (error: any) {
    console.error('Resend verification error:', error);
    return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 });
  }
}
