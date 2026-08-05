import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import TVVideo from '@/models/TVVideo';

// Search YouTube Data API for real videos
async function searchYouTube(query: string, maxResults: number = 6): Promise<any[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('YOUTUBE_API_KEY not set');
    return [];
  }
  
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    
    if (!res.ok) {
      console.error('YouTube API error:', res.status);
      return [];
    }
    
    const data = await res.json();
    return data.items || [];
  } catch (err) {
    console.error('YouTube search failed:', err);
    return [];
  }
}

// POST /api/editorial/tv-search
// Body: { topic, count?, searchOnly?, saveVideo?, position?, category? }
// searchOnly=true: just search, don't save
// saveVideo: { youtubeId, title, description, duration } + position: save specific video to position
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, count: rawCount = 6, searchOnly = false, saveVideo, position, category = 'GenX' } = body;

    await dbConnect();

    // MODE 1: Save a specific video to a position
    if (saveVideo && position) {
      const { youtubeId, title, description, duration } = saveVideo;
      if (!youtubeId || !position || position < 1 || position > 3) {
        return NextResponse.json({ success: false, error: 'Invalid video or position' }, { status: 400 });
      }

      const thumbnail = `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
      const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

      const video = await TVVideo.findOneAndUpdate(
        { featuredPosition: position },
        {
          title: title || topic,
          description: description || '',
          youtubeUrl,
          youtubeId,
          thumbnail,
          category,
          duration: duration || '',
          language: 'en',
          featured: true,
          featuredPosition: position,
          active: true,
        },
        { upsert: true, new: true }
      );

      return NextResponse.json({ success: true, video, position });
    }

    // MODE 2: Search for videos using real YouTube API
    if (!topic) {
      return NextResponse.json({ success: false, error: 'Missing topic' }, { status: 400 });
    }

    const count = Math.min(Number(rawCount) || 6, 10); // max 10 results for search

    // Use real YouTube Data API
    const youtubeResults = await searchYouTube(topic, count);
    
    if (!youtubeResults.length) {
      return NextResponse.json({ success: false, error: 'No videos found' }, { status: 404 });
    }

    // Map YouTube API results to our format
    const results = youtubeResults.map(item => ({
      youtubeId: item.id?.videoId || '',
      title: item.snippet?.title || '',
      description: item.snippet?.description || '',
      duration: '', // YouTube search API doesn't return duration
      thumbnail: item.snippet?.thumbnails?.medium?.url || `https://img.youtube.com/vi/${item.id?.videoId}/mqdefault.jpg`,
    })).filter(v => v.youtubeId);

    // If searchOnly, just return results without saving
    if (searchOnly) {
      return NextResponse.json({ success: true, videos: results });
    }

    // Legacy mode: save to positions 1, 2, 3 (for backward compatibility)
    const saved: any[] = [];
    for (let i = 0; i < Math.min(results.length, 3); i++) {
      const v = results[i];
      const pos = i + 1;

      const video = await TVVideo.findOneAndUpdate(
        { featuredPosition: pos },
        {
          title: v.title || topic,
          description: v.description || '',
          youtubeUrl: `https://www.youtube.com/watch?v=${v.youtubeId}`,
          youtubeId: v.youtubeId,
          thumbnail: v.thumbnail,
          category,
          duration: v.duration || '',
          language: 'en',
          featured: true,
          featuredPosition: pos,
          active: true,
        },
        { upsert: true, new: true }
      );

      saved.push(video);
    }

    // Purge any stale positions above 3
    await TVVideo.deleteMany({ featuredPosition: { $gt: 3 } });

    return NextResponse.json({ success: true, saved: saved.length, videos: saved });
  } catch (error: any) {
    console.error('tv-search error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
