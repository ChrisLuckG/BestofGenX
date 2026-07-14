import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Article from '@/models/Article';
import User from '@/models/User';

// Dedicated banner "general pages" — one per banner area (like Music's Community Sound).
// These are hardcoded feature pages that the FIXED banner links to. They are excluded
// from the feed auto-fill and only reachable via their banner.
const BANNER_PAGES: { category: string; title: string; subtitle: string; content: string; coverImage: string }[] = [
  {
    category: 'eastercorn',
    title: 'Eastercorn',
    subtitle: 'The weird, the wild and the wonderful corners of Gen X culture.',
    content: `<p>Welcome to Eastercorn — our home for the offbeat stories, hidden gems and cult favorites that defined a generation.</p>`,
    coverImage: '',
  },
  {
    category: 'sports',
    title: 'GenX Sport',
    subtitle: 'The legends, the moments and the matches we will never forget.',
    content: `<p>From ringside classics to last-second buzzer beaters — this is the home of Gen X sport.</p>`,
    coverImage: '',
  },
  {
    category: 'movies-tv',
    title: 'TV & Cinema',
    subtitle: 'The screens that raised us — from VHS nights to blockbuster Saturdays.',
    content: `<p>Movies and TV that shaped a generation. Dive into the films, shows and icons that defined the era.</p>`,
    coverImage: '',
  },
  {
    category: 'lifestyle',
    title: 'Lifestyle',
    subtitle: 'Style, food, travel and the everyday culture of Gen X.',
    content: `<p>The flavors, fashions and trends that made up everyday Gen X life.</p>`,
    coverImage: '',
  },
];

// POST - Create the dedicated banner pages if missing (run once, idempotent)
export async function POST() {
  try {
    await dbConnect();

    const admin = await User.findOne({ isAdmin: true }).select('_id').lean();

    const results: { category: string; status: string; articleId?: string }[] = [];

    for (const page of BANNER_PAGES) {
      const existing = await Article.findOne({ contentType: 'banner-page', category: page.category });
      if (existing) {
        results.push({ category: page.category, status: 'exists', articleId: String(existing._id) });
        continue;
      }

      const article = await Article.create({
        title: page.title,
        subtitle: page.subtitle,
        content: page.content,
        coverImage: page.coverImage,
        thumbnailUrl: page.coverImage,
        contentType: 'banner-page',
        category: page.category,
        mainCategory: 'articles',
        status: 'published',
        publishedAt: new Date(),
        author: admin?._id || null,
        authorName: 'BOGX Team',
        tags: [page.category],
        featured: false,
        views: 0,
        likes: 0,
      });

      results.push({ category: page.category, status: 'created', articleId: String(article._id) });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
