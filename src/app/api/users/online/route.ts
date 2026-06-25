import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// GET - Get users currently online
// "Online" = sent heartbeat in last 60 seconds OR is a bot (always available)
// Returns WALLET balance (bogxCoins) = the user's score, same everywhere
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const excludeId = searchParams.get('exclude');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    // Users are "online" if they sent a heartbeat in the last 60 seconds
    const onlineThreshold = new Date(Date.now() - 60 * 1000);
    
    // Query: users with recent heartbeat OR bots (always online)
    const query: any = {
      $or: [
        { lastBattleHeartbeat: { $gte: onlineThreshold } },
        { isBot: true }
      ]
    };
    
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    
    const users = await User.find(query)
      .select('_id username avatar country countryFlag isBot battleScreen bogxCoins')
      .sort({ lastBattleHeartbeat: -1 })
      .limit(limit)
      .lean();
    
    // Return WALLET balance (bogxCoins) = the score, consistent everywhere
    return NextResponse.json({ 
      success: true, 
      users: users.map(u => ({
        _id: u._id,
        username: u.username,
        avatar: u.avatar,
        points: Math.round((u.bogxCoins || 0) * 100) / 100,
        country: u.country,
        countryFlag: u.countryFlag,
        isBot: u.isBot,
        battleScreen: u.battleScreen
      })),
      count: users.length
    });
  } catch (error: any) {
    console.error('Failed to get online users:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
