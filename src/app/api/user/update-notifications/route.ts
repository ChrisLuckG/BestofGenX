import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// POST: Update user notification preferences
export async function POST(request: Request) {
  try {
    await dbConnect();
    const { userId, notifyEmail, notifySms } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const updateData: Record<string, boolean> = {};
    if (typeof notifyEmail === 'boolean') updateData.notifyEmail = notifyEmail;
    if (typeof notifySms === 'boolean') updateData.notifySms = notifySms;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      notifyEmail: user.notifyEmail,
      notifySms: user.notifySms
    });
  } catch (error) {
    console.error('Update notifications error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
