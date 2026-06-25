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

// Helper to save snapshot for a specific date
async function saveSnapshotForDate(targetDate: Date): Promise<{ success: boolean; dateString: string; message: string }> {
  // Use Berlin time for the date string
  const dateString = getBerlinDateString(targetDate);
  
  // Check if we already have a snapshot
  const existing = await DailyRanking.findOne({ dateString });
  if (existing) {
    return { success: true, dateString, message: 'Already exists' };
  }
  
  // Get rankings (lifetime wallet balance = bogxCoins)
  const users = await User.find({})
    .select('username avatar country countryFlag bogxCoins wins')
    .sort({ bogxCoins: -1 })
    .limit(100)
    .lean();
  
  const rankings = users.map((user, index) => ({
    userId: user._id,
    username: user.username,
    avatar: user.avatar || '',
    country: user.country || 'World',
    countryFlag: user.countryFlag || '🌍',
    points: user.bogxCoins || 0,
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

// This endpoint should be called by Vercel Cron at 9:00 Berlin time (7:00 or 8:00 UTC depending on DST)
// This is right before the 9:00-10:00 break, so we capture the final state of the previous "ranking day"
export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    const berlinNow = getBerlinDateString();
    console.log('[CRON] Daily snapshot triggered at', new Date().toISOString(), 'Berlin date:', berlinNow);
    
    await dbConnect();
    console.log('[CRON] Database connected');
    
    // Save snapshot for yesterday (Berlin time)
    // The "ranking day" ends at 9:00 Berlin time, so we save the previous day's final state
    const results: { dateString: string; message: string }[] = [];
    
    // Check for any missing days in the last 7 days and fill them (using Berlin dates)
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
