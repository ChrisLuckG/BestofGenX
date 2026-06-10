import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Article from '@/models/Article';
import mongoose from 'mongoose';

// Store user reactions in a simple collection
const ReactionSchema = new mongoose.Schema({
  articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  emojiId: { type: String, required: true },
}, { timestamps: true });

ReactionSchema.index({ articleId: 1, userId: 1 }, { unique: true });

const Reaction = mongoose.models.Reaction || mongoose.model('Reaction', ReactionSchema);

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { articleId, emojiId, userId } = await request.json();
    
    if (!articleId || !userId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Find existing reaction
    const existingReaction = await Reaction.findOne({ articleId, userId });
    
    let userReaction: string | null = null;

    if (existingReaction) {
      if (existingReaction.emojiId === emojiId) {
        // Same emoji - remove reaction
        await Reaction.deleteOne({ _id: existingReaction._id });
        userReaction = null;
      } else {
        // Different emoji - update reaction
        existingReaction.emojiId = emojiId;
        await existingReaction.save();
        userReaction = emojiId;
      }
    } else if (emojiId) {
      // New reaction
      await Reaction.create({ articleId, userId, emojiId });
      userReaction = emojiId;
    }

    // Get all reactions for this article
    const allReactions = await Reaction.find({ articleId });
    const reactionCounts: Record<string, number> = {};
    
    for (const r of allReactions) {
      reactionCounts[r.emojiId] = (reactionCounts[r.emojiId] || 0) + 1;
    }

    // Update total likes count on article (sum of all reactions)
    const totalReactions = Object.values(reactionCounts).reduce((sum, count) => sum + count, 0);
    await Article.findByIdAndUpdate(articleId, { likes: totalReactions });

    return NextResponse.json({ 
      success: true, 
      reactions: reactionCounts,
      userReaction,
      total: totalReactions,
    });
  } catch (error) {
    console.error('Reaction error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save reaction' }, { status: 500 });
  }
}

// Get reactions for an article
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get('articleId');
    const userId = searchParams.get('userId');
    
    if (!articleId) {
      return NextResponse.json({ success: false, error: 'Missing articleId' }, { status: 400 });
    }

    const allReactions = await Reaction.find({ articleId });
    const reactionCounts: Record<string, number> = {};
    
    for (const r of allReactions) {
      reactionCounts[r.emojiId] = (reactionCounts[r.emojiId] || 0) + 1;
    }

    let userReaction: string | null = null;
    if (userId) {
      const userR = await Reaction.findOne({ articleId, userId });
      userReaction = userR?.emojiId || null;
    }

    return NextResponse.json({ 
      success: true, 
      reactions: reactionCounts,
      userReaction,
    });
  } catch (error) {
    console.error('Get reactions error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get reactions' }, { status: 500 });
  }
}
