import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import TVVideo from '@/models/TVVideo';

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
    
    // If requesting only featured videos (for sidebar/hero)
    if (featuredOnly) {
      query.featuredPosition = { $in: [1, 2, 3] };
      const videos = await TVVideo.find(query).sort({ featuredPosition: 1 });
      return NextResponse.json({ success: true, videos });
    }
    
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
    
    const video = await TVVideo.create({
      title: data.title,
      description: data.description || '',
      youtubeUrl: data.youtubeUrl,
      youtubeId: data.youtubeId,
      thumbnail: data.thumbnail,
      category: data.category || 'Music Videos',
      duration: data.duration || '',
      language: data.language || 'en',
      featured: data.featured || false,
      active: true,
    });

    return NextResponse.json({ success: true, video });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT - Update video
export async function PUT(request: Request) {
  try {
    await dbConnect();
    const data = await request.json();
    
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
        language: data.language || 'en',
        featured: data.featured,
        featuredPosition: data.featuredPosition,
        active: data.active !== undefined ? data.active : true,
      },
      { new: true }
    );

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
