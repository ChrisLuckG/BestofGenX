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

/**
 * Does the date the model wrote actually fall on the requested calendar day?
 *
 * The prompt has always carried an EXACT DATE RULE, but nothing checked it and the
 * value was stored verbatim, so an event three days either side of today was accepted
 * silently. Handles "September 8, 1978", "8 September 1978" and "1978-09-08".
 * Returns null when the string cannot be parsed - unparseable is treated as a failure,
 * not as a pass.
 */
function eventDateMatchesDay(
  dateStr: string | undefined,
  month0: number,
  day: number
): { ok: boolean; parsed: string | null } {
  if (!dateStr || typeof dateStr !== 'string') return { ok: false, parsed: null };

  const iso = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const m = parseInt(iso[2], 10) - 1;
    const d = parseInt(iso[3], 10);
    return { ok: m === month0 && d === day, parsed: `${iso[1]}-${iso[2]}-${iso[3]}` };
  }

  const monthNames = MONTHS.map(m => m.toLowerCase());
  const lower = dateStr.toLowerCase();
  const foundMonth = monthNames.findIndex(m => lower.includes(m));
  const dayMatch = lower.match(/\b(\d{1,2})\b(?!\d)/);
  if (foundMonth >= 0 && dayMatch) {
    const d = parseInt(dayMatch[1], 10);
    return { ok: foundMonth === month0 && d === day, parsed: `${MONTHS[foundMonth]} ${d}` };
  }

  return { ok: false, parsed: null };
}

/** Word overlap between the model's event and a pool entry, 0..1 of the pool tokens. */
function overlapWithPoolEntry(modelText: string, poolText: string): number {
  const strip = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9äöüßáéíóúàèìòùâêîôûñç\s]/g, ' ').split(/\s+/).filter(w => w.length > 3);
  const poolTokens = Array.from(new Set(strip(poolText)));
  if (poolTokens.length === 0) return 0;
  const modelTokens = new Set(strip(modelText));
  const hits = poolTokens.filter(t => modelTokens.has(t)).length;
  return hits / poolTokens.length;
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
    // allowWithoutVideo: deliver the event even when YouTube has nothing. The event
    // has already passed the pool and day-exactness gates at that point, so dropping
    // it only because no footage exists throws away a verified event - the caller can
    // attach a video by hand instead. Defaults to false to keep existing callers
    // (NewsroomConference) on their previous behaviour.
    const { reporterId, excludeEvents, allowWithoutVideo } = body as {
      reporterId: string;
      excludeEvents?: string[];
      allowWithoutVideo?: boolean;
    };

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

    // An empty pool must ABORT, not fall through.
    //
    // wikiEventsList used to become '' when nothing was found, while the prompt below
    // kept saying "You MUST choose from this list" - with no list. The model then
    // answered from memory and the route returned success:true, so an invented event
    // was indistinguishable from a sourced one. Same lesson as the Wikidata birthday
    // pool (see AGENTS.md): absence of information has to reach the caller as an error,
    // not as a quietly degraded result.
    if (wikipediaEvents.length === 0) {
      const reason = excludeEvents && excludeEvents.length > 0
        ? `All verified Wikipedia events for ${todayStr} are already covered.`
        : `Wikipedia has no verified GenX-era (1965-2005) events for ${todayStr}.`;
      console.log(`[history-event] Empty pool for ${todayStr} - refusing to generate`);
      return NextResponse.json({ success: false, error: reason, noPool: true });
    }

    // Build Wikipedia events list for prompt (with the language edition it came from
    // so reporters can see this is a worldwide pool, not just US news)
    const wikiEventsList = `\n\nHere are VERIFIED historical events from Wikipedia (${WIKI_LANGS.length} language editions) for ${todayStr}. You MUST choose from this list:\n${wikipediaEvents.map(e => `- ${e.year} [${e.source}]: ${e.text}`).join('\n')}`;

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

    // ── DAY-EXACTNESS GATE ────────────────────────────────────────────────────
    // Runs BEFORE the YouTube search, which costs quota and several seconds.
    //
    // Two independent checks, because either alone can be fooled:
    //  a) the event must actually be one from the pool. The pool is built from
    //     Wikipedia's feed for THIS month/day, so pool membership makes the date
    //     correct by construction - this is the check that really enforces "same day".
    //  b) the date string the model wrote must still resolve to today. Cheap, and it
    //     catches the case where the model picks a pool event but writes the wrong
    //     date next to it.
    const poolForYear = wikipediaEvents.filter(e => e.year === Number(eventData.year));
    if (poolForYear.length === 0) {
      const years = Array.from(new Set(wikipediaEvents.map(e => e.year))).sort().join(', ');
      console.log(`[history-event] REJECT "${eventData.title}" - year ${eventData.year} is not in the ${todayStr} pool (pool years: ${years})`);
      return NextResponse.json({
        success: false,
        error: `"${eventData.title}" (${eventData.year}) did not happen on ${todayStr}. The reporter went outside the verified list.`,
        offDate: true,
      });
    }

    const modelText = `${eventData.title} ${eventData.description}`;
    const bestOverlap = Math.max(...poolForYear.map(e => overlapWithPoolEntry(modelText, e.text)));
    // 0.15 of the pool entry's distinctive words. Deliberately low: the reporter
    // rewrites the entry in their own voice and translates it out of German/Russian/
    // Chinese, so a high threshold would reject legitimate rewrites. It still separates
    // "same event, retold" from "different event that happens to share a year".
    if (bestOverlap < 0.15) {
      console.log(`[history-event] REJECT "${eventData.title}" - best overlap with ${eventData.year} pool entries is ${bestOverlap.toFixed(2)}`);
      return NextResponse.json({
        success: false,
        error: `"${eventData.title}" does not match any verified Wikipedia event for ${todayStr}. Looks invented.`,
        offDate: true,
      });
    }

    const dateCheck = eventDateMatchesDay(eventData.date, now.getMonth(), day);
    if (!dateCheck.ok) {
      console.log(`[history-event] REJECT "${eventData.title}" - date "${eventData.date}" (parsed: ${dateCheck.parsed}) is not ${todayStr}`);
      return NextResponse.json({
        success: false,
        error: `"${eventData.title}" was dated ${eventData.date || 'nothing'}, which is not ${todayStr}.`,
        offDate: true,
      });
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
    
    // No video found. Unless the caller opted in, the event is rejected.
    if (!videoId && !allowWithoutVideo) {
      console.log(`No video found for event "${eventData.title}" after all attempts - rejecting`);
      return NextResponse.json({ 
        success: false, 
        error: `No video found for "${eventData.title}". Reporter must find an event with available video footage.`,
        noVideo: true
      });
    }
    if (!videoId) {
      console.log(`No video found for event "${eventData.title}" - delivering without video`);
    }

    const event: HistoryEvent = {
      title: eventData.title,
      year: eventData.year,
      // Canonical, never the model's string: it has been verified to mean today, so
      // there is no reason to keep whatever formatting it arrived in.
      date: `${todayStr}, ${eventData.year}`,
      description: eventData.description,
      category: eventData.category || "culture",
      youtubeSearch: eventData.youtubeSearch || eventData.title,
      // `undefined` rather than `null`: the field is optional, and the UI checks for
      // a truthy id to decide between the thumbnail and the paste-a-link input.
      youtubeVideoId: videoId || undefined,
      reporterId,
      reporterName,
    };

    return NextResponse.json({
      success: true,
      event,
      // Lets the UI tell "searched, found nothing" apart from "not searched yet",
      // so it can offer to attach a video by hand.
      noVideo: !videoId,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate history event";
    console.error("history-event error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
