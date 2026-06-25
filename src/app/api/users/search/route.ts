import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// GET - Search users by username
// Returns WALLET balance (bogxCoins) = the score, consistent everywhere
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10');
    
    if (query.length < 2) {
      return NextResponse.json({ success: true, users: [] });
    }
    
    // Search by username (case-insensitive)
    const users = await User.find({
      username: { $regex: query, $options: 'i' },
      isBot: { $ne: true } // Exclude bots
    })
      .select('_id username avatar country countryFlag bogxCoins')
      .limit(limit)
      .lean();
    
    // Return WALLET balance (bogxCoins) = the score
    const usersWithCoins = users.map(u => ({
      ...u,
      points: Math.round((u.bogxCoins || 0) * 100) / 100
    }));
    
    return NextResponse.json({ success: true, users: usersWithCoins });
    
  } catch (error: any) {
    console.error('User search error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
