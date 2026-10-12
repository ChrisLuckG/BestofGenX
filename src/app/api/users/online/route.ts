import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import Battle from '@/models/Battle';

// GET - Get users for invite/challenge
// filter=all: all users sorted by activity
// filter=online: only online users (heartbeat in last 60s or bots)
// Returns WALLET balance (bogxCoins), rank, battle stats
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
      .select('_id username avatar country countryFlag isBot battleScreen bogxCoins lastBattleHeartbeat battlesWon battlesLost')
      .sort({ bogxCoins: -1 }) // Sort by coins (most active players)
      .limit(limit)
      .lean();
    
    // Get all user IDs for rank calculation
    const allUserIds = users.map(u => u._id.toString());
    
    // Calculate ranks based on bogxCoins (only users with positive balance)
    const rankedUsers = await User.find({ 
      bogxCoins: { $gt: 0 },
      isReporter: { $ne: true },
      isAIReporter: { $ne: true },
      isDeleted: { $ne: true }
    })
      .select('_id bogxCoins')
      .sort({ bogxCoins: -1 })
      .lean();
    
    const rankMap = new Map<string, number>();
    rankedUsers.forEach((u, idx) => {
      rankMap.set(u._id.toString(), idx + 1);
    });
    
    // Get H2H stats if excludeId is provided (the requesting user)
    let h2hMap = new Map<string, { wins: number; losses: number }>();
    if (excludeId) {
      // Get battles between the requesting user and each player
      const h2hBattles = await Battle.find({
        status: 'completed',
        $or: [
          { creator: excludeId, opponent: { $in: allUserIds } },
          { opponent: excludeId, creator: { $in: allUserIds } }
        ]
      })
        .select('creator opponent winner')
        .lean();
      
      // Calculate H2H for each opponent
      for (const battle of h2hBattles) {
        const opponentId = battle.creator.toString() === excludeId 
          ? battle.opponent?.toString() 
          : battle.creator.toString();
        
        if (!opponentId) continue;
        
        if (!h2hMap.has(opponentId)) {
          h2hMap.set(opponentId, { wins: 0, losses: 0 });
        }
        
        const h2h = h2hMap.get(opponentId)!;
        if (battle.winner?.toString() === excludeId) {
          h2h.wins++;
        } else if (battle.winner) {
          h2h.losses++;
        }
        // Draws don't count
      }
    }
    
    // Determine online status for each user
    const now = Date.now();
    
    return NextResponse.json({ 
      success: true, 
      users: users.map(u => {
        const odeeId = u._id.toString();
        const lastHeartbeat = u.lastBattleHeartbeat ? new Date(u.lastBattleHeartbeat).getTime() : 0;
        const isOnline = u.isBot || (now - lastHeartbeat < 60000);
        const h2h = h2hMap.get(odeeId);
        
        return {
          _id: u._id,
          username: u.username,
          avatar: u.avatar,
          points: Math.round((u.bogxCoins ?? 0) * 100) / 100,
          country: u.country,
          countryFlag: u.countryFlag,
          isBot: u.isBot,
          isOnline,
          battleScreen: u.battleScreen,
          rank: rankMap.get(odeeId) || null,
          battlesWon: u.battlesWon || 0,
          battlesLost: u.battlesLost || 0,
          h2h: h2h || null
        };
      }),
      count: users.length
    });
  } catch (error: any) {
    console.error('Failed to get users:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
