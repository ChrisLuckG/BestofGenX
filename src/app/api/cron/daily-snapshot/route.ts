import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import DailyRanking from '@/models/DailyRanking';

// Helper to save snapshot for a specific date
async function saveSnapshotForDate(targetDate: Date): Promise<{ success: boolean; dateString: string; message: string }> {
  const dateString = targetDate.toISOString().split('T')[0];
  
  // Check if we already have a snapshot
  const existing = await DailyRanking.findOne({ dateString });
  if (existing) {
    return { success: true, dateString, message: 'Already exists' };
  }
  
  // Get rankings
  const users = await User.find({})
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
    points: user.points,
    wins: user.wins,
    rank: index + 1,
  }));
  
  await DailyRanking.create({
    date: targetDate,
    dateString,
    rankings,
  });
  
  return { success: true, dateString, message: `Created with ${rankings.length} users` };
}

// This endpoint is called by Vercel Cron at midnight UTC
export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    console.log('[CRON] Daily snapshot triggered at', new Date().toISOString());
    
    await dbConnect();
    console.log('[CRON] Database connected');
    
    // Get yesterday's date (since cron runs at midnight, we save yesterday's final rankings)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Also check for any missing days in the last 7 days and fill them
    const results: { dateString: string; message: string }[] = [];
    
    for (let i = 1; i <= 7; i++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - i);
      
      try {
        const result = await saveSnapshotForDate(checkDate);
        results.push({ dateString: result.dateString, message: result.message });
        console.log(`[CRON] ${result.dateString}: ${result.message}`);
      } catch (e) {
        console.error(`[CRON] Error for date ${checkDate.toISOString().split('T')[0]}:`, e);
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`[CRON] Completed in ${duration}ms`);
    
    return NextResponse.json({ 
      success: true, 
      results,
      duration: `${duration}ms`
    });
  } catch (error) {
    console.error('[CRON] Snapshot error:', error);
    return NextResponse.json({ 
      error: 'Failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
