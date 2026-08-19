import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Notification from '@/models/Notification';

// POST - Clean up duplicate battle_challenge notifications
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Find all battle_challenge notifications grouped by battleId
    const duplicates = await Notification.aggregate([
      { $match: { type: 'battle_challenge' } },
      {
        $group: {
          _id: {
            userId: '$userId',
            battleId: '$data.battleId'
          },
          count: { $sum: 1 },
          ids: { $push: '$_id' },
          createdAts: { $push: '$createdAt' }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]);
    
    let deletedCount = 0;
    const details: any[] = [];
    
    for (const dup of duplicates) {
      // Keep the first (oldest) notification, delete the rest
      const idsToDelete = dup.ids.slice(1);
      
      if (idsToDelete.length > 0) {
        await Notification.deleteMany({ _id: { $in: idsToDelete } });
        deletedCount += idsToDelete.length;
        details.push({
          battleId: dup._id.battleId,
          userId: dup._id.userId,
          duplicatesRemoved: idsToDelete.length
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} duplicate notifications`,
      duplicateGroups: duplicates.length,
      deletedCount,
      details
    });
  } catch (error: any) {
    console.error('Failed to cleanup duplicates:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
