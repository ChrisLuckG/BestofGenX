import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import TVVideo from '@/models/TVVideo';
import Article from '@/models/Article';

// GET - Fetch all videos
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

    // Auto-create Article entry for this TV video
    await Article.create({
      title: data.title,
      subtitle: data.description || 'Watch now on GenX TV',
      content: `<p>${data.description || 'Watch this video on GenX TV.'}</p>`,
      coverImage: data.thumbnail || (data.youtubeId ? `https://img.youtube.com/vi/${data.youtubeId}/hqdefault.jpg` : ''),
      contentType: 'tv',
      linkedContentId: video._id.toString(),
      mainCategory: 'articles',
      category: 'movies-tv',
      author: data.authorId || '000000000000000000000000',
      authorName: 'BOGX Team',
      status: 'draft',
      layout: 'standard',
      order: 0,
      featured: false,
      trending: false,
      readTime: 1,
      views: 0,
      likes: 0,
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
