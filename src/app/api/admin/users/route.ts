import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Check for isAIReporter filter
    const { searchParams } = new URL(request.url);
    const isAIReporter = searchParams.get('isAIReporter');
    
    const query: Record<string, unknown> = {};
    if (isAIReporter === 'true') {
      query.isAIReporter = true;
    }
    
    const users = await User.find(query)
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
