import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    
    if (!username || username.length < 3) {
      return NextResponse.json({ available: false, error: 'Username too short' });
    }
    
    // Check if username exists (case-insensitive)
    const existingUser = await User.findOne({ 
      username: { $regex: new RegExp(`^${username}$`, 'i') } 
    });
    
    return NextResponse.json({ 
      available: !existingUser,
      username 
    });
    
  } catch (error) {
    console.error('Check username error:', error);
    return NextResponse.json({ available: false, error: 'Server error' }, { status: 500 });
  }
}
