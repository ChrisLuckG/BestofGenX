import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Reaction from '@/models/Reaction';
import User from '@/models/User';

// DELETE - Clean up invalid emoji reactions
export async function DELETE() {
  try {
    await dbConnect();
    
    const validMoods = ['whatever', 'meh', 'ok', 'cool', 'fire'];
    
    // Delete reactions with invalid emojiIds
    const result = await Reaction.deleteMany({
      emojiId: { $nin: [...validMoods, null] }
    });
    
    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Deleted ${result.deletedCount} reactions with invalid emoji IDs`
    });
  } catch (error) {
    console.error('Delete invalid reactions error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  try {
    await dbConnect();
    
    // Count total reactions
    const totalReactions = await Reaction.countDocuments({ emojiId: { $ne: null } });
    
    // Get reaction breakdown by emojiId
    const byEmoji = await Reaction.aggregate([
      { $match: { emojiId: { $ne: null } } },
      { $group: { _id: '$emojiId', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get bot vs user reactions
    const bots = await User.find({ isBot: true }).select('_id');
    const botIds = bots.map(b => b._id);
    
    const botReactions = await Reaction.countDocuments({ 
      userId: { $in: botIds },
      emojiId: { $ne: null }
    });
    
    const userReactions = totalReactions - botReactions;
    
    // Sample some reactions
    const samples = await Reaction.find({ emojiId: { $ne: null } })
      .limit(10)
      .populate('userId', 'username isBot')
      .lean();
    
    return NextResponse.json({
      success: true,
      totalReactions,
      botReactions,
      userReactions,
      byEmoji,
      samples: samples.map(s => ({
        articleId: s.articleId,
        emojiId: s.emojiId,
        user: (s.userId as any)?.username || 'unknown',
        isBot: (s.userId as any)?.isBot || false,
      }))
    });
  } catch (error) {
    console.error('Debug reactions error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
