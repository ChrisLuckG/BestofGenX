import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { placePersonVideoInToday, expireToday } from '@/lib/personTvVideo';
import TVVideo from '@/models/TVVideo';

// Hero positions 1-3 are unique: setting one takes it away from whoever held it.
// This used to be done only by the TV admin tab in the browser, so every other caller
// (the Menschen tab's "Add to GenX TV") left two videos on the same position - and
// POST did not store the position at all.
const normalizePosition = (v: unknown): number | null => ([1, 2, 3].includes(Number(v)) ? Number(v) : null);
async function freePosition(position: number, exceptId?: string) {
  await TVVideo.updateMany(
    { featuredPosition: position, ...(exceptId ? { _id: { $ne: exceptId } } : {}) },
    { $set: { featuredPosition: null, featured: false } },
  );
}

// GET - Fetch all videos.
// Person videos are NOT injected here: picking a slot in the Menschen tab creates a
// real TVVideo row (see /api/almanac/set-tv-featured), so injecting them again
// would show every featured documentary twice.
export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get('all') === 'true';
    const featuredOnly = searchParams.get('featured') === 'true';
    
    let query: any = showAll ? {} : { active: true };
    
    // The GenX TV sidebar widget: the article videos' waterfall (widgetPosition 1-3, newest on top),
    // topped up with the hero's videos while fewer than three article videos exist
    if (searchParams.get('widget') === 'true') {
      const own = await TVVideo.find({ ...query, widgetPosition: { $in: [1, 2, 3] } }).sort({ widgetPosition: 1 }).lean();
      const fill = own.length >= 3 ? [] : await TVVideo.find({ ...query, featuredPosition: { $in: [1, 2, 3] }, _id: { $nin: own.map((v: any) => v._id) } }).sort({ featuredPosition: 1 }).limit(3 - own.length).lean();
      return NextResponse.json({ success: true, videos: [...own, ...fill] });
    }

    // If requesting only featured videos (for sidebar/hero)
    if (featuredOnly) {
      query.featuredPosition = { $in: [1, 2, 3] };
      const videos = await TVVideo.find(query).sort({ featuredPosition: 1 });
      return NextResponse.json({ success: true, videos });
    }
    
    // "Todays Bogxers" is today's only - yesterday's go to their own category before the page is built
    await expireToday().catch(e => console.error('[GenX TV] expireToday failed', e));
    const videos = await TVVideo.find(query).sort({ featuredPosition: 1, createdAt: -1 });
    return NextResponse.json({ success: true, videos });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Create new video
export async function POST(request: Request) {
  try {
    await dbConnect();
    const data = await request.json();
    const position = normalizePosition(data.featuredPosition);
    if (position) await freePosition(position);
    
    const video = await TVVideo.create({
      title: data.title,
      description: data.description || '',
      youtubeUrl: data.youtubeUrl,
      youtubeId: data.youtubeId,
      thumbnail: data.thumbnail,
      category: data.category || 'Music Videos',
      duration: data.duration || '',
      language: 'en', // GenX TV is English-only
      featured: position ? true : (data.featured || false),
      featuredPosition: position,
      active: true,
      personRef: data.personRef || null,
    });
    // A person's video from Menschen ('Add to GenX TV'): into 'Todays Bogxers', later into the person's category
    if (data.today && data.personRef) await placePersonVideoInToday(String(video._id));

    return NextResponse.json({ success: true, video: data.today && data.personRef ? await TVVideo.findById(video._id) : video });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT - Update video
export async function PUT(request: Request) {
  try {
    await dbConnect();
    const data = await request.json();
    const position = normalizePosition(data.featuredPosition);
    if (position) await freePosition(position, data._id);
    
    const video = await TVVideo.findByIdAndUpdate(
      data._id,
      {
        title: data.title,
        description: data.description,
        youtubeUrl: data.youtubeUrl,
        youtubeId: data.youtubeId,
        thumbnail: data.thumbnail,
        category: data.category,
        duration: data.duration,
        language: 'en', // GenX TV is English-only
        featured: position ? true : data.featured,
        featuredPosition: position,
        active: data.active !== undefined ? data.active : true,
        personRef: data.personRef || null,
      },
      { new: true }
    );
    if (video && data.today && data.personRef) await placePersonVideoInToday(String(video._id));

    return NextResponse.json({ success: true, video });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Delete video
export async function DELETE(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }

    await TVVideo.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
