import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const { userId, phone } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { phone: phone || '' },
      { new: true }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, phone: user.phone });
  } catch (error) {
    console.error('Update phone error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
