import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function GET() {
  try {
    await dbConnect();
    
    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
    
    // Ensure isBot is always defined (default false for old users)
    const usersWithBot = users.map(u => ({
      ...u,
      isBot: u.isBot === true
    }));
    
    return NextResponse.json({ success: true, users: usersWithBot });
  } catch (error) {
    console.error('Fetch users error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
