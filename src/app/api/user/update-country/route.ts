import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function POST(request: Request) {
  try {
    await dbConnect();
    
    const { userId, country, countryFlag } = await request.json();
    
    if (!userId || !country || !countryFlag) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { country, countryFlag },
      { new: true }
    );
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true,
      country: user.country,
      countryFlag: user.countryFlag
    });
  } catch (error) {
    console.error('Update country error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
