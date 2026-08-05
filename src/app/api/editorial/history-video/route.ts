import { NextRequest, NextResponse } from "next/server";

// Search for a different YouTube video for a history event

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "YouTube API key not configured" });
    }

    const body = await request.json();
    const { query, year, excludeVideoId } = body as { 
      query: string; 
      year?: number;
      excludeVideoId?: string;
    };

    if (!query) {
      return NextResponse.json({ success: false, error: "No query provided" });
    }

    // Try multiple search queries to find a different video
    const searchQueries = [
      `${query} ${year || ''} documentary`,
      `${query} ${year || ''} history`,
      `${query} ${year || ''} archive footage`,
      `${query} original`,
      query,
    ];

    for (const q of searchQueries) {
      const searchQuery = encodeURIComponent(q.trim());
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&maxResults=5&key=${apiKey}`
      );

      if (!response.ok) {
        console.error("YouTube API error:", response.status);
        continue;
      }

      const data = await response.json();
      
      // Find a video that's not the excluded one
      for (const item of data.items || []) {
        const videoId = item.id?.videoId;
        if (videoId && videoId !== excludeVideoId) {
          console.log(`Found different YouTube video for "${q}": ${videoId}`);
          return NextResponse.json({
            success: true,
            videoId,
            title: item.snippet?.title || '',
          });
        }
      }
    }

    return NextResponse.json({ 
      success: false, 
      error: "No different video found" 
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to search videos";
    console.error("history-video error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
