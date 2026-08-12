import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import ReporterProfile from '@/models/ReporterProfile';
import EditorialConversation from '@/models/EditorialConversation';
import Article from '@/models/Article';
import { generateReporterSystemPrompt } from '@/lib/generateReporterPrompt';
import { VALID_CATEGORY_SLUGS } from '@/lib/categories';
import { combinePrompts } from '@/lib/loadPrompt';
import { fetchWikidataBirthdays, formatBirthdayContext, hasWikidataCategory } from '@/lib/wikidataBirthdays';
import { saveMenschen, getMenschenCoverage, markMenschCovered } from '@/lib/menschenDb';

// Increase timeout for article generation (Wikidata + OpenAI + YouTube can take time)
export const maxDuration = 60;

// Load modular prompts: core + article rules for reporters
function loadBogxSystemPrompt(): string {
  return combinePrompts(['core.txt', 'article-prompt.txt']);
}

// Daily in-memory caches — these Wikipedia sources only change once per day, so we avoid
// re-downloading them on every chat message (major latency win).
let _liveCtxCache: { key: string; value: string } | null = null; // Cache cleared on code change
let _deathsCache: { key: string; value: string } | null = null;
let _wikidataDeathsCache: { key: string; value: string } | null = null;

// Fetch GenX deaths from Wikidata SPARQL (more complete than Wikipedia "On This Day")
async function fetchWikidataDeaths(month: number, day: number): Promise<string> {
  const cacheKey = `wikidata-deaths-${month}-${day}`;
  if (_wikidataDeathsCache?.key === cacheKey) return _wikidataDeathsCache.value;
  
  try {
    const query = `
SELECT ?person ?personLabel ?birthDate ?deathDate ?occupationLabel ?countryLabel WHERE {
  ?person wdt:P31 wd:Q5;
          wdt:P569 ?birthDate;
          wdt:P570 ?deathDate.
  OPTIONAL { ?person wdt:P106 ?occupation. }
  OPTIONAL { ?person wdt:P27 ?country. }
  FILTER(MONTH(?deathDate) = ${month} && DAY(?deathDate) = ${day})
  FILTER(YEAR(?birthDate) >= 1965 && YEAR(?birthDate) <= 1980)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 50
`;
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BOGX-Editorial/1.0', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    
    if (!res.ok) return '';
    const data = await res.json();
    
    const results = data.results?.bindings || [];
    if (results.length === 0) return '';
    
    // Deduplicate by person (Wikidata can return multiple rows per person for multiple occupations)
    const seen = new Set<string>();
    const deaths: string[] = [];
    
    for (const r of results) {
      const name = r.personLabel?.value;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      
      const birthYear = r.birthDate?.value?.substring(0, 4) || '?';
      const deathYear = r.deathDate?.value?.substring(0, 4) || '?';
      const occupation = r.occupationLabel?.value || 'person';
      const country = r.countryLabel?.value || '';
      
      deaths.push(`  - ${name}, ${occupation}${country ? ` (${country})` : ''} — born ${birthYear}, died ${deathYear}`);
    }
    
    const value = deaths.length > 0 
      ? `\nGENX DEATHS ON THIS DAY (from Wikidata - born 1965-1980):\n${deaths.join('\n')}\n`
      : '';
    
    if (value) _wikidataDeathsCache = { key: cacheKey, value };
    return value;
  } catch (err) {
    console.error('Wikidata fetch failed:', err);
    return ''; // Fail silently
  }
}

async function fetchLiveContext(month: number, day: number): Promise<string> {
  const cacheKey = `genxALL-${month}-${day}`; // Changed key to force cache refresh (ALL births now)
  if (_liveCtxCache?.key === cacheKey) return _liveCtxCache.value;
  try {
    // Wikipedia API REQUIRES zero-padded month and day (e.g. 08/03, NOT 8/3)
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${mm}/${dd}`,
      { headers: { 'User-Agent': 'BOGX-Editorial/1.0' }, signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return '';
    const data = await res.json();

    const lines: string[] = [];

    // Notable births today (filter for GenX ONLY: born 1965-1980)
    // Get ALL GenX births - Wikipedia has hundreds per day!
    const allGenXBirths = (data.births || [])
      .filter((b: any) => b.year >= 1965 && b.year <= 1980);
    
    // Categorize births for better filtering
    const categoryPatterns: Record<string, RegExp> = {
      'sports': /\b(football|basketball|baseball|hockey|soccer|tennis|golf|boxer|wrestler|athlete|swimmer|cyclist|racer|player|coach|gymnast|skier|MMA|UFC)\b/i,
      'music': /\b(singer|musician|rapper|DJ|guitarist|drummer|bassist|songwriter|composer|pianist|violinist|conductor)\b/i,
      'movies-tv': /\b(actor|actress|director|producer|screenwriter|filmmaker|television|TV|comedian|host|presenter|model)\b/i,
      'politics': /\b(politician|senator|governor|president|minister|mayor|diplomat|activist|political)\b/i,
      'gaming': /\b(game designer|video game|esports|streamer)\b/i,
      'authors': /\b(author|writer|novelist|poet|journalist)\b/i,
    };
    
    // Count by category
    const categoryCounts: Record<string, number> = {};
    for (const birth of allGenXBirths) {
      const text = birth.text || '';
      for (const [cat, pattern] of Object.entries(categoryPatterns)) {
        if (pattern.test(text)) {
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
          break;
        }
      }
    }
    
    const births = allGenXBirths
      .map((b: any) => `  - ${b.text?.split('.')[0]} (born ${b.year})`);
    
    // Add category summary
    const categoryInfo = Object.entries(categoryCounts)
      .map(([cat, count]) => `${cat}: ${count}`)
      .join(', ');
    
    if (births.length) {
      lines.push(`BIRTHDAYS TODAY (GenX relevant) - Total: ${births.length}\nCategories available: ${categoryInfo || 'mixed'}\n${births.join('\n')}`);
    }

    // Deaths today - filter for GenX (born 1965-1980) and recent deaths (2010+)
    // Wikipedia deaths API gives death year, and description often contains birth year
    const allDeaths = (data.deaths || []);
    const recentDeaths = allDeaths
      .filter((d: any) => d.year >= 2010) // Recent deaths only
      .slice(0, 20) // Take more for GenX filtering
      .map((d: any) => {
        const text = d.text || '';
        // Try to extract birth year from "born YYYY" pattern
        const bornMatch = text.match(/born\s+(\d{4})/i);
        const birthYear = bornMatch ? parseInt(bornMatch[1]) : null;
        const isGenX = birthYear && birthYear >= 1965 && birthYear <= 1980;
        return {
          text: text.split('.')[0],
          deathYear: d.year,
          birthYear,
          isGenX,
        };
      });
    
    // Separate GenX and other notable deaths
    const genxDeaths = recentDeaths.filter((d: { text: string; deathYear: number; birthYear: number | null; isGenX: boolean }) => d.isGenX);
    const otherDeaths = recentDeaths.filter((d: { text: string; deathYear: number; birthYear: number | null; isGenX: boolean }) => !d.isGenX).slice(0, 5);
    
    if (genxDeaths.length) {
      lines.push(`GENX DEATHS ON THIS DAY (born 1965-1980) - PRIORITY FOR RIP ARTICLES:\n${genxDeaths.map((d: { text: string; deathYear: number; birthYear: number | null; isGenX: boolean }) => `  - ${d.text} (died ${d.deathYear}, born ${d.birthYear})`).join('\n')}`);
    }
    if (otherDeaths.length) {
      lines.push(`OTHER NOTABLE DEATHS ON THIS DAY:\n${otherDeaths.map((d: { text: string; deathYear: number; birthYear: number | null; isGenX: boolean }) => `  - ${d.text} (${d.deathYear})`).join('\n')}`);
    }

    // Notable events
    const events = (data.events || [])
      .filter((e: any) => e.year >= 1960 && e.year <= 2010)
      .slice(0, 5)
      .map((e: any) => `  - ${e.year}: ${e.text?.split('.')[0]}`);
    if (events.length) lines.push(`NOTABLE EVENTS ON THIS DAY:\n${events.join('\n')}`);

    const value = lines.length ? `\n================================================================================\nLIVE CONTEXT — TODAY IN HISTORY (use this for article ideas and accurate reporting)\n================================================================================\n${lines.join('\n\n')}\n` : '';
    if (value) _liveCtxCache = { key: cacheKey, value };
    return value;
  } catch {
    return ''; // Fail silently — don't block chat
  }
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// These are APPROVAL keywords only — reporter must have proposed first
// Broad topic words ("write", "article") no longer trigger creation
const APPROVAL_KEYWORDS = [
  'go ahead', 'go for it', 'create it', 'create the article', 'create the draft',
  'draft it', 'draft the article', 'write it now', 'write it', 'write the article',
  'approved', 'approval', 'yes create', 'yes draft', 'yes write',
  'mach es', 'erstell es', 'schreib es', 'mach das', 'ja mach',
  'do it', 'proceed', 'make it', 'publish it', 'save it',
];
// Short standalone approval words (whole message must be just this)
const STANDALONE_APPROVALS = ['go', 'yes', 'ja', 'ok', 'okay', 'yep', 'sure', 'deal', 'perfect', 'great'];

function isArticleApproval(message: string): boolean {
  const lower = message.trim().toLowerCase();
  // Exact standalone approval
  if (STANDALONE_APPROVALS.includes(lower)) return true;
  // Contains explicit approval phrase
  return APPROVAL_KEYWORDS.some(kw => lower.includes(kw));
}

// CTA HTML blocks (mirrors BlockEditor.tsx constants)
const CTA_HTML: Record<string, string> = {
  radio: `<div class="cta-block radio-cta-banner" data-cta-type="radio" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(212,135,58,0.15),rgba(212,135,58,0.05));border-radius:16px;border:1px solid rgba(212,135,58,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#E36B11;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="🎧"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Listen on GenX Radio</div><div style="font-size:12px;color:#666;line-height:1.4;">Discover more timeless tracks on our radio.</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#E36B11;color:white;border-radius:10px;font-weight:700;font-size:13px;">Go to Radio →</span></div>`,
  arcade: `<div class="cta-block arcade-cta-banner" data-cta-type="arcade" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(139,92,246,0.15),rgba(139,92,246,0.05));border-radius:16px;border:1px solid rgba(139,92,246,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#8B5CF6;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="🎮"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Play Trivia</div><div style="font-size:12px;color:#666;line-height:1.4;">Test your 80s/90s knowledge and win BOGX!</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#8B5CF6;color:white;border-radius:10px;font-weight:700;font-size:13px;">Go to Trivia →</span></div>`,
  shop: `<div class="cta-block shop-cta-banner" data-cta-type="shop" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(236,72,153,0.15),rgba(236,72,153,0.05));border-radius:16px;border:1px solid rgba(236,72,153,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#EC4899;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="🛍️"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Visit the Shop</div><div style="font-size:12px;color:#666;line-height:1.4;">Get exclusive GenX merch and collectibles.</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#EC4899;color:white;border-radius:10px;font-weight:700;font-size:13px;">Go to Shop →</span></div>`,
  articles: `<div class="cta-block articles-cta-banner" data-cta-type="articles" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(34,197,94,0.15),rgba(34,197,94,0.05));border-radius:16px;border:1px solid rgba(34,197,94,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#22C55E;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="📰"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">More Articles</div><div style="font-size:12px;color:#666;line-height:1.4;">Discover more stories from the GenX era.</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#22C55E;color:white;border-radius:10px;font-weight:700;font-size:13px;">Browse Articles →</span></div>`,
  tv: `<div class="cta-block tv-cta-banner" data-cta-type="tv" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(59,130,246,0.15),rgba(59,130,246,0.05));border-radius:16px;border:1px solid rgba(59,130,246,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#3B82F6;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="📺"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Watch GenX TV</div><div style="font-size:12px;color:#666;line-height:1.4;">Classic videos and nostalgic content.</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#3B82F6;color:white;border-radius:10px;font-weight:700;font-size:13px;">Go to TV →</span></div>`,
  rankroll: `<div class="cta-block rankroll-cta-banner" data-cta-type="rankroll" data-rankroll-id="" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(212,135,58,0.15),rgba(212,135,58,0.05));border-radius:16px;border:1px solid rgba(212,135,58,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#E36B11;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="🗳️"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M18 13h-.68l-2 2h1.91L19 17H5l1.78-2h2.05l-2-2H6l-3 3v4c0 1.1.89 2 1.99 2H19c1.1 0 2-.89 2-2v-4l-3-3zm-1-5.05l-4.95 4.95-3.54-3.54 4.95-4.95 3.54 3.54zm-4.24-5.66L6.39 8.66a.996.996 0 000 1.41l4.95 4.95c.39.39 1.02.39 1.41 0l6.36-6.36a.996.996 0 000-1.41l-4.95-4.95a.996.996 0 00-1.41 0z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Vote Now!</div><div style="font-size:12px;color:#666;line-height:1.4;">Cast your vote and rank your favorites.</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#E36B11;color:white;border-radius:10px;font-weight:700;font-size:13px;">Go to Rankroll →</span></div>`,
};

// Search YouTube Data API for a real video ID
// preferLong: true = filter for videos >20min (documentaries)
async function findYoutubeVideoId(searchTerm: string, preferLong: boolean = false): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  console.log('[YouTube] Searching for:', searchTerm, '| preferLong:', preferLong, '| API Key exists:', !!apiKey);
  
  if (!apiKey) {
    console.warn('[YouTube] YOUTUBE_API_KEY not set, skipping video search');
    return null;
  }
  
  try {
    // Ask for several candidates instead of blindly trusting rank #1 — YouTube's
    // top hit for a person + film is often a talk-show or paparazzi clip that has
    // nothing to do with the passage the video sits next to.
    //
    // For history articles we want documentaries. `videoDuration` takes a single
    // value, so "long or medium" needs one request per tier. Previously only
    // `long` (>20min) was tried and a miss meant NO video at all - many single
    // events simply have no 20-minute upload, only a solid 8-minute report.
    // Medium (4-20min) is the fallback; `short` is never requested.
    const attempts: Array<{ term: string; duration: string }> = preferLong
      ? [
          { term: `${searchTerm} documentary`, duration: '&videoDuration=long' },
          { term: `${searchTerm} documentary`, duration: '&videoDuration=medium' },
          { term: searchTerm, duration: '&videoDuration=medium' },
        ]
      : [{ term: searchTerm, duration: '' }];

    for (const attempt of attempts) {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(attempt.term)}&type=video&maxResults=8${attempt.duration}&key=${apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('[YouTube] API error:', res.status, errorText);
        continue;
      }

      const data = await res.json();
      const items = (data.items || []).filter(
        (it: any) => it?.id?.videoId && /^[a-zA-Z0-9_-]{11}$/.test(it.id.videoId)
      );
      if (!items.length) {
        console.log('[YouTube] No results for', attempt.duration || 'any duration');
        continue;
      }

      const best = pickBestYoutubeMatch(items, searchTerm);
      console.log('[YouTube] Picked:', best.id, '|', best.title, `(score ${best.score}${attempt.duration ? ', ' + attempt.duration.split('=')[1] : ''})`);
      return best.id;
    }

    return null;
  } catch (err) {
    console.error('[YouTube] Search failed:', err);
    return null;
  }
}

// Words that carry no meaning when comparing a query to a video title.
const YT_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for',
  'with', 'his', 'her', 'their', 'from', 'official', 'video', 'scene', 'clip',
]);

// Clips that are technically "about" the person but never illustrate the text.
const YT_JUNK = /\b(access hollywood|entertainment tonight|red carpet|paparazzi|interview|talk show|reaction|tier list|ranking every|top \d+|compilation of|fan edit|edit\b|tiktok|shorts)\b/i;

// Formats that genuinely show the work being discussed.
const YT_GOOD = /\b(trailer|official trailer|movie ?clips?|scene|full scene|performance|live at|official video|highlights|documentary)\b/i;

/**
 * Scores candidates by how much of the search phrase actually appears in the
 * video title, so the embed matches the paragraph it illustrates.
 */
function pickBestYoutubeMatch(
  items: any[],
  searchTerm: string
): { id: string; title: string; score: number } {
  const terms = searchTerm
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !YT_STOPWORDS.has(t));

  const scored = items.map((it: any, idx: number) => {
    const title = String(it.snippet?.title || '');
    const haystack = `${title} ${it.snippet?.description || ''}`.toLowerCase();

    // Core signal: share of meaningful query words present in the result.
    const hits = terms.filter(t => haystack.includes(t)).length;
    let score = terms.length ? (hits / terms.length) * 100 : 0;

    // A title match is worth far more than a description match.
    const titleLower = title.toLowerCase();
    score += terms.filter(t => titleLower.includes(t)).length * 12;

    if (YT_GOOD.test(title)) score += 15;
    if (YT_JUNK.test(title)) score -= 40;

    // Keep YouTube's own ranking as a mild tie-breaker.
    score -= idx;

    return { id: it.id.videoId as string, title, score: Math.round(score) };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

function buildYoutubeIframe(youtubeId: string): string {
  return `<iframe src="https://www.youtube.com/embed/${youtubeId}" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`;
}

// Build Spotify embed iframe from track URL
function buildSpotifyEmbed(spotifyUrl: string): string {
  // Extract track ID from various Spotify URL formats
  // https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC
  // https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC
  // spotify:track:4uLU6hMCjMI75M1A2tKUQC
  let trackId = '';
  
  // Handle /intl-XX/track/ format
  const trackMatch = spotifyUrl.match(/\/track\/([a-zA-Z0-9]+)/);
  if (trackMatch) {
    trackId = trackMatch[1];
  } else if (spotifyUrl.includes('spotify:track:')) {
    trackId = spotifyUrl.split('spotify:track:')[1]?.split('?')[0] || '';
  }
  
  if (!trackId) {
    console.log('[Spotify] Could not extract track ID from:', spotifyUrl);
    return '';
  }
  
  console.log('[Spotify] Building embed for track:', trackId);
  
  return `<div class="spotify-embed" style="margin: 20px 0;">
<iframe style="border-radius:12px" src="https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0" width="100%" height="152" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
</div>`;
}

// Build a single song card (compact, for grid layout)
function buildSongCardItem(song: string, band: string, coverImage?: string, spotifyLink?: string): string {
  const searchQuery = encodeURIComponent(`${band} ${song}`);
  const spotifySearchUrl = spotifyLink || `https://open.spotify.com/search/${searchQuery}`;
  const cover = coverImage || 'https://i.scdn.co/image/ab67616d0000b273a9f6c04ba168640b48aa5f8f';
  
  return `<a href="${spotifySearchUrl}" target="_blank" rel="noopener" class="song-card-item" style="display: flex; flex-direction: column; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 12px; overflow: hidden; border: 1px solid rgba(34, 197, 94, 0.3); text-decoration: none; transition: transform 0.2s, box-shadow 0.2s;">
  <div style="position: relative;">
    <img src="${cover}" alt="${song}" style="width: 100%; aspect-ratio: 1; object-fit: cover;" />
    <div style="position: absolute; bottom: 8px; right: 8px; width: 40px; height: 40px; background: #1DB954; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
    </div>
  </div>
  <div style="padding: 10px;">
    <div style="font-weight: 700; color: #fff; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song}</div>
    <div style="color: #22C55E; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${band}</div>
  </div>
</a>`;
}

// Wrap multiple song cards in a 3-column grid
function buildSongGrid(cards: string[]): string {
  if (cards.length === 0) return '';
  return `<div class="song-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0;">
${cards.join('\n')}
</div>`;
}

// Highlight @usernames in article content with green styling
function highlightUsernames(content: string): string {
  // Match @username patterns and wrap them in styled spans
  return content.replace(/@([a-zA-Z0-9_]+)/g, '<span class="username-mention" style="color: #22C55E; font-weight: 700; background: rgba(34, 197, 94, 0.1); padding: 2px 6px; border-radius: 4px;">@$1</span>');
}

// Convert sections array to HTML content with YouTube videos or Spotify embeds after each section
// isHistory: true = search for longer documentary videos (>20min)
// skipYoutube: true = don't search YouTube, use Spotify embeds instead
// spotifyLinks: array of {song, band, link, coverImage} for Spotify embeds
async function convertSectionsToContent(
  sections: Array<{heading: string | null; text: string; youtubeSearch?: string; spotifyEmbed?: string}>,
  isHistory: boolean = false,
  skipYoutube: boolean = false,
  spotifyLinks: Array<{song: string; band: string; link?: string; coverImage?: string}> = []
): Promise<string> {
  console.log('[Sections] Converting', sections.length, 'sections to content | isHistory:', isHistory, '| skipYoutube:', skipYoutube, '| spotifyLinks:', spotifyLinks.length);
  if (spotifyLinks.length > 0) {
    console.log('[Sections] Spotify links available:', spotifyLinks.map(s => `${s.song} by ${s.band}`).join(', '));
  }
  const contentParts: string[] = [];
  
  // Build a lookup map for Spotify links by song/band
  const spotifyMap = new Map<string, string>();
  for (const s of spotifyLinks) {
    if (s.link) {
      const key = `${s.song.toLowerCase()}|${s.band.toLowerCase()}`;
      spotifyMap.set(key, s.link);
      // Also add partial matches
      spotifyMap.set(s.song.toLowerCase(), s.link);
    }
  }
  
  for (const section of sections) {
    // Add heading if present
    if (section.heading) {
      contentParts.push(`<h2>${section.heading}</h2>`);
    }
    
    // Add text content
    contentParts.push(section.text);
    
    // If skipYoutube is true, try to add Spotify embeds for songs mentioned in this section
    if (skipYoutube && spotifyLinks.length > 0) {
      // Check if section has explicit spotifyEmbed URL
      if (section.spotifyEmbed) {
        const embed = buildSpotifyEmbed(section.spotifyEmbed);
        if (embed) {
          console.log('[Sections] Adding Spotify embed from section:', section.spotifyEmbed);
          contentParts.push(embed);
        }
      } else {
        // Search for song names mentioned in the section text and collect song cards
        const sectionTextLower = section.text.toLowerCase();
        const addedSongs = new Set<string>(); // Avoid duplicates
        const sectionCards: string[] = [];
        
        for (const songData of spotifyLinks) {
          const songKey = `${songData.song}|${songData.band}`;
          if (addedSongs.has(songKey)) continue;
          
          // Check if song title or band is mentioned in the section
          const songLower = songData.song.toLowerCase();
          const bandLower = songData.band.toLowerCase();
          
          if (sectionTextLower.includes(songLower) || sectionTextLower.includes(bandLower)) {
            // Build compact song card for grid
            const card = buildSongCardItem(songData.song, songData.band, songData.coverImage, songData.link);
            console.log('[Sections] Adding song card for:', songData.song, 'by', songData.band, '| hasCover:', !!songData.coverImage);
            sectionCards.push(card);
            addedSongs.add(songKey);
          }
        }
        
        // Wrap all cards in a 3-column grid
        if (sectionCards.length > 0) {
          contentParts.push(buildSongGrid(sectionCards));
        }
      }
    } else if (section.youtubeSearch) {
      // Original YouTube behavior
      console.log('[Sections] Section has youtubeSearch:', section.youtubeSearch, '| preferLong:', isHistory);
      const youtubeId = await findYoutubeVideoId(section.youtubeSearch, isHistory);
      if (youtubeId) {
        console.log('[Sections] Adding video iframe:', youtubeId);
        contentParts.push(buildYoutubeIframe(youtubeId));
      }
    }
  }
  
  let finalContent = contentParts.join('\n');
  
  // For radio articles (skipYoutube), highlight @usernames
  if (skipYoutube) {
    finalContent = highlightUsernames(finalContent);
  }
  
  return finalContent;
}

// Inject YouTube iframe after 2nd </p> and spread CTAs through content
function injectCtasIntoContent(content: string, ctas: string[], youtubeId?: string | null): string {
  const validCtas = ['radio', 'arcade', 'shop', 'articles', 'tv', 'rankroll'];
  const ctaQueue = (ctas || []).filter(c => validCtas.includes(c) && CTA_HTML[c]).map(c => CTA_HTML[c]);

  // Inject YouTube iframe after the 2nd paragraph
  let result = content;
  if (youtubeId) {
    const iframe = buildYoutubeIframe(youtubeId);
    let pCount = 0;
    result = result.replace(/<\/p>/gi, (match) => {
      pCount++;
      return pCount === 2 ? `</p>\n${iframe}` : match;
    });
    // If fewer than 2 paragraphs, prepend
    if (pCount < 2) result = iframe + '\n' + result;
  }

  // Spread CTAs: one after ~4th paragraph, rest at end
  if (ctaQueue.length) {
    let pCount2 = 0;
    let midInjected = false;
    result = result.replace(/<\/p>/gi, (match) => {
      pCount2++;
      if (pCount2 === 4 && !midInjected && ctaQueue.length > 1) {
        midInjected = true;
        return `</p>\n${ctaQueue.shift()}`;
      }
      return match;
    });
    // Append remaining CTAs at the end
    if (ctaQueue.length) result += '\n' + ctaQueue.join('\n');
  }

  return result;
}

async function searchWikimediaImage(term: string): Promise<string | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/search-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: term }),
    });
    const data = await res.json();
    if (data.success && data.allImages?.length > 0) {
      return data.allImages[0].url || data.allImages[0].thumbUrl || null;
    }
  } catch { /* silently fail */ }
  return null;
}

async function searchTenorGif(term: string): Promise<string | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/tenor-search?q=${encodeURIComponent(term)}`);
    const data = await res.json();
    if (data.success && data.results?.length > 0) {
      return data.results[0] || null;
    }
  } catch { /* silently fail */ }
  return null;
}

// Detect if message asks about real-time / recent events (EN + DE)
function needsLiveSearch(message: string): boolean {
  return /recent|latest|last \d+ (hour|day|week)|past \d+ (hour|day|week)|this week|today|just died|died recently|just happened|breaking|current|right now|48h|24h|who died|passed away|obituary|news|nachrichten|gestorben|verstorben|verstarb|gestern|letzten? tage?n?|letzte woche|diese woche|k[üu]rzlich|neulich|aktuell|heute|gerade|wer ist gestorben|todesf[äa]lle?/i.test(message);
}

// Detect if message specifically asks about recent deaths (EN + DE, typo-tolerant)
function isDeathQuery(message: string): boolean {
  return /gest[or]{2}ben|verst[or]{2}ben|verstarb|todesf[äa]lle?|\btode?s?\b|\btot\b|died|death|passed away|obituary|\brip\b|deceased/i.test(message);
}

// Robust recent-deaths source: parse Wikipedia "Deaths in <Month> <Year>" (independent
// of the flaky web_search_preview). Most recent days are at the end of the article.
async function fetchRecentDeaths(now: Date): Promise<string> {
  const cacheKey = now.toISOString().slice(0, 10);
  if (_deathsCache?.key === cacheKey) return _deathsCache.value;
  try {
    const monthName = now.toLocaleDateString('en-US', { month: 'long' });
    const year = now.getFullYear();
    const title = `Deaths in ${monthName} ${year}`;
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&redirects=1&titles=${encodeURIComponent(title)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'BOGX-Editorial/1.0' }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return '';
    const data = await res.json();
    const pages = data?.query?.pages || {};
    const page: any = Object.values(pages)[0];
    if (!page || page.missing !== undefined) return '';
    const extract: string = page.extract || '';
    if (!extract) return '';
    // Drop the references/footer, keep the day-by-day death list, take the most recent tail.
    const body = extract.split(/\n==+\s*(Previous months|References|See also|External links)/i)[0];
    const tail = body.slice(-4500);
    const value = `\n================================================================================
⚠️⚠️⚠️ RECENT DEATHS — STRICT GENX FILTER (WORLDWIDE) ⚠️⚠️⚠️
================================================================================
YOU MUST SCAN THE DATA BELOW AND EXTRACT GENX DEATHS.

GENX = BORN 1965–1980. NO EXCEPTIONS.
In ${year}, that means people who died aged ${year - 1980}–${year - 1965}.

HOW TO CHECK:
1. Find the age at death (e.g. "aged 52" or "52,")
2. Calculate: birth year = ${year} − age
3. If birth year is 1965–1980 → INCLUDE ✅
4. Otherwise → EXCLUDE ❌

EXAMPLES OF NON-GENX (EXCLUDE):
- Age 80+ → born before 1945 ❌
- Age 70-79 → born 1945-1955 ❌  
- Age 60-69 → born 1955-1965 ❌ (borderline, check exact year)
- Age 44-59 → born 1965-1980 ✅ GENX!
- Age under 44 → born after 1980 ❌

SCAN THE DATA BELOW. For each person aged ${year - 1980}–${year - 1965} (born 1965–1980):
→ List: NAME, birth year (calculated), profession/what they were known for

If you find ZERO people in that age range, say "Keine Generation-X-Todesfälle in den aktuellen Daten gefunden."
NEVER list people outside 1965–1980 birth years.

DATA (worldwide deaths, most recent at end):
${tail}\n`;
    _deathsCache = { key: cacheKey, value };
    return value;
  } catch {
    return '';
  }
}

// Use OpenAI web search (gpt-4o-search-preview) to get live context for a query
async function searchWebForContext(query: string): Promise<string> {
  try {
    const response = await (openai as any).responses.create({
      model: 'gpt-4o-search-preview',
      tools: [{ type: 'web_search_preview' }],
      input: query,
    });
    const text = response?.output_text || '';
    if (!text) return '';
    return `\n================================================================================\nLIVE WEB SEARCH RESULTS (fetched right now — use this as your primary source)\n================================================================================\n${text.slice(0, 3000)}\n`;
  } catch (err) {
    console.warn('Web search failed, skipping:', err);
    return '';
  }
}

// Extract potential memories from reporter response (simple heuristic)
function extractMemories(userMsg: string, response: string): string[] {
  const memories: string[] = [];
  const lower = userMsg.toLowerCase();
  if (lower.includes('remember') || lower.includes('merke') || lower.includes('vergiss nicht') || lower.includes("don't forget")) {
    memories.push(`User said: "${userMsg.slice(0, 200)}"`);
  }
  return memories;
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const { reporterUserId, message, conversationId, autoPublish, overrideCategory, overrideCountry, proposalOnly, articleMode: forceArticleMode, skipYoutube, spotifyLinks } = body;

    if (!reporterUserId || !message) {
      return NextResponse.json({ success: false, error: 'reporterUserId and message required' }, { status: 400 });
    }

    // Load reporter
    const profile = await ReporterProfile.findOne({ userId: reporterUserId });
    if (!profile) {
      return NextResponse.json({ success: false, error: 'Reporter not found' }, { status: 404 });
    }
    const user = await User.findById(reporterUserId).select('displayName username avatar').lean();
    const reporterName = (user as any)?.displayName || (user as any)?.username || profile.name || 'Reporter';

    // Load or create conversation
    let conversation = conversationId
      ? await EditorialConversation.findById(conversationId)
      : null;

    if (!conversation) {
      conversation = await EditorialConversation.create({
        reporterId: reporterUserId,
        type: 'direct',
        participantIds: [reporterUserId],
        title: message.slice(0, 60),
        messages: [],
      });
    }

    // Build OpenAI messages from history (last 20 messages for context)
    const historyMessages = conversation.messages.slice(-20).map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

    // Rebuild system prompt: BOGX knowledge (core.txt + article-prompt.txt) + reporter persona
    const bogxKnowledge = loadBogxSystemPrompt();
    const reporterPersona = generateReporterSystemPrompt({
      name: reporterName,
      role: profile.role,
      nationality: profile.nationality,
      region: profile.region,
      responsibilities: profile.responsibilities,
      writingStyle: profile.writingStyle,
      politicalTendency: profile.politicalTendency,
      personality: profile.personality,
      memories: profile.memories,
    });
    // Inject real date + live Wikipedia context + optional web search
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    // Both are cached per day, so after the first request they resolve instantly.
    // Wikipedia's curated list is thin and US-heavy, so for a category-filtered
    // birthday request we additionally pull the complete worldwide pool from Wikidata.
    const [liveContext, deathsContext, wikidataDeaths, wikidataBirths] = await Promise.all([
      fetchLiveContext(now.getMonth() + 1, now.getDate()),
      fetchRecentDeaths(now),
      fetchWikidataDeaths(now.getMonth() + 1, now.getDate()),
      hasWikidataCategory(overrideCategory)
        ? fetchWikidataBirthdays(now.getMonth() + 1, now.getDate(), overrideCategory)
        : Promise.resolve([]),
    ]);

    // Map country codes to full names
    const countryNames: Record<string, string> = {
      'US': 'United States', 'CA': 'Canada', 'MX': 'Mexico', 'BR': 'Brazil',
      'AR': 'Argentina', 'UK': 'United Kingdom', 'DE': 'Germany', 'FR': 'France',
      'IT': 'Italy', 'ES': 'Spain', 'NL': 'Netherlands', 'SE': 'Sweden',
      'NO': 'Norway', 'PL': 'Poland', 'RU': 'Russia', 'JP': 'Japan',
      'CN': 'China', 'KR': 'South Korea', 'IN': 'India', 'AU': 'Australia',
      'NZ': 'New Zealand', 'ZA': 'South Africa', 'EG': 'Egypt', 'NG': 'Nigeria',
      'AT': 'Austria', 'CH': 'Switzerland', 'BE': 'Belgium', 'PT': 'Portugal',
      'GR': 'Greece', 'IE': 'Ireland', 'CZ': 'Czech Republic', 'HU': 'Hungary',
    };
    const countryFullName = overrideCountry ? (countryNames[overrideCountry] || overrideCountry) : '';

    // Build override instructions if category/country filters are set
    const overrideInstructions = (overrideCategory || countryFullName) ? `
================================================================================
⚠️⚠️⚠️ EDITOR OVERRIDE — HIGHEST PRIORITY ⚠️⚠️⚠️
================================================================================
The editor has set MANDATORY filters. These OVERRIDE your specialty/region:
${overrideCategory ? `CATEGORY FILTER: You MUST find someone in "${overrideCategory}" category ONLY.` : ''}
${countryFullName ? `COUNTRY FILTER: You MUST find someone from "${countryFullName}" ONLY.` : ''}

IGNORE your normal specialty. Follow the editor's filters above.
================================================================================
` : '';

    // Persist every finding to the Menschen DB right away and look up who we
    // already wrote about, so this date needs no external lookup next year and
    // nobody gets a second birthday piece.
    let birthdayCoverage = new Map<string, { title?: string }>();
    if (wikidataBirths.length) {
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const [, coverage] = await Promise.all([
        saveMenschen(wikidataBirths.map(p => ({
          name: p.name,
          birthday: `${dd}.${mm}.${p.year}`,
          birthYear: p.year,
          country: p.country,
          profession: p.occupation,
          description: p.occupation,
          discoveredBy: reporterUserId,
          discoveredByName: reporterName,
          discoveredFor: 'birthday' as const,
        }))),
        getMenschenCoverage(wikidataBirths.map(p => p.name)),
      ]);
      birthdayCoverage = coverage;
    }

    // The complete Wikidata pool goes in front of the short Wikipedia list so the
    // reporter picks from every GenX politician/athlete/... worldwide, not just the US ones.
    const wikidataBirthContext = wikidataBirths.length
      ? formatBirthdayContext(
          wikidataBirths,
          now.getMonth() + 1,
          now.getDate(),
          overrideCategory,
          countryFullName,
          birthdayCoverage
        )
      : '';

    // Combine: reporter persona first (their identity), then full BOGX knowledge
    const systemPrompt = `TODAY'S DATE: ${dateStr}
You know today's exact date. Never guess or make up the date.
${overrideInstructions}
SINGLE-TURN RULE — BE PRODUCTIVE, NEVER STALL:
This chat is a single request/response. You CANNOT "get back later" or do work in the background.
NEVER reply with empty promises like "let me check and I'll get back to you", "one moment", "lass mich nachschauen", "ich melde mich gleich", "einen Moment bitte". Such replies are useless.
ALWAYS complete the task fully IN THIS SAME MESSAGE and deliver the concrete answer (names, dates, facts) directly.
The sections below already contain LIVE, up-to-date data (today-in-history + the real recent-deaths list).
USE THEM as your source for any recent-events / "who died" question — interpret the editor's intent from MEANING,
ignoring typos/spelling/language (e.g. "gestroben" still means "gestorben"). Never claim you have no recent
information when the data below answers it. If the data truly contains nothing relevant, say so honestly.
${wikidataBirthContext}${liveContext}${deathsContext}${wikidataDeaths}
${reporterPersona}

================================================================================
FULL BOGX PLATFORM KNOWLEDGE (study this — it is your employer's complete guide)
================================================================================
${bogxKnowledge}`;

    const articleMode = forceArticleMode === true || isArticleApproval(message);

    // Different JSON format instructions for Radio articles (Spotify) vs regular articles (YouTube)
    const radioArticleInstructions = `\n\n⚠️ EDITOR APPROVED — OUTPUT FORMAT IS MANDATORY ⚠️
Output ONLY valid JSON. Use the SECTIONS array format:
{
  "title": "...",
  "subtitle": "...",
  "sections": [
    {"heading": null, "text": "<p>Intro paragraph...</p>"},
    {"heading": "Section Title", "text": "<p>Content about the songs...</p>"}
  ],
  "tags": ["community", "music", "playlist", "genx"],
  "category": "music",
  "imageSearchTerm": "retro radio music vinyl",
  "ctas": ["radio", "articles"]
}
IMPORTANT: This is a Community Radio article. Do NOT include youtubeSearch fields. 
Write engaging content about the songs mentioned in the prompt.
Use 3-5 sections to group songs by theme/genre/mood.`;

    const regularArticleInstructions = `\n\n⚠️ EDITOR APPROVED — OUTPUT FORMAT IS MANDATORY ⚠️
Output ONLY valid JSON. Use the SECTIONS array format (NOT the old "content" field):
{
  "title": "...",
  "subtitle": "...",
  "personCountry": "BIRTH country name (e.g. 'Brazil', 'South Korea')",
  "personCountryCode": "ISO 2-letter BIRTH country code (e.g. 'BR', 'KR')",
  "sections": [
    {"heading": null, "text": "<p>Intro...</p>", "youtubeSearch": "Person Name famous moment official"},
    {"heading": "Section Title", "text": "<p>Content...</p>", "youtubeSearch": "Person Name specific event year"}
  ],
  "tags": ["..."],
  "category": "movies-tv|music|gaming|sports|history|lifestyle|rip|news|eastercorn",
  "imageSearchTerm": "specific search term",
  "ctas": ["articles", "tv"]
}
CRITICAL — YOUTUBE SEARCH RULES:
- Each section MUST have a "youtubeSearch" field with a HIGHLY SPECIFIC search term.
- ALWAYS include the person's FULL NAME + a SPECIFIC event/song/movie/match + year if known.
- BAD: "David Healy goals" (too generic)
- GOOD: "David Healy goal vs England 2005 Windsor Park"
- GOOD: "Shawn Burr NHL highlights Detroit Red Wings"
- GOOD: "Kurt Cobain Smells Like Teen Spirit live 1991"
- For SPORTS: "Name + match/opponent + year" or "Name + best goals/plays + team"
- For MUSIC: "Name + song title + official video" or "Name + live performance + venue year"
- For ACTORS: "Name + movie title + scene" or "Name + interview + show year"
- For RIP: "Name + tribute" or "Name + best moments compilation" or "Name + final performance"
- personCountry and personCountryCode are REQUIRED - use the person's BIRTH country.
- DO NOT use the old "content" field. Use "sections" array ONLY.`;

    const userMessageContent = articleMode
      ? message + (skipYoutube ? radioArticleInstructions : regularArticleInstructions)
      : message;

    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userMessageContent },
    ];

    // Single GPT call — the live data (today-in-history + recent deaths) is already injected
    // in the system prompt (cached per day), so the reporter answers in ONE round trip. This is
    // both fast and typo-proof: it never depends on keyword-matching the editor's exact wording.
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: openaiMessages,
      temperature: 0.85,
      max_tokens: articleMode ? 4000 : 2000, // More tokens for articles with sections
    });

    const rawResponse = completion.choices[0]?.message?.content || '';

    // Save user message to conversation
    conversation.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    let finalResponse = rawResponse;
    let articleDraftId: string | null = null;
    let articleTitle: string | null = null;
    let articleData: any = null;

    // Handle article generation — always try to parse JSON in case reporter generated it
    // (reporter's system prompt controls when it outputs JSON, not just the mode flag)
    // BUT: if proposalOnly is true, skip article creation entirely
    const looksLikeJson = rawResponse.trim().startsWith('{') || rawResponse.includes('"title"') && rawResponse.includes('"content"');
    if (!proposalOnly && (articleMode || looksLikeJson)) {
      try {
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);

          // Find cover image: Tenor GIFs first (animated), Wikimedia as fallback
          let coverImage = '';
          const searchTerm = parsed.imageSearchTerm || parsed.title || message;

          coverImage = (await searchTenorGif(searchTerm)) || '';
          if (!coverImage) {
            coverImage = (await searchWikimediaImage(searchTerm)) || '';
          }

          // Convert sections to content with YouTube videos (new format)
          // Falls back to legacy content field if sections not present
          let finalContent = '';
          console.log('[Article] Parsed JSON keys:', Object.keys(parsed));
          console.log('[Article] Has sections:', !!parsed.sections, '| Has content:', !!parsed.content);
          
          if (parsed.sections && Array.isArray(parsed.sections)) {
            // New format: sections array with youtubeSearch per section
            // For history articles, search for longer documentary videos
            // For radio/music articles with skipYoutube, use Spotify embeds instead
            const isHistoryArticle = (parsed.category || '').toLowerCase().includes('history');
            console.log('[Article] Using NEW sections format with', parsed.sections.length, 'sections | isHistory:', isHistoryArticle, '| skipYoutube:', !!skipYoutube);
            finalContent = await convertSectionsToContent(
              parsed.sections, 
              isHistoryArticle, 
              skipYoutube === true, 
              spotifyLinks || []
            );
          } else if (parsed.content) {
            // Legacy format: plain HTML content
            console.log('[Article] Using LEGACY content format (no videos will be added)');
            finalContent = parsed.content;
          }

          // Validate category
          const rawCategory = (parsed.category || '').split('|')[0].trim().toLowerCase();
          const safeCategory = VALID_CATEGORY_SLUGS.includes(rawCategory) ? rawCategory : 'culture';

          // Check if skipSave is requested (for preview before saving)
          const skipSave = body.skipSave === true;
          
          if (skipSave) {
            // Return article data without saving to DB
            articleData = {
              title: parsed.title || 'Untitled',
              subtitle: parsed.subtitle || '',
              content: finalContent,
              coverImage,
              tags: parsed.tags || [],
              category: safeCategory,
              reporterId: reporterUserId,
              reporterName,
            };
            articleTitle = parsed.title || 'Untitled';
            finalResponse = `Article "${articleTitle}" ready for review.`;
          } else {
            // Save as Article draft (original behavior)
            const article = await Article.create({
              title: parsed.title || 'Untitled',
              subtitle: parsed.subtitle || '',
              content: finalContent,
              coverImage,
              thumbnailUrl: coverImage,
              tags: parsed.tags || [],
              category: safeCategory,
              mainCategory: 'articles',
              contentType: 'article',
              author: reporterUserId,
              authorName: reporterName,
              authorAvatar: (user as any)?.avatar || '',
              status: autoPublish ? 'published' : 'draft',
              layout: 'standard',
              autoGenerated: true,
              personCountry: parsed.personCountry || '',
              personCountryCode: parsed.personCountryCode?.toUpperCase() || '',
            });

            articleDraftId = article._id.toString();
            articleTitle = parsed.title || 'Untitled';
            profile.articleCount = (profile.articleCount || 0) + 1;

            // Flag the person as covered so future conferences skip them.
            await markMenschCovered({
              articleId: article._id.toString(),
              title: articleTitle || parsed.title || 'Untitled',
              personName: parsed.personName,
              userId: reporterUserId,
            });

            const videoCount = parsed.sections?.length || 0;
            finalResponse = `✅ **Draft saved:** "${articleTitle}"

Category: ${safeCategory}${coverImage ? ' · Cover image found' : ' · No cover image'}${videoCount > 0 ? ` · ${videoCount} YouTube videos embedded` : ''}

It's in the Articles tab → Drafts. Add CTAs manually, then publish.`
          }
        }
      } catch {
        finalResponse = rawResponse;
      }
    }

    // Save reporter message to conversation
    conversation.messages.push({
      role: 'reporter',
      reporterId: reporterUserId,
      reporterName,
      content: finalResponse,
      articleDraftId: articleDraftId || undefined,
      timestamp: new Date(),
    } as any);

    // Extract and save new memories
    const newMemories = extractMemories(message, finalResponse);
    if (newMemories.length > 0) {
      profile.memories = [...(profile.memories || []), ...newMemories].slice(-50); // keep last 50
    }

    profile.lastActive = new Date();
    await Promise.all([conversation.save(), profile.save()]);

    return NextResponse.json({
      success: true,
      conversationId: conversation._id.toString(),
      response: finalResponse,
      articleDraftId,
      articleTitle,
      articleData, // For skipSave mode - contains article content without saving
      isArticle: !!articleDraftId || !!articleData,
      reporterName,
    });
  } catch (error: any) {
    if (error?.message?.startsWith('INVALID_CATEGORY:')) {
      const badCat = error.message.replace('INVALID_CATEGORY:', '');
      return NextResponse.json({
        success: true,
        response: `❌ **Draft not saved** — reporter returned invalid category "${badCat}". Valid values: ${VALID_CATEGORY_SLUGS.join(', ')}. Ask them to retry.`,
        articleDraftId: null,
        isArticle: false,
      });
    }
    console.error('Editorial chat error:', error);
    return NextResponse.json({ success: false, error: 'Chat failed' }, { status: 500 });
  }
}

// GET - load conversation history
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const reporterUserId = searchParams.get('reporterUserId');
    const conversationId = searchParams.get('conversationId');

    if (conversationId) {
      const conv = await EditorialConversation.findById(conversationId).lean();
      return NextResponse.json({ success: true, conversation: conv });
    }

    if (reporterUserId) {
      const conv = await EditorialConversation.findOne({ reporterId: reporterUserId })
        .sort({ updatedAt: -1 })
        .lean();
      return NextResponse.json({ success: true, conversation: conv || null });
    }

    return NextResponse.json({ success: false, error: 'reporterUserId or conversationId required' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
