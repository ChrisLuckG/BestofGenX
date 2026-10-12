import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import Article from '@/models/Article';

// Per-article view of an author's earnings.
//
// Earnings are only stored as one running total (User.authorEarnings, +0.02 per
// first read in /api/articles/[id]). There is no per-article ledger, so the split
// is DERIVED: a paid read is exactly a user whose `readArticles` contains the id.
// The derived sum can differ slightly from the stored total (deleted readers,
// reads before the article had an author id, admin resets) - the client shows
// the stored total as the headline and this list as the breakdown.
const PER_READ = 0.02;
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });

  try {
    await dbConnect();
    const author = await User.findById(userId).select('username').lean() as { username?: string } | null;
    if (!author) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

    // Same author resolution as the read route: author id, or the cached name.
    const articles = await Article.find({
      status: 'published',
      $or: [{ author: userId }, ...(author.username ? [{ authorName: author.username }] : [])],
    }).select('title publishedAt createdAt').lean() as { _id: unknown; title: string; publishedAt?: Date; createdAt?: Date }[];

    const ids = articles.map(a => String(a._id));
    const counts = ids.length
      ? await User.aggregate([
          // Bots also land in readArticles, but their reads never pay the author.
          { $match: { readArticles: { $in: ids }, isBot: { $ne: true } } },
          { $unwind: '$readArticles' },
          { $match: { readArticles: { $in: ids } } },
          { $group: { _id: '$readArticles', reads: { $sum: 1 } } },
        ])
      : [];
    const readsById = new Map<string, number>(counts.map((c: { _id: string; reads: number }) => [c._id, c.reads]));

    const list = articles
      .map(a => {
        const id = String(a._id);
        const reads = readsById.get(id) || 0;
        return { id, title: a.title, publishedAt: a.publishedAt || a.createdAt || null, reads, earned: round2(reads * PER_READ) };
      })
      .sort((a, b) => b.earned - a.earned || String(b.publishedAt).localeCompare(String(a.publishedAt)));

    return NextResponse.json({ success: true, perRead: PER_READ, articles: list });
  } catch (error) {
    console.error('Author articles error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load author articles' }, { status: 500 });
  }
}
