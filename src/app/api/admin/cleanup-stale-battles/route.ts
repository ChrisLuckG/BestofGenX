import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';

// POST - Cleanup stale "active" battles that have been stuck for too long
// These are battles where opponent accepted but never finished playing
export async function POST(request: NextRequest) {
  try {
    // Simple auth check (you can add proper admin auth later)
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET && secret !== 'cleanup2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    // Find all "active" battles older than 2 hours (stuck battles)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    const staleBattles = await Battle.find({
      status: 'active',
      acceptedAt: { $lt: twoHoursAgo }
    });
    
    console.log(`Found ${staleBattles.length} stale active battles to cleanup`);
    
    let refundedCreators = 0;
    let refundedOpponents = 0;
    
    for (const battle of staleBattles) {
      // Refund both players
      if (battle.creator) {
        await User.findByIdAndUpdate(battle.creator, {
          $inc: { points: battle.wager }
        });
        refundedCreators++;
      }
      
      if (battle.opponent) {
        await User.findByIdAndUpdate(battle.opponent, {
          $inc: { points: battle.wager }
        });
        refundedOpponents++;
      }
      
      // Mark as cancelled
      battle.status = 'cancelled';
      await battle.save();
    }
    
    // Also cleanup very old "open" battles (older than 48 hours)
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    
    const oldOpenBattles = await Battle.find({
      status: 'open',
      createdAt: { $lt: fortyEightHoursAgo }
    });
    
    console.log(`Found ${oldOpenBattles.length} old open battles to expire`);
    
    let expiredCount = 0;
    for (const battle of oldOpenBattles) {
      // Refund creator only (opponent never joined)
      if (battle.creator) {
        await User.findByIdAndUpdate(battle.creator, {
          $inc: { points: battle.wager }
        });
      }
      
      battle.status = 'expired';
      await battle.save();
      expiredCount++;
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cleanup completed',
      staleBattlesCleaned: staleBattles.length,
      refundedCreators,
      refundedOpponents,
      expiredOpenBattles: expiredCount
    });
  } catch (error: any) {
    console.error('Cleanup failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
