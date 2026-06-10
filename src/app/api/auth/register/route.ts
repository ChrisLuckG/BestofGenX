import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import crypto from 'crypto';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { sendEmail, createVerificationEmail } from '@/lib/email';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://bestofgenx.com';

export async function POST(request: Request) {
  try {
    await dbConnect();
    
    const { username, email, password, country, countryFlag, referredBy } = await request.json();
    
    // Validation
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }
    
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }
    
    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'Username or email already exists' },
        { status: 400 }
      );
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate random default avatar
    const avatarId = Math.floor(Math.random() * 16) + 1;
    const defaultAvatar = `https://i.pravatar.cc/150?img=${avatarId}`;
    
    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Validate referrer (if any) before creating the user
    let validReferrer = null;
    if (referredBy && mongoose.Types.ObjectId.isValid(referredBy)) {
      validReferrer = await User.findById(referredBy).select('_id');
    }

    // Create user with starting bonus (but not verified yet)
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      avatar: defaultAvatar,
      country: country || 'World',
      countryFlag: countryFlag || '🌍',
      points: 500, // Starting bonus
      wins: 0,
      gamesPlayed: 0,
      referredBy: validReferrer ? validReferrer._id : undefined,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    });

    // Send verification email
    const verificationUrl = `${BASE_URL}/verify-email?token=${verificationToken}`;
    const emailHtml = createVerificationEmail(username, verificationUrl);
    
    console.log('Sending verification email to:', email);
    console.log('Verification URL:', verificationUrl);
    
    try {
      const emailResult = await sendEmail(email, 'Verify your email - Best of GenX', emailHtml);
      console.log('Email send result:', emailResult);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails - user can request resend
    }

    // Note: Don't reward referrer until email is verified
    
    // Return user without password
    const userResponse = {
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      country: user.country,
      countryFlag: user.countryFlag,
      points: user.points,
      wins: user.wins,
      gamesPlayed: user.gamesPlayed,
      emailVerified: user.emailVerified,
    };
    
    return NextResponse.json({ 
      user: userResponse,
      message: 'Please check your email to verify your account'
    }, { status: 201 });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
