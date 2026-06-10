import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// GET - Get recently active users (online in last 15 minutes)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const excludeId = searchParams.get('exclude');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    // Consider users "online" if they logged in within last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    const query: any = {
      lastLogin: { $gte: fifteenMinutesAgo },
      isBot: { $ne: true }
    };
    
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    
    const users = await User.find(query)
      .select('username avatar points country countryFlag')
      .sort({ lastLogin: -1 })
      .limit(limit)
      .lean();
    
    return NextResponse.json({ 
      success: true, 
      users: users.map(u => ({
        _id: u._id,
        username: u.username,
        avatar: u.avatar,
        points: u.points,
        country: u.country,
        countryFlag: u.countryFlag
      }))
    });
  } catch (error: any) {
    console.error('Failed to get online users:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
