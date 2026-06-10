import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function POST(request: Request) {
  try {
    await dbConnect();
    
    const { userId, avatar } = await request.json();
    
    if (!userId || !avatar) {
      return NextResponse.json(
        { error: 'User ID and avatar are required' },
        { status: 400 }
      );
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { avatar },
      { new: true }
    );
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true,
      avatar: user.avatar 
    });
  } catch (error) {
    console.error('Update avatar error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
