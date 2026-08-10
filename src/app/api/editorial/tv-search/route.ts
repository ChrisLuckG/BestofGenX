import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import TVVideo from '@/models/TVVideo';

// Parse ISO 8601 duration (PT1H30M45S) to human readable (1:30:45)
function parseDuration(isoDuration: string): string {
  if (!isoDuration) return '';
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  const hours = match[1] ? parseInt(match[1]) : 0;
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const seconds = match[3] ? parseInt(match[3]) : 0;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Search YouTube Data API for real videos - prioritize longer documentaries
async function searchYouTube(query: string, maxResults: number = 6): Promise<any[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('YOUTUBE_API_KEY not set');
    return [];
  }
  
  try {
    // Add "documentary" or "full" to query to find longer content, filter for long videos (>20min)
    const enhancedQuery = `${query} documentary OR interview OR full`;
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(enhancedQuery)}&type=video&videoDuration=long&maxResults=${maxResults}&key=${apiKey}`;
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
    
    if (!res.ok) {
      console.error('YouTube API error:', res.status);
      return [];
    }
    
    const data = await res.json();
    const items = data.items || [];
    
    // Get video IDs to fetch duration
    const videoIds = items.map((item: any) => item.id?.videoId).filter(Boolean).join(',');
    if (!videoIds) return items;
    
    // Fetch video details including duration
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}`;
    const detailsRes = await fetch(detailsUrl, { signal: AbortSignal.timeout(5000) });
    
    if (detailsRes.ok) {
      const detailsData = await detailsRes.json();
      const durationMap: Record<string, string> = {};
      (detailsData.items || []).forEach((v: any) => {
        durationMap[v.id] = parseDuration(v.contentDetails?.duration || '');
      });
      
      // Add duration to each item
      items.forEach((item: any) => {
        if (item.id?.videoId && durationMap[item.id.videoId]) {
          item.duration = durationMap[item.id.videoId];
        }
      });
    }
    
    return items;
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
      duration: item.duration || '', // Duration fetched from contentDetails API
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
