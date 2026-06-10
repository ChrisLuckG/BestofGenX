import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// GET - Search users by username
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
      .select('_id username avatar points country countryFlag')
      .limit(limit)
      .lean();
    
    return NextResponse.json({ success: true, users });
    
  } catch (error: any) {
    console.error('User search error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
