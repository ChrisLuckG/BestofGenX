import { NextRequest, NextResponse } from "next/server";
import { searchYouTubeVideo, PREFER_LONG } from "@/lib/youtubeSearch";

// Search for a different YouTube video for a history event.
// Uses the shared helper so this "give me another video" action honours the same
// long-then-medium duration preference as the initial search - it used to run an
// unfiltered query and return the first hit, which is how short clips got in.

export async function POST(request: NextRequest) {
  try {
    if (!process.env.YOUTUBE_API_KEY) {
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

    const hit = await searchYouTubeVideo({
      query,
      year,
      excludeVideoId,
      tiers: PREFER_LONG,
      extraQueries: [
        `${query} ${year || ''} history`.trim(),
        `${query} original`,
      ],
    });

    if (!hit) {
      return NextResponse.json({
        success: false,
        error: "No other long-form video found for this event",
      });
    }

    return NextResponse.json({
      success: true,
      videoId: hit.videoId,
      title: hit.title,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to search videos";
    console.error("history-video error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
