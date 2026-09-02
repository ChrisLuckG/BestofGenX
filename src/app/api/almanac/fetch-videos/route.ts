import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Person } from '@/models/Almanac';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

interface VideoResult {
  videoId: string;
  title: string;
  duration?: string;
  type?: 'documentary' | 'interview' | 'performance' | 'other';
}

// Convert ISO 8601 duration to readable format
function formatDuration(isoDuration: string): string {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Get duration in seconds for filtering
function getDurationSeconds(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  return hours * 3600 + minutes * 60 + seconds;
}

// Determine video type from title
function getVideoType(title: string): 'documentary' | 'interview' | 'performance' | 'other' {
  const lower = title.toLowerCase();
  if (lower.includes('documentary') || lower.includes('biography') || lower.includes('life story') || lower.includes('the story of') || lower.includes('full documentary')) {
    return 'documentary';
  }
  if (lower.includes('interview') || lower.includes('talks') || lower.includes('conversation')) {
    return 'interview';
  }
  if (lower.includes('live') || lower.includes('concert') || lower.includes('performance') || lower.includes('full show')) {
    return 'performance';
  }
  return 'other';
}

async function searchYouTube(query: string, maxResults: number = 20): Promise<any[]> {
  if (!YOUTUBE_API_KEY) {
    console.error('No YouTube API key');
    return [];
  }
  
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', String(maxResults));
  url.searchParams.set('videoDuration', 'long'); // > 20 minutes
  url.searchParams.set('key', YOUTUBE_API_KEY);
  
  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error('YouTube search error:', res.status);
    return [];
  }
  
  const data = await res.json();
  return data.items || [];
}

async function getVideoDurations(videoIds: string[]): Promise<Record<string, string>> {
  if (!YOUTUBE_API_KEY || videoIds.length === 0) return {};
  
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'contentDetails');
  url.searchParams.set('id', videoIds.join(','));
  url.searchParams.set('key', YOUTUBE_API_KEY);
  
  const res = await fetch(url.toString());
  if (!res.ok) return {};
  
  const data = await res.json();
  const durations: Record<string, string> = {};
  
  for (const item of data.items || []) {
    const isoDuration = item.contentDetails?.duration;
    if (isoDuration) {
      const seconds = getDurationSeconds(isoDuration);
      // Only include videos longer than 10 minutes (prefer documentaries)
      if (seconds >= 600) {
        durations[item.id] = formatDuration(isoDuration);
      }
    }
  }
  
  return durations;
}

export async function POST(req: NextRequest) {
  try {
    const { personId, name, profession, knownfor } = await req.json();
    
    if (!personId || !name) {
      return NextResponse.json({ success: false, error: 'Missing personId or name' }, { status: 400 });
    }
    
    await dbConnect();
    
    // Build search queries for documentaries
    const searchQueries = [
      `${name} documentary`,
      `${name} biography documentary`,
      `${name} full documentary`,
      `${name} life story`,
    ];
    
    // Add profession-specific searches
    if (profession === 'Music') {
      searchQueries.push(`${name} music documentary`);
      searchQueries.push(`${name} behind the music`);
    } else if (profession === 'Actor') {
      searchQueries.push(`${name} actor documentary`);
      searchQueries.push(`${name} hollywood documentary`);
    } else if (profession === 'Sport') {
      searchQueries.push(`${name} sports documentary`);
      searchQueries.push(`${name} athlete story`);
    }
    
    // Search YouTube
    const allResults: any[] = [];
    const seenIds = new Set<string>();
    
    for (const query of searchQueries.slice(0, 3)) { // Limit to 3 queries to save API quota
      const results = await searchYouTube(query, 10);
      for (const item of results) {
        const videoId = item.id?.videoId;
        if (videoId && !seenIds.has(videoId)) {
          seenIds.add(videoId);
          allResults.push(item);
        }
      }
      // Small delay between requests
      await new Promise(r => setTimeout(r, 100));
    }
    
    if (allResults.length === 0) {
      return NextResponse.json({ success: false, error: 'No videos found' });
    }
    
    // Get durations for all videos
    const videoIds = allResults.map(r => r.id.videoId);
    const durations = await getVideoDurations(videoIds);
    
    // Filter and sort by duration (longer = better for documentaries)
    const videos: VideoResult[] = [];
    
    for (const item of allResults) {
      const videoId = item.id.videoId;
      const duration = durations[videoId];
      
      if (!duration) continue; // Skip short videos
      
      const title = item.snippet?.title || '';
      
      // Skip if title doesn't seem relevant
      const nameParts = name.toLowerCase().split(' ');
      const titleLower = title.toLowerCase();
      const hasNameMatch = nameParts.some((part: string) => part.length > 2 && titleLower.includes(part));
      
      if (!hasNameMatch) continue;
      
      videos.push({
        videoId,
        title,
        duration,
        type: getVideoType(title),
      });
    }
    
    // Sort by type preference (documentary > interview > performance > other)
    const typeOrder = { documentary: 0, interview: 1, performance: 2, other: 3 };
    videos.sort((a, b) => (typeOrder[a.type || 'other'] - typeOrder[b.type || 'other']));
    
    // Take top 3
    const topVideos = videos.slice(0, 3);
    
    if (topVideos.length === 0) {
      return NextResponse.json({ success: false, error: 'No suitable documentaries found' });
    }
    
    // Save to database
    await Person.updateOne(
      { _id: personId },
      { $set: { videos: topVideos } }
    );
    
    return NextResponse.json({ success: true, videos: topVideos });
    
  } catch (error) {
    console.error('Fetch videos error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
