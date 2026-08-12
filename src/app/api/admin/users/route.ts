import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import Reaction from '@/models/Reaction';

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
    
    // Get reaction counts per user
    const reactionCounts = await Reaction.aggregate([
      { $group: { _id: '$odooUserId', count: { $sum: 1 } } }
    ]);
    const reactionMap = new Map(reactionCounts.map(r => [r._id, r.count]));
    
    // Ensure isBot is always defined (default false for old users)
    const usersWithBot = users.map(u => ({
      ...u,
      isBot: u.isBot === true,
      reactionsCount: reactionMap.get(u._id.toString()) || 0,
    }));
    
    return NextResponse.json({ success: true, users: usersWithBot });
  } catch (error) {
    console.error('Fetch users error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
