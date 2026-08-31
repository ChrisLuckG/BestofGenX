import { NextRequest, NextResponse } from "next/server";
import { searchYouTubeVideo, PREFER_LONG, PREFER_LONG_THEN_ANY } from "@/lib/youtubeSearch";

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
    const { query, year, excludeVideoId, context } = body as { 
      query: string; 
      year?: number;
      excludeVideoId?: string;
      /** Event title + description, so the replacement is still about the event. */
      context?: string;
    };

    if (!query) {
      return NextResponse.json({ success: false, error: "No query provided" });
    }

    console.log(`[history-video] Searching for different video. Query: "${query}", Year: ${year}, Exclude: ${excludeVideoId}`);

    // Try with more query variations to find a different video
    let hit = await searchYouTubeVideo({
      query,
      year,
      excludeVideoId,
      context,
      tiers: PREFER_LONG,
      maxResults: 15, // Get more results to find alternatives
      extraQueries: [
        `${query} ${year || ''} history`.trim(),
        `${query} original`,
        `${query} documentary ${year || ''}`.trim(),
        `${query} archive footage`,
        `${query} full video`,
        `${query} news report ${year || ''}`.trim(),
      ],
    });

    // If still no result, try with 'any' duration as last resort
    if (!hit && excludeVideoId) {
      console.log(`[history-video] No long/medium video found, trying with 'any' duration...`);
      hit = await searchYouTubeVideo({
        query,
        year,
        excludeVideoId,
        context,
        tiers: PREFER_LONG_THEN_ANY,
        maxResults: 20,
        extraQueries: [
          `${query} ${year || ''}`.trim(),
          `${query} highlights`,
        ],
      });
    }

    if (!hit) {
      console.log(`[history-video] No alternative video found for "${query}"`);
      return NextResponse.json({
        success: false,
        error: "No other video found for this event. Try a different search term.",
      });
    }

    console.log(`[history-video] Found alternative: ${hit.videoId} - "${hit.title}"`);
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
