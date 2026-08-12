import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Article from '@/models/Article';
import Reaction from '@/models/Reaction';
import { awardBogx } from '@/lib/awardBogx';
import { REACTION_REWARD } from '@/config/rewards';

// A reaction doc without the `rewarded` field is a legacy document: those were
// already paid out when they were created. Treated as rewarded everywhere so the
// user can never collect a second time (same rule as the POST claim below).
const isRewarded = (doc: { rewarded?: boolean } | null | undefined) =>
  !!doc && doc.rewarded !== false;

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { articleId, emojiId, userId } = await request.json();
    
    if (!articleId || !userId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Find existing reaction (kept even when the user removed their reaction)
    const existing = await Reaction.findOne({ articleId, userId }).lean() as
      | { emojiId?: string | null; rewarded?: boolean }
      | null;
    let coinsEarned = 0;

    // Toggle off when clicking the same emoji again, otherwise set the new one
    const nextEmojiId: string | null =
      existing?.emojiId && existing.emojiId === emojiId ? null : (emojiId || null);

    // Upsert the reaction. `rewarded` is only initialised on insert so an existing
    // (already paid out) flag can never be reset by a later click.
    const reaction = await Reaction.findOneAndUpdate(
      { articleId, userId },
      { $set: { emojiId: nextEmojiId }, $setOnInsert: { rewarded: false } },
      { new: true, upsert: true }
    );

    // Reward exactly once per article per user - never again, no matter how often
    // the user removes and re-adds a reaction. The claim is atomic: only the
    // request that actually flips `rewarded` false -> true pays out, so rapid
    // double-clicks can't both slip through and award twice.
    //
    // The filter matches `rewarded: false` EXPLICITLY (not `$ne: true`): legacy
    // documents written before the shared model existed have no `rewarded` field
    // at all, and those were already paid out on creation. `$ne: true` would
    // match them and hand out a second reward.
    if (reaction.emojiId) {
      const claimed = await Reaction.findOneAndUpdate(
        { _id: reaction._id, rewarded: false },
        { $set: { rewarded: true } }
      );
      if (claimed) {
        // awardBogx credits the wallet AND writes the GameResult ledger entry,
        // keeping the wallet in sync with the rankings.
        await awardBogx({
          userId,
          amount: REACTION_REWARD,
          source: 'article-reaction',
          description: 'Reacted to an article',
        });
        coinsEarned = REACTION_REWARD;
      }
    }

    const userReaction: string | null = reaction.emojiId;

    // Get all reactions for this article (skip removed ones)
    const allReactions = await Reaction.find({ articleId, emojiId: { $ne: null } });
    const reactionCounts: Record<string, number> = {};
    
    for (const r of allReactions) {
      if (!r.emojiId) continue;
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
      coinsEarned,
    });
  } catch (error) {
    console.error('Reaction error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save reaction' }, { status: 500 });
  }
}

// Get reactions for an article (or batch of articles via articleIds=id1,id2,...)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get('articleId');
    const articleIdsParam = searchParams.get('articleIds');
    const userId = searchParams.get('userId');

    // Batch mode: return reactions for many articles in a single query,
    // avoiding the N+1 request storm from rendering many cards at once.
    if (articleIdsParam) {
      const articleIds = articleIdsParam.split(',').map(s => s.trim()).filter(Boolean);
      if (articleIds.length === 0) {
        return NextResponse.json({ success: true, byArticle: {} });
      }

      const allReactions = await Reaction.find({ articleId: { $in: articleIds }, emojiId: { $ne: null } });
      const byArticle: Record<string, { reactions: Record<string, number>; userReaction: string | null; rewarded: boolean }> = {};

      for (const id of articleIds) {
        byArticle[id] = { reactions: {}, userReaction: null, rewarded: false };
      }

      for (const r of allReactions) {
        if (!r.emojiId) continue;
        const id = r.articleId.toString();
        if (!byArticle[id]) byArticle[id] = { reactions: {}, userReaction: null, rewarded: false };
        byArticle[id].reactions[r.emojiId] = (byArticle[id].reactions[r.emojiId] || 0) + 1;
        if (userId && r.userId.toString() === userId) {
          byArticle[id].userReaction = r.emojiId;
        }
      }

      // Whether this user already collected the reward for each article. The UI
      // needs it to decide up front whether a click will earn coins, so it can
      // play the animation instantly instead of awaiting the POST.
      // Queried separately from the counts above because that query drops docs
      // with emojiId: null - a user who removed their reaction still counts as
      // rewarded and must not be paid twice.
      if (userId) {
        const ownReactions = await Reaction.find({ articleId: { $in: articleIds }, userId })
          .select('articleId rewarded')
          .lean();
        for (const r of ownReactions as Array<{ articleId: unknown; rewarded?: boolean }>) {
          const id = String(r.articleId);
          if (byArticle[id]) byArticle[id].rewarded = isRewarded(r);
        }
      }

      return NextResponse.json({ success: true, byArticle });
    }
    
    if (!articleId) {
      return NextResponse.json({ success: false, error: 'Missing articleId' }, { status: 400 });
    }

    const allReactions = await Reaction.find({ articleId, emojiId: { $ne: null } });
    const reactionCounts: Record<string, number> = {};
    
    for (const r of allReactions) {
      if (!r.emojiId) continue;
      reactionCounts[r.emojiId] = (reactionCounts[r.emojiId] || 0) + 1;
    }

    let userReaction: string | null = null;
    let rewarded = false;
    if (userId) {
      const userR = await Reaction.findOne({ articleId, userId });
      userReaction = userR?.emojiId || null;
      rewarded = isRewarded(userR);
    }

    return NextResponse.json({ 
      success: true, 
      reactions: reactionCounts,
      userReaction,
      rewarded,
    });
  } catch (error) {
    console.error('Get reactions error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get reactions' }, { status: 500 });
  }
}
