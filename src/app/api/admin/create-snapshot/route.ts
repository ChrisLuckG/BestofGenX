import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import DailyRanking from '@/models/DailyRanking';

// Helper to get Berlin date string
function getBerlinDateString(date: Date = new Date()): string {
  return date.toLocaleString('en-CA', { 
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit'
  }).split(',')[0];
}

// POST: Manually create a snapshot for a specific date (admin only)
export async function POST(request: Request) {
  try {
    await dbConnect();
    
    const { dateString: requestedDate } = await request.json().catch(() => ({}));
    
    // Use requested date or yesterday (Berlin time)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateString = requestedDate || getBerlinDateString(yesterday);
    
    // Check if snapshot already exists
    const existing = await DailyRanking.findOne({ dateString });
    if (existing) {
      return NextResponse.json({ 
        success: true,
        message: 'Snapshot already exists',
        dateString,
        usersCount: existing.rankings?.length || 0
      });
    }
    
    // Get current rankings (excluding admins and deleted users)
    const users = await User.find({
      isDeleted: { $ne: true },
      isAdmin: { $ne: true }
    })
      .select('username avatar country countryFlag points wins')
      .sort({ points: -1 })
      .limit(100)
      .lean();
    
    const rankings = users.map((user, index) => ({
      userId: user._id,
      username: user.username,
      avatar: user.avatar || '',
      country: user.country || 'World',
      countryFlag: user.countryFlag || '🌍',
      points: user.points || 0,
      wins: user.wins || 0,
      rank: index + 1,
    }));
    
    // Create snapshot
    await DailyRanking.create({
      date: new Date(dateString + 'T09:00:00Z'), // 9:00 UTC as reference
      dateString,
      rankings,
    });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Snapshot created',
      dateString,
      usersCount: rankings.length
    });
  } catch (error) {
    console.error('Create snapshot error:', error);
    return NextResponse.json({ error: 'Failed to create snapshot' }, { status: 500 });
  }
}

// GET: List available snapshots
export async function GET() {
  try {
    await dbConnect();
    
    const snapshots = await DailyRanking.find({})
      .select('dateString date')
      .sort({ dateString: -1 })
      .limit(30)
      .lean();
    
    return NextResponse.json({ 
      success: true,
      snapshots: snapshots.map(s => ({
        dateString: s.dateString,
        date: s.date
      }))
    });
  } catch (error) {
    console.error('List snapshots error:', error);
    return NextResponse.json({ error: 'Failed to list snapshots' }, { status: 500 });
  }
}
