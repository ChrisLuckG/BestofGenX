import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import dbConnect from "@/lib/mongoose";
import DailyFact from "@/models/DailyFact";

// AI-generated daily welcome message with historical fact
// Cached in DB, regenerated annually per date

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

// Load central system prompt
function getSystemPrompt(): string {
  try {
    const promptPath = path.join(process.cwd(), "src", "prompts", "system-prompt.txt");
    return fs.readFileSync(promptPath, "utf-8");
  } catch {
    return "";
  }
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const now = new Date();
    const dateKey = getDateKey(now);
    const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";

    // 1. Try cache first - must have facts array with at least 3 items
    // Skip cache if force refresh
    if (!forceRefresh) {
      const cached = await DailyFact.findOne({ dateKey });
      if (cached?.welcome?.greeting && Array.isArray(cached.welcome.facts) && cached.welcome.facts.length >= 3) {
        return NextResponse.json({ success: true, welcome: cached.welcome, cached: true });
      }
    } else {
      // Delete old cache for force refresh
      await DailyFact.deleteOne({ dateKey });
    }

    // 2. Generate via OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: true, welcome: null, cached: false });
    }

    const openai = new OpenAI({ apiKey });
    const humanDate = `${MONTHS[now.getMonth()]} ${now.getDate()}`;
    const systemPrompt = getSystemPrompt();

    // User prompt triggers AUFGABE 3: WELCOME MESSAGE from central prompt
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Create welcome message for ${humanDate}` },
      ],
      temperature: 0.95,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content || "{}";
    let welcomeData: {
      greeting: string;
      subtitle: string;
      facts: string[];
      callToAction: string;
    } | null = null;

    try {
      const parsed = JSON.parse(content);
      // Handle new format with facts array
      const factsArray = Array.isArray(parsed.facts) 
        ? parsed.facts.map((f: unknown) => String(f).trim()).filter(Boolean)
        : parsed.fact 
          ? [String(parsed.fact).trim()] // Legacy fallback
          : [];
      
      if (parsed.greeting && factsArray.length > 0) {
        welcomeData = {
          greeting: String(parsed.greeting || "").trim(),
          subtitle: String(parsed.subtitle || "").trim(),
          facts: factsArray,
          callToAction: String(parsed.callToAction || "").trim(),
        };
      }
    } catch {
      welcomeData = null;
    }

    // 3. Cache (best-effort, ignore race conditions)
    if (welcomeData) {
      try {
        await DailyFact.findOneAndUpdate(
          { dateKey },
          { dateKey, welcome: welcomeData },
          { upsert: true, new: true }
        );
      } catch {
        // ignore duplicate-key races
      }
    }

    return NextResponse.json({ success: true, welcome: welcomeData, cached: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get daily facts";
    console.error("daily-facts error:", message);
    // Never break the welcome screen on error
    return NextResponse.json({ success: true, facts: [] });
  }
}
