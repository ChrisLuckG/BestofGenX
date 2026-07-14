import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import dbConnect from '@/lib/mongoose';
import TVVideo from '@/models/TVVideo';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /api/editorial/tv-search
// Body: { topic, count?, featuredStart?, category?, authorId? }
// Uses GPT-4 knowledge to find real YouTube video IDs, saves to TV section
export async function POST(request: NextRequest) {
  try {
    const { topic, count: rawCount = 3, featuredStart = 1, category = 'Action', authorId } = await request.json();
    const count = Math.min(Number(rawCount) || 3, 3); // max 3 TV clips

    if (!topic) {
      return NextResponse.json({ success: false, error: 'Missing topic' }, { status: 400 });
    }

    // Ask GPT-4 for real, well-known YouTube videos about the topic
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a YouTube curator. Return ONLY valid JSON — an array of ${count} real YouTube videos.
Each item must have:
- "youtubeId": the real 11-character YouTube video ID (e.g. "dQw4w9WgXcQ")
- "title": the video title
- "description": 1-2 sentence description
- "duration": approximate runtime like "2:34" or "12:45"
- "language": ISO 639-1 code ("en", "de", etc.)

Rules:
- Only use real, well-known videos that actually exist on YouTube
- Prefer official clips, trailers, interviews, documentaries
- No playlists, no live streams
- Return ONLY the JSON array, no markdown, no extra text`,
        },
        {
          role: 'user',
          content: `Find ${count} great YouTube videos about: ${topic}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 800,
    });

    const raw = completion.choices[0]?.message?.content || '[]';
    let videos: any[];
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      videos = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ success: false, error: 'AI returned invalid JSON' }, { status: 500 });
    }

    if (!Array.isArray(videos) || !videos.length) {
      return NextResponse.json({ success: false, error: 'No videos found' }, { status: 404 });
    }

    await dbConnect();
    const saved: any[] = [];

    for (let i = 0; i < Math.min(videos.length, count); i++) {
      const v = videos[i];
      if (!v.youtubeId) continue;

      const youtubeId = v.youtubeId.trim();
      const thumbnail = `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
      const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
      const pos = featuredStart + i;

      // Upsert: overwrite existing video at this featured position (no duplicates)
      const video = await TVVideo.findOneAndUpdate(
        { featuredPosition: pos },
        {
          title: v.title || topic,
          description: v.description || '',
          youtubeUrl,
          youtubeId,
          thumbnail,
          category,
          duration: v.duration || '',
          language: v.language || 'en',
          featured: true,
          featuredPosition: pos,
          active: true,
        },
        { upsert: true, new: true }
      );

      saved.push(video);
    }

    // Purge any stale positions above 3 (e.g. old pos 4 & 5 from before the cap)
    await TVVideo.deleteMany({ featuredPosition: { $gt: 3 } });

    return NextResponse.json({ success: true, saved: saved.length, videos: saved });
  } catch (error: any) {
    console.error('tv-search error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
