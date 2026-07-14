import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Article from '@/models/Article';
import User from '@/models/User';

// POST - Create the static Music Community article (run once)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // No hardcoded image: music-community inherits the Music FIXED block's bannerImage via
    // the cover-image fallback in the articles API (same as the dedicated banner pages).
    const STALE_DEFAULTS = ['/images/Hintergund/music.png', '/images/topics/music.png'];

    // Check if it already exists — clear any stale hardcoded cover so the banner image shows.
    const existing = await Article.findOne({ contentType: 'music-community' });
    if (existing) {
      if (existing.coverImage && STALE_DEFAULTS.includes(existing.coverImage)) {
        existing.coverImage = '';
        existing.thumbnailUrl = '';
        await existing.save();
        return NextResponse.json({ success: true, message: 'Cleared stale cover (now uses banner image)', articleId: existing._id });
      }
      return NextResponse.json({ success: true, message: 'Already exists', articleId: existing._id });
    }

    const admin = await User.findOne({ isAdmin: true }).select('_id').lean();

    const article = await Article.create({
      title: 'Community Sound',
      subtitle: 'Your songs. Our playlist. Every month, Gen X picks the tracks.',
      content: `<p>Every month the BestOfGenX community picks the tracks that make it onto our Spotify playlists. You suggest, you vote, we add. The most upvoted songs become part of the official playlist — this month and forever.</p>
<p>See which songs made the cut this month and discover new suggestions from the community below. Think a track deserves a spot? Submit it!</p>`,
      coverImage: '',
      thumbnailUrl: '',
      contentType: 'music-community',
      category: 'music',
      mainCategory: 'articles',
      status: 'published',
      publishedAt: new Date(),
      author: admin?._id || null,
      authorName: 'BOGX Team',
      tags: ['music', 'community', 'playlist', 'spotify'],
      featured: false,
      views: 0,
      likes: 0,
    });

    return NextResponse.json({ success: true, articleId: article._id });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
