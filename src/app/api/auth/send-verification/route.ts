import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import { Resend } from 'resend';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    await dbConnect();
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: 'Email already verified' }, { status: 400 });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save token to user
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = verificationExpires;
    await user.save();

    // Build verification URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bestofgenx.com';
    const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

    // Send email
    await resend.emails.send({
      from: 'Best of GenX <noreply@bestofgenx.com>',
      to: user.email,
      subject: 'Verify Your Email - Best of GenX',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background-color:#1a1a1a;font-family:Arial,sans-serif;">
          <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
            <div style="text-align:center;margin-bottom:30px;">
              <img src="${baseUrl}/images/genxlogo.png" alt="Best of GenX" style="width:80px;height:80px;">
            </div>
            <div style="background:linear-gradient(135deg,#2a2a2a 0%,#1a1a1a 100%);border-radius:16px;padding:30px;border:1px solid rgba(212,135,58,0.3);">
              <h1 style="color:#E36B11;font-size:24px;margin:0 0 20px 0;text-align:center;">Welcome to Best of GenX!</h1>
              <p style="color:#ffffff;font-size:16px;line-height:1.6;margin:0 0 20px 0;">
                Hi ${user.username},
              </p>
              <p style="color:#cccccc;font-size:14px;line-height:1.6;margin:0 0 25px 0;">
                Thanks for signing up! Please verify your email address to complete your registration and start playing.
              </p>
              <div style="text-align:center;margin:30px 0;">
                <a href="${verifyUrl}" style="display:inline-block;background:#E36B11;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;">
                  Verify Email
                </a>
              </div>
              <p style="color:#888888;font-size:12px;line-height:1.6;margin:25px 0 0 0;text-align:center;">
                This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
              </p>
            </div>
            <p style="color:#666666;font-size:11px;text-align:center;margin-top:30px;">
              Best of GenX - The Ultimate Gen X Trivia Experience
            </p>
          </div>
        </body>
        </html>
      `,
    });

    return NextResponse.json({ success: true, message: 'Verification email sent' });
  } catch (error: any) {
    console.error('Send verification error:', error);
    return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 });
  }
}
