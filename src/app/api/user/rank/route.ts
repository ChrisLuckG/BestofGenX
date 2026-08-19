import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import mongoose from 'mongoose';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await dbConnect();

    // Try to find user by ID (handle both string and ObjectId)
    let currentUser;
    const userId = session.user.id;
    
    // Try as ObjectId first
    if (mongoose.Types.ObjectId.isValid(userId)) {
      currentUser = await User.findById(userId).select('bogxCoins username').lean();
    }
    
    // If not found, try by string match
    if (!currentUser) {
      currentUser = await User.findOne({ _id: userId }).select('bogxCoins username').lean();
    }
    
    if (!currentUser) {
      console.error('[UserRank] User not found for ID:', userId);
      return NextResponse.json({ error: 'User not found', userId }, { status: 404 });
    }

    const userCoins = (currentUser as any).bogxCoins || 0;

    // Count how many users have more bogxCoins (to determine rank)
    const usersAbove = await User.countDocuments({
      bogxCoins: { $gt: userCoins },
      isDeleted: { $ne: true },
    });

    // Rank is position (1-indexed)
    const rank = usersAbove + 1;

    console.log('[UserRank] Success:', { userId, username: (currentUser as any).username, rank, bogxCoins: userCoins });
    return NextResponse.json({ rank, bogxCoins: userCoins });
  } catch (error) {
    console.error('Error fetching user rank:', error);
    return NextResponse.json({ error: 'Failed to fetch rank' }, { status: 500 });
  }
}
