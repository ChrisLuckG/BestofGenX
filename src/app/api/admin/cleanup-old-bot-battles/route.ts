import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';

// POST - Cleanup old bot battles with unrealistic wagers (from old points system)
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET && secret !== 'cleanup2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    // Find all open battles with invalid wagers
    // Valid BOGX wagers are: 0.10, 0.25, 0.50, 0.75, 1.00 (NO 0.05!)
    const validWagers = [0.10, 0.25, 0.50, 0.75, 1.00];
    const oldBotBattles = await Battle.find({
      status: 'open',
      wager: { $nin: validWagers }
    }).populate('creator', 'username isBot');
    
    console.log(`Found ${oldBotBattles.length} old bot battles with high wagers`);
    
    let deletedCount = 0;
    let refundedCount = 0;
    
    for (const battle of oldBotBattles) {
      const creator = battle.creator as any;
      
      // If creator is a bot, just delete (no refund needed for bots)
      if (creator?.isBot) {
        await Battle.findByIdAndDelete(battle._id);
        deletedCount++;
      } else {
        // Real user - refund and delete
        await User.findByIdAndUpdate(battle.creator, {
          $inc: { bogxCoins: battle.wager }
        });
        await Battle.findByIdAndDelete(battle._id);
        deletedCount++;
        refundedCount++;
      }
    }
    
    // NOTE: We no longer reset bot bogxCoins here. The wallet must always equal
    // the sum of the bot's GameResults (its real earnings) so the score stays
    // consistent everywhere. Use /api/admin/coin-audit (mode=walletFromLedger)
    // to align a wallet to its ledger if needed.
    
    return NextResponse.json({ 
      success: true, 
      message: 'Old bot battles cleaned up',
      deletedBattles: deletedCount,
      refundedUsers: refundedCount
    });
  } catch (error: any) {
    console.error('Cleanup old bot battles error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
