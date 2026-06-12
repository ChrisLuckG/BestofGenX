import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import dbConnect from "@/lib/mongoose";
import DailyFact from "@/models/DailyFact";
import Article from "@/models/Article";

// Cron job to generate daily "On This Day" article
// Runs at 9:00 AM, creates article scheduled for 10:00 AM

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getSystemPrompt(): string {
  try {
    const promptPath = path.join(process.cwd(), "src", "prompts", "system-prompt.txt");
    return fs.readFileSync(promptPath, "utf-8");
  } catch {
    return "";
  }
}

// Generate image using the existing /api/generate-image endpoint
async function generateArticleImage(title: string, subtitle: string, baseUrl: string, dayNumber: number): Promise<string | null> {
  try {
    const prompt = `Nostalgic 80s 90s retro calendar page design. Large bold number "${dayNumber}" prominently displayed in the center. Vintage paper texture, retro typography, warm nostalgic colors. The number ${dayNumber} should be the main focus, like a vintage wall calendar. Gen X aesthetic, cinematic lighting.`;
    
    const response = await fetch(`${baseUrl}/api/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, style: 'article' }),
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
      title: { $regex: `On This Day.*${MONTHS[now.getMonth()]} ${now.getDate()}`, $options: "i" },
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
        // Add video blocks after each section (after </p> that follows an <h2>)
        let processedContent = String(parsed.content).trim();
        // Insert video embed block after each paragraph that follows an h2
        // Pattern: </p> followed by either <h2> or end
        processedContent = processedContent.replace(
          /(<\/p>)(\s*)(<h2>|$)/gi,
          '$1$2<div data-type="video" data-url=""></div>$2$3'
        );
        // Also add one at the very end if not already there
        if (!processedContent.endsWith('data-url=""></div>')) {
          processedContent += '<div data-type="video" data-url=""></div>';
        }
        
        articleData = {
          title: String(parsed.title).trim(),
          subtitle: String(parsed.subtitle || "").trim(),
          content: processedContent,
          imageKeywords: Array.isArray(parsed.imageKeywords) ? parsed.imageKeywords : [],
        };
      }
    } catch {
      console.error("Failed to parse article JSON:", content);
      return NextResponse.json({ success: false, error: "Failed to parse AI response" });
    }

    if (!articleData) {
      return NextResponse.json({ success: false, error: "AI did not return valid article data" });
    }

    // Generate cover image using the same API as the admin panel
    let coverImage: string | undefined;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    if (articleData.title) {
      const dayNumber = now.getDate(); // 1-31
      const imageUrl = await generateArticleImage(articleData.title, articleData.subtitle, baseUrl, dayNumber);
      if (imageUrl) {
        coverImage = imageUrl;
      }
    }

    // Calculate scheduled time: 10:00 AM today (Berlin time)
    const scheduledAt = new Date();
    scheduledAt.setHours(10, 0, 0, 0);

    // If it's already past 10:00, schedule for tomorrow
    if (now.getHours() >= 10) {
      scheduledAt.setDate(scheduledAt.getDate() + 1);
    }

    // Find or use a system author (first admin user)
    const User = (await import("@/models/User")).default;
    const systemUser = await User.findOne({ isAdmin: true }).select("_id").lean();
    const authorId = systemUser?._id?.toString() || null;

    // Create the article as draft with scheduled time
    const article = await Article.create({
      title: articleData.title,
      subtitle: articleData.subtitle,
      content: articleData.content,
      coverImage: coverImage,
      thumbnailUrl: coverImage,
      category: "culture",
      status: "draft",
      scheduledAt: scheduledAt,
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
      scheduledAt: scheduledAt.toISOString(),
      hasCoverImage: !!coverImage,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create daily facts article";
    console.error("daily-facts-article cron error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
