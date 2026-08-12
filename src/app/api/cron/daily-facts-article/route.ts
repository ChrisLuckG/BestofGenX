import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import dbConnect from "@/lib/mongoose";
import DailyFact from "@/models/DailyFact";
import Article from "@/models/Article";
import { combinePrompts } from "@/lib/loadPrompt";

// Cron job to generate daily "On This Day" article
// Runs at 9:00 AM, creates article scheduled for 10:00 AM

// This job waits on /api/generate-image, which needs ~2 minutes at quality
// "high", plus the article-writing completion. Without this it hits the
// platform's default serverless timeout and no article gets created.
export const maxDuration = 300;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Load modular prompts: core + daily-facts rules
function getSystemPrompt(): string {
  return combinePrompts(["core.txt", "daily-facts.txt"]);
}

// Generate image using the existing /api/generate-image endpoint
async function generateArticleImage(title: string, subtitle: string, baseUrl: string, dayNumber: number, monthName: string, eventKeywords: string[]): Promise<string | null> {
  try {
    // Build event description for the prompt
    const eventsDescription = eventKeywords.length > 0 
      ? `Subtle visual references to: ${eventKeywords.slice(0, 3).join(', ')}.` 
      : '';
    
    // No "magazine cover" wording here: covers are portrait and fight the
    // landscape aspect ratio requested below.
    const prompt = `A wide cinematic landscape banner (horizontal 3:2 composition) for "${monthName} ${dayNumber}" in history. The large number "${dayNumber}" prominently displayed in elegant vintage typography, slightly weathered, positioned to one side. ${eventsDescription} Historical newspaper clippings, old photographs, and vintage memorabilia artfully arranged and spread horizontally across the full width of the frame. Sepia and warm golden tones, nostalgic 80s/90s aesthetic, museum exhibition quality, dramatic lighting, film grain texture. The composition should feel like opening a time capsule. Photorealistic, high detail, fills the entire wide frame edge to edge, no borders, no vertical poster framing.`;
    
    const response = await fetch(`${baseUrl}/api/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, style: 'article', aspectRatio: 'landscape' }),
    });

    if (!response.ok) {
      console.error("Image generation failed:", response.status);
      return null;
    }

    const data = await response.json();
    if (data.success && data.imageUrl) {
      return data.imageUrl;
    }
  } catch (err) {
    console.error("Image generation failed:", err);
  }

  return null;
}

// Search YouTube for a relevant video
async function searchYouTubeVideo(query: string): Promise<string | null> {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return null;
    
    const searchQuery = encodeURIComponent(`${query} 80s 90s official`);
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&maxResults=1&key=${apiKey}`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.items?.[0]?.id?.videoId) {
      return `https://www.youtube.com/watch?v=${data.items[0].id.videoId}`;
    }
  } catch (err) {
    console.error("YouTube search failed:", err);
  }
  return null;
}

// Search Wikimedia for an image
async function searchWikimediaImage(query: string): Promise<string | null> {
  try {
    const searchQuery = encodeURIComponent(query);
    const response = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${searchQuery}&srnamespace=6&srlimit=1&format=json&origin=*`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const title = data.query?.search?.[0]?.title;
    if (!title) return null;
    
    // Get the actual image URL
    const imageInfoResponse = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&format=json&origin=*`
    );
    
    if (!imageInfoResponse.ok) return null;
    
    const imageData = await imageInfoResponse.json();
    const pages = imageData.query?.pages;
    const pageId = Object.keys(pages)[0];
    return pages[pageId]?.imageinfo?.[0]?.url || null;
  } catch (err) {
    console.error("Wikimedia search failed:", err);
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security (Vercel cron jobs send this)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    // Allow if no secret configured (dev) or if secret matches
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const now = new Date();
    const dateKey = getDateKey(now);
    const humanDate = `${MONTHS[now.getMonth()]} ${now.getDate()}`;

    // Check if article already exists for today
    const existingArticle = await Article.findOne({
      title: { $regex: `${MONTHS[now.getMonth()]} ${now.getDate()}:`, $options: "i" },
      createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
    });

    if (existingArticle) {
      return NextResponse.json({
        success: true,
        message: "Article already exists for today",
        articleId: existingArticle._id,
      });
    }

    // Get daily facts from cache
    const dailyFact = await DailyFact.findOne({ dateKey });
    if (!dailyFact?.welcome?.facts || dailyFact.welcome.facts.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No daily facts available for today. Run /api/daily-facts first.",
      });
    }

    const facts = dailyFact.welcome.facts;

    // Generate article content via OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "OpenAI API key not configured" });
    }

    const openai = new OpenAI({ apiKey });
    const systemPrompt = getSystemPrompt();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Generate daily facts article for ${humanDate} with facts: ${JSON.stringify(facts)}`,
        },
      ],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content || "{}";
    let articleData: {
      title: string;
      subtitle: string;
      content: string;
      imageKeywords: string[];
    } | null = null;

    try {
      const parsed = JSON.parse(content);
      if (parsed.title && parsed.content) {
        let processedContent = String(parsed.content).trim();
        
        // Extract h2 titles to search for media
        const h2Matches = processedContent.match(/<h2[^>]*>([^<]+)<\/h2>/gi) || [];
        const sectionTitles = h2Matches.map(h2 => h2.replace(/<[^>]+>/g, '').trim());
        
        // Search for YouTube videos and images for each section
        const mediaPromises = sectionTitles.map(async (title, index) => {
          // Alternate between video and image, or try both
          const videoUrl = await searchYouTubeVideo(title);
          const imageUrl = !videoUrl ? await searchWikimediaImage(title) : null;
          return { index, title, videoUrl, imageUrl };
        });
        
        const mediaResults = await Promise.all(mediaPromises);
        
        // Insert media blocks after each section
        // Find each </p> that comes after content related to an h2
        let sectionIndex = 0;
        processedContent = processedContent.replace(
          /(<h2[^>]*>[^<]+<\/h2>)([\s\S]*?)(<\/p>)(\s*)(?=<h2|$)/gi,
          (match, h2, content, closeP, whitespace) => {
            const media = mediaResults[sectionIndex];
            sectionIndex++;
            
            let mediaBlock = '';
            if (media?.videoUrl) {
              mediaBlock = `<div data-type="video" data-url="${media.videoUrl}"></div>`;
            } else if (media?.imageUrl) {
              mediaBlock = `<div data-type="image" data-url="${media.imageUrl}"></div>`;
            } else {
              // Fallback: empty video block for manual filling
              mediaBlock = `<div data-type="video" data-url=""></div>`;
            }
            
            return `${h2}${content}${closeP}${whitespace}${mediaBlock}${whitespace}`;
          }
        );
        
        // Title: "June 24: [AI-generated creative part]"
        // If AI generated a title starting with the date, use it. Otherwise prepend the date.
        let finalTitle = String(parsed.title || "").trim();
        const datePrefix = `${MONTHS[new Date().getMonth()]} ${new Date().getDate()}:`;
        if (!finalTitle.toLowerCase().startsWith(MONTHS[new Date().getMonth()].toLowerCase())) {
          finalTitle = `${datePrefix} ${finalTitle}`;
        }
        
        articleData = {
          title: finalTitle,
          subtitle: String(parsed.subtitle || "").trim(),
          content: processedContent,
          imageKeywords: Array.isArray(parsed.imageKeywords) ? parsed.imageKeywords : [],
        };
      }
    } catch (parseErr) {
      console.error("Failed to parse article JSON:", content, parseErr);
      return NextResponse.json({ success: false, error: "Failed to parse AI response" });
    }

    if (!articleData) {
      return NextResponse.json({ success: false, error: "AI did not return valid article data" });
    }

    // Generate cover image using AI - ALWAYS required for history articles
    let coverImage: string | undefined;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const dayNumber = now.getDate(); // 1-31
    const monthName = MONTHS[now.getMonth()]; // January, February, etc.
    
    // Extract event keywords from article content (h2 headings contain the main events)
    const h2Matches = articleData.content.match(/<h2[^>]*>([^<]+)<\/h2>/gi) || [];
    const eventKeywords = h2Matches
      .map(h2 => h2.replace(/<[^>]+>/g, '').trim())
      .filter(text => text.length > 3 && text.length < 100);
    
    console.log(`Event keywords for image: ${eventKeywords.join(', ')}`);
    
    // Try up to 3 times to generate an AI image
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`AI image generation attempt ${attempt}/3 for ${monthName} ${dayNumber}`);
      const imageUrl = await generateArticleImage(articleData.title, articleData.subtitle, baseUrl, dayNumber, monthName, eventKeywords);
      if (imageUrl) {
        coverImage = imageUrl;
        console.log(`AI image generated successfully on attempt ${attempt}`);
        break;
      }
      // Wait a bit before retrying
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // If AI image generation failed after all retries, fail the article creation
    if (!coverImage) {
      return NextResponse.json({ 
        success: false, 
        error: "Failed to generate AI cover image after 3 attempts. Article not created." 
      });
    }

    // Find or use a system author (first admin user)
    const User = (await import("@/models/User")).default;
    const systemUser = await User.findOne({ isAdmin: true }).select("_id").lean();
    const authorId = systemUser?._id?.toString() || null;

    // Create the article as published immediately
    const article = await Article.create({
      title: articleData.title,
      subtitle: articleData.subtitle,
      content: articleData.content,
      coverImage: coverImage,
      thumbnailUrl: coverImage,
      category: "history",
      mainCategory: "articles",
      status: "published",
      publishedAt: now,
      author: authorId,
      authorName: "BOGX Team",
      views: 0,
      likes: 0,
      commentsEnabled: true,
      tags: ["on-this-day", "history", "nostalgia", "auto-generated"],
      autoGenerated: true,
    });

    return NextResponse.json({
      success: true,
      message: "Daily facts article created",
      articleId: article._id,
      title: articleData.title,
      hasCoverImage: !!coverImage,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create daily facts article";
    console.error("daily-facts-article cron error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
