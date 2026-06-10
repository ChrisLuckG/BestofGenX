import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function POST(request: Request) {
  try {
    await dbConnect();
    
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }
    
    await User.findByIdAndUpdate(userId, { points: 0 });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error resetting points:", error);
    return NextResponse.json({ error: 'Failed to reset points' }, { status: 500 });
  }
}
