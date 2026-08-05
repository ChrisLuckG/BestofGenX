import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import dbConnect from "@/lib/mongoose";
import ReporterProfile from "@/models/ReporterProfile";
import User from "@/models/User";

// Generate a single "On This Day" event proposal from a reporter
// Each reporter finds ONE historical event that happened on today's date
// Uses Wikipedia "On This Day" as factual source

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Fetch real "On This Day" events from Wikipedia
async function fetchWikipediaOnThisDay(): Promise<Array<{ year: number; text: string }>> {
  try {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // Wikipedia "On This Day" API
    const response = await fetch(
      `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/${month}/${day}`,
      {
        headers: {
          'User-Agent': 'BOGX-Newsroom/1.0 (contact@bogx.com)',
        },
      }
    );
    
    if (!response.ok) {
      console.error("Wikipedia API error:", response.status);
      return [];
    }
    
    const data = await response.json();
    
    // Filter events from 1965-2005 (GenX era)
    const events = (data.events || [])
      .filter((e: any) => e.year >= 1965 && e.year <= 2005)
      .map((e: any) => ({
        year: e.year,
        text: e.text,
      }));
    
    return events;
  } catch (err) {
    console.error("Failed to fetch Wikipedia events:", err);
    return [];
  }
}

interface HistoryEvent {
  title: string;           // e.g. "Live Aid Concert"
  year: number;            // e.g. 1985
  date: string;            // e.g. "July 13, 1985"
  description: string;     // 2-3 sentences about the event
  category: string;        // music, sports, movies-tv, tech, politics, culture
  youtubeSearch: string;   // Search term to find a relevant video
  youtubeVideoId?: string; // If we found a video
  reporterId: string;
  reporterName: string;
}

// Search YouTube for a relevant video - tries multiple search strategies
async function searchYouTube(query: string, year?: number): Promise<string | null> {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.log("No YouTube API key configured");
      return null;
    }
    
    // Try multiple search queries to find a relevant video
    const searchQueries = [
      `${query} ${year || ''} documentary`,
      `${query} ${year || ''} history`,
      `${query} original footage`,
      query,
    ];
    
    for (const q of searchQueries) {
      const searchQuery = encodeURIComponent(q.trim());
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&maxResults=3&key=${apiKey}`
      );
      
      if (!response.ok) {
        console.error("YouTube API error:", response.status);
        continue;
      }
      
      const data = await response.json();
      const videoId = data.items?.[0]?.id?.videoId;
      
      if (videoId) {
        console.log(`Found YouTube video for "${q}": ${videoId}`);
        return videoId;
      }
    }
    
    console.log(`No YouTube video found for: ${query}`);
    return null;
  } catch (err) {
    console.error("YouTube search failed:", err);
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
    const { reporterId, excludeEvents } = body as { reporterId: string; excludeEvents?: string[] };

    await dbConnect();

    // Get reporter profile
    const profile = await ReporterProfile.findOne({ userId: reporterId }).lean();
    const user = await User.findById(reporterId).select("displayName username avatar").lean();
    
    if (!profile || !user) {
      return NextResponse.json({ success: false, error: "Reporter not found" });
    }

    const reporterName = (user as any).displayName || (user as any).username || "Reporter";
    const specialty = (profile as any).specialty || "general history";
    const region = (profile as any).region || "global";
    const writingStyle = (profile as any).writingStyle || "";
    const personality = (profile as any).personality || "";
    const nationality = (profile as any).nationality || "";

    // Get today's date
    const now = new Date();
    const month = MONTHS[now.getMonth()];
    const day = now.getDate();
    const todayStr = `${month} ${day}`;

    const openai = new OpenAI({ apiKey });

    // Fetch REAL events from Wikipedia
    let wikipediaEvents = await fetchWikipediaOnThisDay();
    console.log(`Found ${wikipediaEvents.length} Wikipedia events for ${todayStr}`);

    // FILTER OUT already covered events from the Wikipedia list
    if (excludeEvents && excludeEvents.length > 0) {
      const excludeLower = excludeEvents.map(e => e.toLowerCase());
      wikipediaEvents = wikipediaEvents.filter(wikiEvent => {
        // Check if any excluded event title appears in this Wikipedia event text
        const wikiTextLower = wikiEvent.text.toLowerCase();
        return !excludeLower.some(excluded => 
          wikiTextLower.includes(excluded.split(':')[0].trim().toLowerCase()) ||
          excluded.toLowerCase().includes(wikiTextLower.slice(0, 30).toLowerCase())
        );
      });
      console.log(`After filtering exclusions: ${wikipediaEvents.length} events remaining`);
    }

    // Build exclusion warning for prompt
    const exclusionNote = excludeEvents && excludeEvents.length > 0
      ? `\n\n⚠️ CRITICAL: Your colleagues have ALREADY written about these topics. You MUST NOT choose any of these:\n${excludeEvents.map(e => `❌ ${e}`).join('\n')}\n\nChoose something COMPLETELY DIFFERENT from the list above.`
      : '';

    // Build Wikipedia events list for prompt
    const wikiEventsList = wikipediaEvents.length > 0
      ? `\n\nHere are VERIFIED historical events from Wikipedia for ${todayStr}. You MUST choose from this list:\n${wikipediaEvents.map(e => `- ${e.year}: ${e.text}`).join('\n')}`
      : '';

    // Build prompt based on reporter's personality and writing style
    const systemPrompt = `You are ${reporterName}, a journalist from ${nationality || region}.
${writingStyle ? `Your writing style: ${writingStyle}` : ''}
${personality ? `Your personality: ${personality}` : ''}
Your specialty: ${specialty}

Your task is to select ONE historical event from the verified Wikipedia list below and write about it in YOUR unique voice.
${wikiEventsList}
${exclusionNote}

REQUIREMENTS:
- You MUST select an event from the Wikipedia list above (these are verified facts)
- Choose an event that matches your specialty (${specialty}) if possible
- If no events match your specialty, pick one that would interest Generation X
- Write the description in YOUR unique voice - be opinionated, colorful, personal

Respond with a JSON object:
{
  "title": "Short event title based on the Wikipedia entry",
  "year": 1985,
  "date": "${todayStr}, 1985",
  "description": "2-3 sentences describing the REAL event IN YOUR UNIQUE VOICE.",
  "category": "music|sports|movies-tv|tech|politics|culture",
  "youtubeSearch": "search term to find a video about this event"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Select one event from the Wikipedia list and write about it in your unique voice. Choose something that fits your specialty or would interest GenX.` },
      ],
      temperature: 0.3, // Low temperature for factual accuracy
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content || "{}";
    let eventData: any;

    try {
      eventData = JSON.parse(content);
    } catch (parseErr) {
      console.error("Failed to parse event JSON:", content);
      return NextResponse.json({ success: false, error: "Failed to parse AI response" });
    }

    if (!eventData.title || !eventData.year || !eventData.description) {
      return NextResponse.json({ success: false, error: "AI returned incomplete event data" });
    }

    // Search for a YouTube video - pass year for better results
    const videoId = await searchYouTube(eventData.youtubeSearch || eventData.title, eventData.year);

    const event: HistoryEvent = {
      title: eventData.title,
      year: eventData.year,
      date: eventData.date || `${todayStr}, ${eventData.year}`,
      description: eventData.description,
      category: eventData.category || "culture",
      youtubeSearch: eventData.youtubeSearch || eventData.title,
      youtubeVideoId: videoId || undefined,
      reporterId,
      reporterName,
    };

    return NextResponse.json({
      success: true,
      event,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate history event";
    console.error("history-event error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
