import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// POST - Fix existing bots that don't have isBot set
export async function POST() {
  try {
    await dbConnect();
    
    // Find all users with bot email pattern and set isBot to true
    const result = await User.updateMany(
      { email: { $regex: /@bot\.sporttock\.com$/ } },
      { $set: { isBot: true } }
    );
    
    return NextResponse.json({ 
      success: true, 
      fixed: result.modifiedCount,
      message: `Fixed ${result.modifiedCount} bots`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
