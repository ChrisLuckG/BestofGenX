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
    
    // Get reaction counts per user, grouped by emoji
    const reactionCounts = await Reaction.aggregate([
      { 
        $match: { emojiId: { $ne: null } } // Only count active reactions
      },
      { 
        $group: { 
          _id: { userId: { $toString: '$userId' }, emoji: '$emojiId' }, 
          count: { $sum: 1 } 
        } 
      }
    ]);
    
    // Build map: userId -> { emoji: count, ... }
    const reactionMap = new Map<string, Record<string, number>>();
    for (const r of reactionCounts) {
      const odooUserId = r._id.userId;
      const emoji = r._id.emoji;
      if (!odooUserId || !emoji) continue;
      if (!reactionMap.has(odooUserId)) {
        reactionMap.set(odooUserId, {});
      }
      reactionMap.get(odooUserId)![emoji] = r.count;
    }
    
    // Ensure isBot is always defined (default false for old users)
    const usersWithBot = users.map(u => {
      const reactions = reactionMap.get(u._id.toString()) || {};
      return {
        ...u,
        isBot: u.isBot === true,
        reactionsCount: Object.values(reactions).reduce((a, b) => a + b, 0),
        reactionsByEmoji: reactions, // { '❤️': 5, '😂': 3, ... }
      };
    });
    
    return NextResponse.json({ success: true, users: usersWithBot });
  } catch (error) {
    console.error('Fetch users error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
