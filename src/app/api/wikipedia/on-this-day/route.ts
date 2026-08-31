import { NextRequest, NextResponse } from "next/server";
import { EVENT_ERA } from "@/lib/releaseCategory";

export const dynamic = "force-dynamic";

interface WikiEvent {
  year: number;
  text: string;
  pages?: Array<{
    title: string;
    extract?: string;
  }>;
}

interface WikiResponse {
  selected?: WikiEvent[];
  events?: WikiEvent[];
  births?: WikiEvent[];
  deaths?: WikiEvent[];
}

// Every language edition curates its OWN "on this day" list - these are not
// translations of each other. Querying English only produced a US/Anglo-centric
// newsroom. This is the COMPLETE set supported by the feed API; any other code 404s.
const WIKI_LANGS: Array<{ code: string; label: string }> = [
  { code: "en", label: "International" },
  { code: "de", label: "German-speaking" },
  { code: "fr", label: "French-speaking" },
  { code: "es", label: "Spanish-speaking" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese/Brazilian" },
  { code: "ru", label: "Russian" },
  { code: "uk", label: "Ukrainian" },
  { code: "zh", label: "Chinese" },
  { code: "ar", label: "Arabic" },
  { code: "tr", label: "Turkish" },
  { code: "sv", label: "Swedish/Nordic" },
  { code: "cs", label: "Czech" },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "events"; // events, births, deaths, selected
    
    // Get today's date
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    
    // Wikipedia On This Day API - queried across all supported language editions
    // https://api.wikimedia.org/wiki/API_reference/Feed/On_this_day
    const perLang = await Promise.all(
      WIKI_LANGS.map(async ({ code, label }) => {
        try {
          const response = await fetch(
            `https://api.wikimedia.org/feed/v1/wikipedia/${code}/onthisday/${type}/${month}/${day}`,
            {
              headers: {
                "User-Agent": "BestOfGenX/1.0 (https://bestofgenx.com; contact@bestofgenx.com)",
                "Accept": "application/json",
              },
              next: { revalidate: 3600 }, // Cache for 1 hour
            }
          );
          if (!response.ok) {
            console.error(`Wikipedia API error (${code}):`, response.status);
            return [];
          }
          const data: WikiResponse = await response.json();

          // Events use the GenX lifespan window (EVENT_ERA), births the GenX birth
          // years (1965-1980) - two different windows that happen to share a start.
          let list: WikiEvent[] = [];
          if (type === "births") {
            list = (data.births || []).filter(e => e.year >= 1965 && e.year <= 1980);
          } else if (type === "deaths") {
            list = (data.deaths || []).filter(e => e.year >= 1980 && e.year <= 2026);
          } else if (type === "selected") {
            list = (data.selected || []).filter(e => e.year >= EVENT_ERA.start && e.year <= EVENT_ERA.end);
          } else {
            list = (data.events || []).filter(e => e.year >= EVENT_ERA.start && e.year <= EVENT_ERA.end);
          }
          return list.map(e => ({ ...e, source: label }));
        } catch (err) {
          console.error(`Failed to fetch Wikipedia (${code}):`, err);
          return [];
        }
      })
    );

    // Merge + dedupe: prominent events appear in several editions
    const seen = new Set<string>();
    const formatted: Array<{
      year: number;
      date: string;
      text: string;
      title: string | null;
      extract: string | null;
      source: string;
    }> = [];
    for (const list of perLang) {
      for (const e of list) {
        const key = `${e.year}|${(e.pages?.[0]?.title || e.text).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        formatted.push({
          year: e.year,
          date: `${day}.${month}.${e.year}`,
          text: e.text,
          title: e.pages?.[0]?.title || null,
          extract: e.pages?.[0]?.extract || null,
          source: e.source,
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      date: `${day}.${month}`,
      type,
      count: formatted.length,
      events: formatted,
    });
  } catch (error) {
    console.error("Wikipedia On This Day error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
