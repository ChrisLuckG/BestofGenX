import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import mongoose from 'mongoose';

// POST - Update user's battle presence (heartbeat)
// Called every 30 seconds when user is in the app
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { userId, screen } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });
    }
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false, error: 'Invalid userId format' }, { status: 400 });
    }
    
    // Update lastBattleHeartbeat timestamp using native MongoDB driver
    // (bypasses Mongoose schema cache issues with newly-added fields)
    const now = new Date();
    const db = User.db;
    const result = await db.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { 
        $set: { 
          lastBattleHeartbeat: now,
          battleScreen: screen || 'app'
        } 
      }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Heartbeat error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
