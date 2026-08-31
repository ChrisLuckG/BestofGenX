import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import dbConnect from "@/lib/mongoose";
import ReporterProfile from "@/models/ReporterProfile";
import User from "@/models/User";
import { searchYouTubeVideo, PREFER_LONG } from "@/lib/youtubeSearch";

// Generate a single "On This Day" event proposal from a reporter
// Each reporter finds ONE historical event that happened on today's date
// Uses Wikipedia "On This Day" as factual source

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Language editions to query. English alone is heavily US/Anglo-centric, which is
// why the newsroom kept producing American-only history. Each edition surfaces its
// own regional events.
// These 13 are the COMPLETE set supported by the Wikimedia "onthisday" feed API -
// every other language code (ja, pl, nl, ko, ...) returns HTTP 404.
const WIKI_LANGS: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'International' },
  { code: 'de', label: 'German-speaking' },
  { code: 'fr', label: 'French-speaking' },
  { code: 'es', label: 'Spanish-speaking' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese/Brazilian' },
  { code: 'ru', label: 'Russian' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'tr', label: 'Turkish' },
  { code: 'sv', label: 'Swedish/Nordic' },
  { code: 'cs', label: 'Czech' },
];

// Fetch real "On This Day" events from Wikipedia across several language editions
async function fetchWikipediaOnThisDay(): Promise<Array<{ year: number; text: string; source: string }>> {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const perLang = await Promise.all(
    WIKI_LANGS.map(async ({ code, label }) => {
      try {
        const response = await fetch(
          `https://api.wikimedia.org/feed/v1/wikipedia/${code}/onthisday/events/${month}/${day}`,
          { headers: { 'User-Agent': 'BOGX-Newsroom/1.0 (contact@bogx.com)' } }
        );
        if (!response.ok) {
          console.error(`Wikipedia API error (${code}):`, response.status);
          return [];
        }
        const data = await response.json();
        // Filter events from 1965-2005 (GenX era)
        return (data.events || [])
          .filter((e: any) => e.year >= 1965 && e.year <= 2005)
          .map((e: any) => ({ year: e.year, text: e.text as string, source: label }));
      } catch (err) {
        console.error(`Failed to fetch Wikipedia events (${code}):`, err);
        return [];
      }
    })
  );

  // Merge + dedupe: the same event is often listed in several editions
  const seen = new Set<string>();
  const merged: Array<{ year: number; text: string; source: string }> = [];
  for (const list of perLang) {
    for (const e of list) {
      const key = `${e.year}|${e.text.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(e);
    }
  }
  return merged;
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

// Search YouTube for a relevant video.
// History events want documentaries and archive footage, so the shared helper is
// used with its long-then-medium preference. This endpoint previously ran an
// unfiltered search and kept result #1, which is why events ended up with short
// clips instead of proper footage.
async function searchYouTube(query: string, year?: number, context?: string): Promise<string | null> {
  const hit = await searchYouTubeVideo({
    query,
    year,
    context,
    tiers: PREFER_LONG,
    extraQueries: [`${query} ${year || ''} history`.trim()],
  });
  return hit?.videoId || null;
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

    // Build Wikipedia events list for prompt (with the language edition it came from
    // so reporters can see this is a worldwide pool, not just US news)
    const wikiEventsList = wikipediaEvents.length > 0
      ? `\n\nHere are VERIFIED historical events from Wikipedia (${WIKI_LANGS.length} language editions) for ${todayStr}. You MUST choose from this list:\n${wikipediaEvents.map(e => `- ${e.year} [${e.source}]: ${e.text}`).join('\n')}`
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

⚠️ EXACT DATE RULE:
- The event must have happened on ${todayStr} itself. Never shift a date to make it fit.
- MULTI-DAY EVENTS (festivals, tournaments, wars, summits, space missions): only allowed if
  ${todayStr} is the documented START date. Do NOT pick an event just because ${todayStr} falls
  somewhere inside its span, and never re-tell an event on its 2nd/3rd day.
  Example: Woodstock ran 15-18 August 1969 - it belongs to 15 August ONLY.
- "date" in your JSON must be the real documented date of the event.

🌍 GLOBAL COVERAGE:
- The list contains events from several language editions - the tag in [brackets] shows the origin.
- Do NOT default to US/American events. Prefer an event from your own region (${nationality || region})
  or another non-US country when the list offers one.
- Source entries are written in their own language (German, Russian, Chinese, Arabic, ...).
  ALWAYS write your title and description in ENGLISH, no matter which language the source entry uses.
  Translate names and places to their common English form (e.g. "Jahrhunderthochwasser" -> "the
  once-in-a-century Elbe flood").

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

    // Search for a YouTube video - pass year for better results.
    // The event's own title and description are the relevance context: every
    // fallback query below is looser than the last, and without that anchor a
    // broad query happily returns a video about something else entirely.
    const videoContext = [eventData.title, eventData.description].filter(Boolean).join(' ');
    let videoId = await searchYouTube(eventData.youtubeSearch || eventData.title, eventData.year, videoContext);
    
    // If no video found, try alternative searches
    if (!videoId) {
      console.log(`No video found for "${eventData.youtubeSearch}", trying alternatives...`);
      // Try with just the title
      videoId = await searchYouTube(eventData.title, eventData.year, videoContext);
    }
    if (!videoId) {
      // Try with title + "documentary"
      videoId = await searchYouTube(`${eventData.title} documentary`, eventData.year, videoContext);
    }
    if (!videoId) {
      // Try with title + category
      videoId = await searchYouTube(`${eventData.title} ${eventData.category}`, eventData.year, videoContext);
    }
    
    // REQUIRE a video - reject events without video
    if (!videoId) {
      console.log(`No video found for event "${eventData.title}" after all attempts - rejecting`);
      return NextResponse.json({ 
        success: false, 
        error: `No video found for "${eventData.title}". Reporter must find an event with available video footage.`,
        noVideo: true
      });
    }

    const event: HistoryEvent = {
      title: eventData.title,
      year: eventData.year,
      date: eventData.date || `${todayStr}, ${eventData.year}`,
      description: eventData.description,
      category: eventData.category || "culture",
      youtubeSearch: eventData.youtubeSearch || eventData.title,
      youtubeVideoId: videoId,
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
