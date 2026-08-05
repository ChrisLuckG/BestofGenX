import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import dbConnect from "@/lib/mongoose";
import Article from "@/models/Article";
import User from "@/models/User";

// Compile selected history events into a single "On This Day" article

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface HistoryEvent {
  title: string;
  year: number;
  date: string;
  description: string;
  category: string;
  youtubeSearch: string;
  youtubeVideoId?: string;
  reporterId: string;
  reporterName: string;
}

// Generate cover image using DALL-E
async function generateCoverImage(dayNumber: number, monthName: string, events: HistoryEvent[]): Promise<string | null> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const openai = new OpenAI({ apiKey });

    // Build event description for the prompt
    const eventKeywords = events.slice(0, 3).map(e => e.title).join(', ');
    
    const prompt = `A dramatic cinematic collage for "${monthName} ${dayNumber}" in history. The large number "${dayNumber}" prominently displayed in elegant vintage typography, slightly weathered. Subtle visual references to: ${eventKeywords}. Historical newspaper clippings, old photographs, and vintage memorabilia artfully arranged. Sepia and warm golden tones, nostalgic 80s/90s aesthetic, museum exhibition quality, dramatic lighting, film grain texture. The composition should feel like opening a time capsule. 8K photorealistic, editorial magazine cover style.`;

    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: "1536x1024",
      quality: "high",
    } as Parameters<typeof openai.images.generate>[0]) as any;

    return response.data?.[0]?.url || response.data?.[0]?.b64_json || null;
  } catch (err) {
    console.error("Image generation failed:", err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "OpenAI API key not configured" });
    }

    const body = await request.json();
    const { events, bannerImage, headline } = body as { 
      events: HistoryEvent[]; 
      bannerImage?: string;
      headline?: string;
    };

    if (!events || events.length === 0) {
      return NextResponse.json({ success: false, error: "No events provided" });
    }

    await dbConnect();

    // Get today's date
    const now = new Date();
    const month = MONTHS[now.getMonth()];
    const day = now.getDate();
    const todayStr = `${month} ${day}`;
    
    // Use provided headline or generate default
    const articleTitle = headline || `${todayStr}: Moments That Shaped History`;

    const openai = new OpenAI({ apiKey });

    // Sort events by year
    const sortedEvents = [...events].sort((a, b) => a.year - b.year);

    // Generate article content
    const systemPrompt = `You are writing a "On This Day in History" article for ${todayStr}.
You have ${sortedEvents.length} historical events to include, each from a different reporter.

Create an engaging article that weaves these events together chronologically.
Each event should have its own H2 section with the year in the heading.

Format:
- Title: "${todayStr}: [Creative subtitle summarizing the day]"
- Subtitle: A teaser sentence (max 120 chars)
- Content: HTML with <h2> for each event, <p> for paragraphs

For each event section:
1. H2 heading with year and event title (e.g. "<h2>1985: Live Aid Rocks the World</h2>")
2. 2-3 paragraphs expanding on the event with GenX nostalgia
3. If a YouTube video ID is provided, include it as: <iframe src="https://www.youtube.com/embed/VIDEO_ID" ...></iframe>

Respond with JSON:
{
  "title": "${todayStr}: [Creative subtitle]",
  "subtitle": "Teaser sentence max 120 chars",
  "content": "<h2>1985: Event Title</h2><p>Content...</p>..."
}`;

    const eventsJson = sortedEvents.map(e => ({
      title: e.title,
      year: e.year,
      description: e.description,
      category: e.category,
      youtubeVideoId: e.youtubeVideoId,
      reporterName: e.reporterName,
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Create the article from these events:\n${JSON.stringify(eventsJson, null, 2)}` },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content || "{}";
    let articleData: { title: string; subtitle: string; content: string };

    try {
      articleData = JSON.parse(content);
    } catch (parseErr) {
      console.error("Failed to parse article JSON:", content);
      return NextResponse.json({ success: false, error: "Failed to parse AI response" });
    }

    if (!articleData.title || !articleData.content) {
      return NextResponse.json({ success: false, error: "AI returned incomplete article data" });
    }

    // Use provided banner image or generate one
    let coverImage: string | null = bannerImage || null;
    if (!coverImage) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        console.log(`Generating cover image attempt ${attempt}/2`);
        coverImage = await generateCoverImage(day, month, sortedEvents);
        if (coverImage) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Find system author
    const systemUser = await User.findOne({ isAdmin: true }).select("_id").lean();
    const authorId = systemUser?._id?.toString() || null;

    // Create the article - use provided headline as title if available
    const article = await Article.create({
      title: articleTitle,  // Use the headline from banner generation
      subtitle: articleData.subtitle || "",
      content: articleData.content,
      coverImage: coverImage || "",
      thumbnailUrl: coverImage || "",
      category: "history",
      mainCategory: "articles",
      status: "published",
      publishedAt: now,
      author: authorId,
      authorName: "BOGX Team",
      views: 0,
      likes: 0,
      commentsEnabled: true,
      tags: ["on-this-day", "history", "nostalgia", ...sortedEvents.map(e => e.category)],
      autoGenerated: false, // Manual via newsroom
    });

    return NextResponse.json({
      success: true,
      articleId: article._id,
      title: articleTitle,
      eventCount: sortedEvents.length,
      hasCoverImage: !!coverImage,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to compile history article";
    console.error("history-compile error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
