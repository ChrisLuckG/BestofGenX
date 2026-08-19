import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// GET - Get users for invite/challenge
// filter=all: all users sorted by activity
// filter=online: only online users (heartbeat in last 60s or bots)
// Returns WALLET balance (bogxCoins)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const excludeId = searchParams.get('exclude');
    const limit = parseInt(searchParams.get('limit') || '20');
    const filter = searchParams.get('filter') || 'all';
    
    const onlineThreshold = new Date(Date.now() - 60 * 1000);
    
    // Build query based on filter
    // Always exclude reporters (both isReporter and isAIReporter)
    const query: any = {
      isReporter: { $ne: true },
      isAIReporter: { $ne: true },
      isDeleted: { $ne: true }
    };
    
    if (filter === 'online') {
      query.$or = [
        { lastBattleHeartbeat: { $gte: onlineThreshold } },
        { isBot: true }
      ];
    }
    
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    
    const users = await User.find(query)
      .select('_id username avatar country countryFlag isBot battleScreen bogxCoins lastBattleHeartbeat')
      .sort({ bogxCoins: -1 }) // Sort by coins (most active players)
      .limit(limit)
      .lean();
    
    // Determine online status for each user
    const now = Date.now();
    
    return NextResponse.json({ 
      success: true, 
      users: users.map(u => {
        const lastHeartbeat = u.lastBattleHeartbeat ? new Date(u.lastBattleHeartbeat).getTime() : 0;
        const isOnline = u.isBot || (now - lastHeartbeat < 60000);
        
        return {
          _id: u._id,
          username: u.username,
          avatar: u.avatar,
          points: Math.round((u.bogxCoins ?? 0) * 100) / 100,
          country: u.country,
          countryFlag: u.countryFlag,
          isBot: u.isBot,
          isOnline,
          battleScreen: u.battleScreen
        };
      }),
      count: users.length
    });
  } catch (error: any) {
    console.error('Failed to get users:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
