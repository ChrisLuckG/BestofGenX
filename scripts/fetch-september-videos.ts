import mongoose from 'mongoose';
import { Person } from '../src/models/Almanac';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

interface VideoResult {
  videoId: string;
  title: string;
  duration?: string;
  type?: 'documentary' | 'interview' | 'performance' | 'other';
}

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

function getDurationSeconds(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  return hours * 3600 + minutes * 60 + seconds;
}

function getVideoType(title: string): 'documentary' | 'interview' | 'performance' | 'other' {
  const lower = title.toLowerCase();
  if (lower.includes('documentary') || lower.includes('biography') || lower.includes('life story') || lower.includes('the story of')) {
    return 'documentary';
  }
  if (lower.includes('interview') || lower.includes('talks') || lower.includes('conversation')) {
    return 'interview';
  }
  if (lower.includes('live') || lower.includes('concert') || lower.includes('performance')) {
    return 'performance';
  }
  return 'other';
}

async function searchYouTube(query: string): Promise<any[]> {
  if (!YOUTUBE_API_KEY) return [];
  
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', '15');
  url.searchParams.set('videoDuration', 'long');
  url.searchParams.set('key', YOUTUBE_API_KEY);
  
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  
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
    if (isoDuration && getDurationSeconds(isoDuration) >= 600) {
      durations[item.id] = formatDuration(isoDuration);
    }
  }
  
  return durations;
}

async function fetchVideosForPerson(name: string, profession: string): Promise<VideoResult[]> {
  const results = await searchYouTube(`${name} documentary`);
  
  if (results.length === 0) return [];
  
  const videoIds = results.map((r: any) => r.id.videoId);
  const durations = await getVideoDurations(videoIds);
  
  const videos: VideoResult[] = [];
  const nameParts = name.toLowerCase().split(' ');
  
  for (const item of results) {
    const videoId = item.id.videoId;
    const duration = durations[videoId];
    if (!duration) continue;
    
    const title = item.snippet?.title || '';
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
  
  // Sort by type preference
  const typeOrder: Record<string, number> = { documentary: 0, interview: 1, performance: 2, other: 3 };
  videos.sort((a, b) => (typeOrder[a.type || 'other'] - typeOrder[b.type || 'other']));
  
  return videos.slice(0, 3);
}

async function main() {
  const dry = process.argv.includes('--dry');
  const limit = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '50');
  
  if (!YOUTUBE_API_KEY) {
    console.error('No YOUTUBE_API_KEY found in environment');
    process.exit(1);
  }
  
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  console.log(`\n=== Fetching Videos for September GenX (limit: ${limit}) ===\n`);
  
  // Get September people without videos
  const septemberPeople = await Person.find({
    born: { $regex: '-09-' },
    $or: [
      { videos: { $exists: false } },
      { videos: { $size: 0 } },
    ]
  }).limit(limit).lean();
  
  console.log(`Found ${septemberPeople.length} September people without videos\n`);
  
  let processed = 0;
  let withVideos = 0;
  
  for (const p of septemberPeople) {
    const name = `${p.firstname} ${p.lastname}`;
    process.stdout.write(`${++processed}/${septemberPeople.length} ${name}... `);
    
    const videos = await fetchVideosForPerson(name, p.profession);
    
    if (videos.length > 0) {
      console.log(`✅ ${videos.length} videos`);
      withVideos++;
      
      if (!dry) {
        await Person.updateOne({ _id: p._id }, { $set: { videos } });
      }
    } else {
      console.log('❌ none');
    }
    
    // Rate limit - YouTube API has quotas
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Processed: ${processed}`);
  console.log(`With videos: ${withVideos}`);
  
  await mongoose.disconnect();
}

main();
