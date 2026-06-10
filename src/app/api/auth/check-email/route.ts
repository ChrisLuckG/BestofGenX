import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    
    if (!email || !email.includes('@')) {
      return NextResponse.json({ available: false, error: 'Invalid email' });
    }
    
    // Check if email exists (case-insensitive)
    const existingUser = await User.findOne({ 
      email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
    });
    
    return NextResponse.json({ 
      available: !existingUser,
      email 
    });
    
  } catch (error) {
    console.error('Check email error:', error);
    return NextResponse.json({ available: false, error: 'Server error' }, { status: 500 });
  }
}
