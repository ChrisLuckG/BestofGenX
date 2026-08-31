import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// Get today's date key in UTC
function getTodayKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

// GET: Fetch today's game count for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });
    }
    
    const client = await clientPromise;
    const db = client.db();
    
    const todayKey = getTodayKey();
    
    const record = await db.collection('dailyTriviaCount').findOne({
      userId,
      date: todayKey,
    });
    
    return NextResponse.json({
      success: true,
      count: record?.count || 0,
      date: todayKey,
    });
  } catch (error) {
    console.error('Error fetching daily trivia count:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Increment today's game count for a user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });
    }
    
    const client = await clientPromise;
    const db = client.db();
    
    const todayKey = getTodayKey();
    
    const result = await db.collection('dailyTriviaCount').findOneAndUpdate(
      { userId, date: todayKey },
      { 
        $inc: { count: 1 },
        $setOnInsert: { userId, date: todayKey, createdAt: new Date() },
      },
      { upsert: true, returnDocument: 'after' }
    );
    
    return NextResponse.json({
      success: true,
      count: result?.count || 1,
      date: todayKey,
    });
  } catch (error) {
    console.error('Error incrementing daily trivia count:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
