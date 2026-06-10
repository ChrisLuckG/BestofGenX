import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// POST - Add coins to a user
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { username, amount } = await request.json();
    
    if (!username || !amount) {
      return NextResponse.json({ success: false, error: 'Missing username or amount' }, { status: 400 });
    }
    
    const user = await User.findOneAndUpdate(
      { username },
      { $inc: { points: amount } },
      { new: true }
    );
    
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Added ${amount} coins to ${username}`,
      newBalance: user.points
    });
  } catch (error: any) {
    console.error('Add coins error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
