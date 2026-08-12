import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import dbConnect from "@/lib/mongoose";
import Article from "@/models/Article";
import User from "@/models/User";

// Compile selected history events into a single "On This Day" article

// Cover generation with gpt-image-2 at quality "high" takes ~2 minutes, on top of
// the article-writing completion. Without this the route hits the platform's
// default serverless timeout (~10-15s) in production.
export const maxDuration = 300;

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

// Generate cover image using DALL-E - compress and upload to Cloudinary
async function generateCoverImage(dayNumber: number, monthName: string, events: HistoryEvent[]): Promise<string | null> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const openai = new OpenAI({ apiKey });

    // Build event description for the prompt
    const eventKeywords = events.slice(0, 3).map(e => e.title).join(', ');
    
    // "magazine cover" was removed on purpose: covers are portrait, and asking for
    // one fought the landscape format. The prompt now states the wide format up
    // front and describes a horizontal composition.
    const prompt = `A wide cinematic landscape banner (16:9 horizontal composition) for "${monthName} ${dayNumber}" in history. The large number "${dayNumber}" prominently displayed in elegant vintage typography, slightly weathered, positioned to one side. Subtle visual references to: ${eventKeywords}. Historical newspaper clippings, old photographs, and vintage memorabilia artfully arranged and spread horizontally across the full width of the frame. Sepia and warm golden tones, nostalgic 80s/90s aesthetic, museum exhibition quality, dramatic lighting, film grain texture. The composition should feel like opening a time capsule. Photorealistic, high detail, wide editorial banner - fill the entire wide frame edge to edge, no borders, no vertical poster framing.`;

    // Article banners are displayed wide, so the image MUST be landscape.
    // The previous 1024x1024 was square and got cropped hard in the header.
    // gpt-image-2 is the newest image model available on this account.
    const response = await openai.images.generate({
      model: "gpt-image-2",
      prompt,
      n: 1,
      size: "1536x1024",   // landscape 3:2
      quality: "high",     // highest quality tier
    } as Parameters<typeof openai.images.generate>[0]) as any;

    const imageUrl = response.data?.[0]?.url;
    const b64Json = response.data?.[0]?.b64_json;

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const uploadToCloudinary = async (buffer: Buffer): Promise<string> => {
      // Keep the full 1536px width: this is a banner, and downscaling to 800px
      // made it visibly soft on desktop. Landscape ratio is enforced here too,
      // so a non-landscape source can never slip through.
      const processed = await sharp(buffer)
        .resize(1536, 1024, { fit: 'cover', position: 'centre', withoutEnlargement: true })
        .webp({ quality: 92 })
        .toBuffer();

      console.log(`History cover: ${buffer.length} -> ${processed.length} bytes (1536x1024 webp q92)`);

      const publicId = `images/history-cover-${Date.now()}`;
      const uploadResult = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { public_id: publicId, resource_type: 'image', folder: 'bestofgenx' },
          (error, result) => error ? reject(error) : resolve(result)
        );
        uploadStream.end(processed);
      });
      return uploadResult.secure_url;
    };

    // b64 first: gpt-image-1 returns base64. A returned URL is only a temporary
    // OpenAI link that expires within the hour, so it must never be stored as-is
    // - it gets fetched and pushed to Cloudinary like everything else.
    if (b64Json) {
      return await uploadToCloudinary(Buffer.from(b64Json, 'base64'));
    }

    if (imageUrl) {
      const res = await fetch(imageUrl);
      if (!res.ok) {
        console.error('Failed to download generated image:', res.status);
        return null;
      }
      return await uploadToCloudinary(Buffer.from(await res.arrayBuffer()));
    }

    return null;
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

IMPORTANT: ALL events MUST have happened on ${todayStr} (this exact date). 
If an event's date doesn't match ${todayStr}, DO NOT include it.

Create an engaging article that weaves these events together chronologically.
Each event should have its own H2 section with the FULL DATE in the heading.

Format:
- Title: "${todayStr}: [Creative subtitle summarizing the day]"
- Subtitle: A teaser sentence (max 120 chars)
- Content: HTML with <h2> for each event, <p> for paragraphs

For each event section:
1. H2 heading with FULL DATE and event title (e.g. "<h2>${todayStr}, 1985: Live Aid Rocks the World</h2>")
2. 2-3 paragraphs expanding on the event with GenX nostalgia
3. If a YouTube video ID is provided, include it as: <iframe src="https://www.youtube.com/embed/VIDEO_ID" ...></iframe>

Respond with JSON:
{
  "title": "${todayStr}: [Creative subtitle]",
  "subtitle": "Teaser sentence max 120 chars",
  "content": "<h2>${todayStr}, 1985: Event Title</h2><p>Content...</p>..."
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
