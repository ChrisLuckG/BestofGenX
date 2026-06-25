import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function GET(request: Request) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ rank: null });
    }
    
    // Get all users sorted by BOGX balance descending (single source of truth)
    const allUsers = await User.find({ 
      isAdmin: { $ne: true }
    })
      .select('_id bogxCoins')
      .sort({ bogxCoins: -1 })
      .lean();
    
    // Find user's position
    const userIndex = allUsers.findIndex(u => u._id.toString() === userId);
    
    if (userIndex === -1) {
      return NextResponse.json({ rank: null });
    }
    
    return NextResponse.json({ rank: userIndex + 1 });
  } catch (error) {
    console.error('Error getting user rank:', error);
    return NextResponse.json({ rank: null });
  }
}
