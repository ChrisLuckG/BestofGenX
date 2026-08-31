import { NextRequest, NextResponse } from 'next/server';
import { searchYouTubeVideo, PREFER_LONG_THEN_ANY } from '@/lib/youtubeSearch';

// GET - Search YouTube and return thumbnail URL
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json({ success: false, error: 'Missing query parameter' }, { status: 400 });
    }
    
    const result = await searchYouTubeVideo({
      query,
      tiers: PREFER_LONG_THEN_ANY, // Allow any duration for ranking items
      maxResults: 5,
      // No topical gate here: this only supplies a tile thumbnail, where a loosely
      // related image beats an empty tile. The gate exists for videos embedded next
      // to article prose, where a wrong video actively misinforms.
      minRelevance: 0,
    });
    
    if (result?.videoId) {
      // Return YouTube thumbnail URL
      const thumbnailUrl = `https://img.youtube.com/vi/${result.videoId}/hqdefault.jpg`;
      return NextResponse.json({ 
        success: true, 
        url: thumbnailUrl,
        videoId: result.videoId,
        title: result.title,
      });
    }
    
    return NextResponse.json({ success: false, error: 'No video found' });
  } catch (error: any) {
    console.error('YouTube thumbnail search error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
