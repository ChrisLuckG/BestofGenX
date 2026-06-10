import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function POST(request: Request) {
  try {
    await dbConnect();
    
    const { userId, isAdmin } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }
    
    await User.findByIdAndUpdate(userId, { isAdmin });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Toggle admin error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
