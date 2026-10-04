import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { rankingDayKey } from '@/lib/berlinTime';

// The key MUST be the ranking day (10:00 Berlin -> 10:00 Berlin), not a UTC or
// calendar midnight. UTC midnight is 01:00/02:00 Berlin, i.e. it falls INSIDE a
// ranking day: the counter reset halfway through and handed out a second set of
// games that still scored towards the same day - 10 games instead of 5.
function getTodayKey(): string {
  return rankingDayKey();
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
