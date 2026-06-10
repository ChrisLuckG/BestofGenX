import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import { sendPushNotification } from '@/lib/webpush';

// This endpoint should be called by a cron job every hour
// It cleans up battles that have been open for more than 48 hours
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (optional security)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    
    // Find all open battles older than 48 hours
    const expiredBattles = await Battle.find({
      status: 'open',
      createdAt: { $lt: fortyEightHoursAgo }
    }).populate('creator', 'username pushSubscription');
    
    let refundedCount = 0;
    let notifiedCount = 0;
    
    for (const battle of expiredBattles) {
      // Refund the creator
      await User.findByIdAndUpdate(battle.creator._id || battle.creator, {
        $inc: { points: battle.wager }
      });
      refundedCount++;
      
      // Mark battle as expired/cancelled
      battle.status = 'expired';
      await battle.save();
      
      // Send push notification to creator
      const creator = battle.creator as any;
      if (creator?.pushSubscription) {
        try {
          await sendPushNotification(creator.pushSubscription, {
            title: '⏰ Battle Expired',
            body: `Your ${battle.topic.toUpperCase()} battle expired after 48h. ${battle.wager} coins refunded.`,
            tag: `battle-expired-${battle._id}`,
            url: '/mobile?tab=notifications',
            type: 'general'
          });
          notifiedCount++;
        } catch (pushError) {
          console.error('Expired battle push failed:', pushError);
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Cleaned up ${expiredBattles.length} expired battles`,
      refundedCount,
      notifiedCount
    });
  } catch (error: any) {
    console.error('Battle cleanup failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
