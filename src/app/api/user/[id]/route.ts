import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// GET: Fetch user by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    
    const user = await User.findById(params.id)
      .select('username email avatar country countryFlag points bogxCoins coins wins gamesPlayed correctAnswers wrongAnswers totalAnswerTime isAdmin isAuthor authorEarnings')
      .lean();
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true,
      user: {
        ...user,
        id: user._id.toString(),
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}
