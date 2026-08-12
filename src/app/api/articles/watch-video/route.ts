import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { awardBogx } from '@/lib/awardBogx';
import { VIDEO_REWARD } from '@/config/rewards';
import mongoose from 'mongoose';

// One document per (userId, videoId). The unique index makes the reward
// idempotent: replaying the same video never pays out twice.
const VideoWatchSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  videoId: { type: String, required: true },
  articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
}, { timestamps: true });

VideoWatchSchema.index({ userId: 1, videoId: 1 }, { unique: true });

const VideoWatch = mongoose.models.VideoWatch || mongoose.model('VideoWatch', VideoWatchSchema);

// GET - Check which videos a user has already watched
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const videoIds = searchParams.get('videoIds'); // comma-separated

    if (!userId) {
      return NextResponse.json({ success: true, watchedIds: [] });
    }

    const filter: any = { userId };
    if (videoIds) {
      filter.videoId = { $in: videoIds.split(',').map(s => s.trim()).filter(Boolean) };
    }

    const watched = await VideoWatch.find(filter).select('videoId').lean();
    const watchedIds = watched.map((w: any) => w.videoId);

    return NextResponse.json({ success: true, watchedIds });
  } catch (error) {
    console.error('Get watched videos error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get watched videos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const { videoId, articleId, userId } = await request.json();

    if (!videoId || !userId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    let coinsEarned = 0;
    try {
      // Claim the reward slot first - the unique index makes this the dedupe gate.
      await VideoWatch.create({ userId, videoId, articleId: articleId || undefined });
      // awardBogx credits the wallet AND writes the GameResult ledger entry,
      // keeping the wallet in sync with the rankings.
      const newBalance = await awardBogx({
        userId,
        amount: VIDEO_REWARD,
        source: 'article-video',
        description: 'Watched a video in an article',
      });
      if (newBalance === null) {
        // User not found - release the slot so a valid retry can still earn it.
        await VideoWatch.deleteOne({ userId, videoId });
      } else {
        coinsEarned = VIDEO_REWARD;
      }
    } catch (err: any) {
      // Duplicate key = already watched, no reward. Anything else is a real error.
      if (err?.code !== 11000) throw err;
    }

    return NextResponse.json({ success: true, coinsEarned });
  } catch (error) {
    console.error('Watch video error:', error);
    return NextResponse.json({ success: false, error: 'Failed to record video watch' }, { status: 500 });
  }
}
