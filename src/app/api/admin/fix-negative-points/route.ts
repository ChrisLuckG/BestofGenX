import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// POST - Fix all users with negative points
export async function POST() {
  try {
    await dbConnect();
    
    // Find all users with negative points
    const negativeUsers = await User.find({ points: { $lt: 0 } });
    
    // Set them to 100 points (starter amount)
    const result = await User.updateMany(
      { points: { $lt: 0 } },
      { $set: { points: 100 } }
    );
    
    return NextResponse.json({ 
      success: true, 
      message: `Fixed ${result.modifiedCount} users with negative points`,
      users: negativeUsers.map(u => ({ username: u.username, oldPoints: u.points }))
    });
  } catch (error: any) {
    console.error('Fix negative points error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET - Check users with negative points
export async function GET() {
  try {
    await dbConnect();
    
    const negativeUsers = await User.find({ points: { $lt: 0 } })
      .select('username points')
      .lean();
    
    return NextResponse.json({ 
      success: true, 
      count: negativeUsers.length,
      users: negativeUsers
    });
  } catch (error: any) {
    console.error('Check negative points error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
