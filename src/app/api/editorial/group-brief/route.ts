import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import dbConnect from '@/lib/mongoose';
import { Person } from '@/models/Almanac';
import { combinePrompts } from '@/lib/loadPrompt';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Load modular prompts: core + article rules for editorial briefing
function loadBogxKnowledge(): string {
  return combinePrompts(['core.txt', 'article-prompt.txt']);
}

// Map a Wikipedia death-line description (e.g. "Italian footballer") to a Person profession enum.
function descToProfession(desc: string): string {
  const d = (desc || '').toLowerCase();
  if (/foot|soccer|athlet|boxer|player|olympic|tennis|basketball|baseball|cyclist|sprinter|swimmer|racer|driver|wrestler|skater|golfer|rugby|cricket|sport/.test(d)) return 'Sport';
  if (/actor|actress|film|movie|cinema|director|screenwriter|comedian|comic/.test(d) && /comedian|comic/.test(d)) return 'Comedy';
  if (/actor|actress|film|movie|cinema|director|screenwriter/.test(d)) return 'Actor';
  if (/music|singer|rapper|guitar|drummer|bassist|composer|songwriter|\bdj\b|band|rock|pop|jazz|pianist|violinist|cellist|conductor/.test(d)) return 'Music';
  if (/politic|president|minister|senator|governor|mayor|diplomat|statesman|chancellor/.test(d)) return 'Politik';
  if (/artist|painter|sculptor|photograph|designer|illustrator/.test(d)) return 'Art';
  if (/comedian|comic/.test(d)) return 'Comedy';
  if (/\bmodel\b/.test(d)) return 'Model';
  if (/engineer|scientist|programm|developer|\btech\b|inventor|physicist|chemist/.test(d)) return 'Tech';
  return 'Other';
}

// Save any verified GenX person the reporters find to the Menschen (Person) DB
// immediately — idempotent. Handles BOTH birthdays and deaths (and anything with
// verified born/died data). We already have Wikipedia-verified data, so no GPT call
// is needed. Backfills born/died on existing records that lack them — never overwrites.
async function savePeopleToDB(
  entries: { name: string; born?: string; died?: string; desc: string }[]
): Promise<number> {
  let saved = 0;
  try {
    await dbConnect();
    await Promise.all(entries.map(async (e) => {
      try {
        const cleaned = e.name.trim();
        if (!cleaned || cleaned.length < 2) return;
        const parts = cleaned.split(/\s+/);
        const firstname = parts[0];
        const lastname = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];

        const existing = await Person.findOne({
          firstname: { $regex: new RegExp(`^${firstname}$`, 'i') },
          lastname: { $regex: new RegExp(`^${lastname}$`, 'i') },
        });
        if (existing) {
          // Backfill missing dates only — don't overwrite curated data
          let changed = false;
          if (e.born && !existing.born) { existing.born = e.born; changed = true; }
          if (e.died && !existing.died) { existing.died = e.died; changed = true; }
          if (changed) await existing.save();
          return;
        }

        const nationality = e.desc.match(/^([A-Z][a-zÀ-ž]+)/)?.[1] || undefined;
        const doc: any = {
          firstname,
          lastname,
          profession: descToProfession(e.desc),
          knownfor: e.desc,
          nationality,
        };
        if (e.born) doc.born = e.born;
        if (e.died) doc.died = e.died;
        await Person.create(doc);
        saved++;
      } catch { /* skip individual failures, keep going */ }
    }));
  } catch { /* DB unavailable — non-fatal, brief still works */ }
  return saved;
}

const PLATFORM_STRUCTURE = `
================================================================================
BOGX PLATFORM STRUCTURE — know this inside out
================================================================================

SITE SECTIONS (what users see):
- Homepage feed = WelcomeReel. Top of page = 3 featured "main" articles (the most visible content). Below = feed of all content cards.
- Article page = full article with CTAs (Rankroll vote, TV clips, shop, radio, arcade)
- TV section = 3 featured video positions (pos 1 = hero, pos 2/3 = supporting)
- Rankroll = voting/ranking polls (e.g. "Top 10 90s movies")
- Profile page = user profile, coins, stats, game history
- Radio = background music player (GenX songs)
- Arcade = trivia games and battles
- Shop = GenX merch

CONTENT TYPES (what you create in editorial):
- Article → text article with cover image, CTAs, YouTube embed, category tag
- Rankroll → ranked poll with items (can have 5-20 items), voting
- TV Clips → 3 YouTube videos for the TV section hero
- Menschen ("People") → profile cards for GenX celebrities
- Article categories: music, movies-tv, sports, gaming, tech, history, genx-icons, rip, lifestyle, news, culture, eastercorn

ADMIN SECTIONS (what CEO/editors use):
- Users tab → manage users + AI reporter team (seed, create employee like Eastercorn)
- Articles tab → all drafts/published articles, edit, publish, delete
- Editorial Conference → THIS ROOM. Set campaign, brief team, assign tasks, run
- TV tab → manage 3 featured video slots
- Rankings tab → manage Rankroll polls
- Mike tab → ticket/task system for bugs and features

HOMEPAGE SLOTS explained:
- "3 articles on top" / "main part" / "featured articles" = the 3 large cards at the top of the homepage feed
- Slot 1 = biggest, most prominent (hero article)
- Slots 2 & 3 = side articles
- These are the most-read content — always pick high-impact, emotionally resonant topics

CONTENT PLANNING VOCABULARY:
- "Replace slot X" = choose a new article for that featured position
- "RIP piece" = tribute article for a recently deceased GenX celebrity
- "On this day" = history article about something that happened today in 1980s-90s
- "Birthday angle" = article about a GenX celeb with a birthday today
- "Rankroll for this" = create a vote/ranking around the campaign topic
- "TV the campaign" = find 3 YouTube clips related to the campaign topic

EASTERCORN = CEO & Editor-in-Chief. Sets campaign topics. Does NOT write articles. Commands the team.
`;


// Clean Wikipedia "text" field: strip trailing description after the comma if it's the profession
function cleanName(text: string): string {
  // text format: "Paolo Maldini, Italian footballer" — keep name + short descriptor
  return (text || '').trim();
}

async function fetchTodayContext(month: number, day: number): Promise<{ contextStr: string; birthList: string[]; deathList: string[] }> {
  const empty = { contextStr: '', birthList: [], deathList: [] };
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');

  try {
    // Dedicated /births/ and /deaths/ endpoints return the FULL list (not the short curated /all/)
    const [birthsRes, deathsRes] = await Promise.all([
      fetch(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/births/${mm}/${dd}`,
        { headers: { 'User-Agent': 'BOGX-Editorial/1.0' }, signal: AbortSignal.timeout(8000) }).catch(() => null),
      fetch(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/deaths/${mm}/${dd}`,
        { headers: { 'User-Agent': 'BOGX-Editorial/1.0' }, signal: AbortSignal.timeout(8000) }).catch(() => null),
    ]);

    const birthsData = birthsRes?.ok ? await birthsRes.json() : {};
    const deathsData = deathsRes?.ok ? await deathsRes.json() : {};

    // STRICT GenX: born 1965-1980 ONLY
    const genxBirths = (birthsData.births || []).filter((b: any) => b.year >= 1965 && b.year <= 1980);
    const birthList: string[] = genxBirths.map((b: any) => `${cleanName(b.text)} (${dd}.${mm}.${b.year})`);

    // IMPORTANT: save every found GenX birthday person to the Menschen DB immediately (idempotent).
    savePeopleToDB(genxBirths.map((b: any) => ({
      name: cleanName(b.text),
      born: `${b.year}-${mm}-${dd}`,
      desc: b.pages?.[0]?.description || b.pages?.[0]?.extract?.split('.')?.[0] || '',
    }))).catch(() => {});

    // Deaths: Filter for GenX-born people (born 1965-1980) who died on this day
    const allDeaths = deathsData.deaths || [];
    console.log(`[Deaths] Total deaths from Wikipedia API: ${allDeaths.length}`);
    
    const genxDeaths = allDeaths.filter((d: any) => {
      // Method 1: Extract birth year from text like "Name, profession (born 1977)"
      const bornMatch = d.text?.match(/born\s*(?:c\.\s*)?(\d{4})/i);
      if (bornMatch) {
        const birthYear = parseInt(bornMatch[1]);
        if (birthYear >= 1965 && birthYear <= 1980) return true;
      }
      
      // Method 2: Check description for birth year pattern "(YYYY–YYYY)" or "(born YYYY)"
      const desc = d.pages?.[0]?.description || '';
      const descBornMatch = desc.match(/\((\d{4})[\–\-–]/);
      if (descBornMatch) {
        const birthYear = parseInt(descBornMatch[1]);
        if (birthYear >= 1965 && birthYear <= 1980) return true;
      }
      
      // Method 3: Calculate from death year and age in description like "aged 45" or "(1970-2020)"
      const ageMatch = desc.match(/aged?\s*(\d{2,3})/i) || desc.match(/\((\d{4})–(\d{4})\)/);
      if (ageMatch) {
        let estimatedBirthYear: number | null = null;
        if (ageMatch[2]) {
          // Pattern: (1970-2020) - first group is birth year
          estimatedBirthYear = parseInt(ageMatch[1]);
        } else {
          // Pattern: aged 45 - calculate from death year
          estimatedBirthYear = d.year - parseInt(ageMatch[1]);
        }
        if (estimatedBirthYear && estimatedBirthYear >= 1965 && estimatedBirthYear <= 1980) return true;
      }
      
      return false;
    });
    
    console.log(`[Deaths] GenX deaths found: ${genxDeaths.length}`);

    // IMPORTANT: save every found GenX death person to the Menschen DB immediately (idempotent).
    savePeopleToDB(genxDeaths.map((d: any) => {
      const bornMatch = d.text?.match(/born\s*(?:c\.\s*)?(\d{4})/i);
      const birthYear = bornMatch ? bornMatch[1] : '';
      return {
        name: cleanName(d.text),
        born: birthYear ? `${birthYear}-01-01` : '', // Approximate birth date
        died: `${d.year}-${mm}-${dd}`, // Exact death date
        desc: d.pages?.[0]?.description || d.pages?.[0]?.extract?.split('.')?.[0] || '',
      };
    })).catch(() => {});

    // ONLY GenX deaths - if none found, that's fine
    const deathList: string[] = genxDeaths
      .slice(0, 20)
      .map((d: any) => {
        const desc = d.pages?.[0]?.description || '';
        const bornMatch = d.text?.match(/born\s*(?:c\.\s*)?(\d{4})/i);
        const birthYear = bornMatch ? bornMatch[1] : '?';
        return `${cleanName(d.text)} (b. ${birthYear} † ${d.year}) — ${desc}`;
      });

    const sections: string[] = [];
    if (birthList.length) sections.push(`CONFIRMED GenX BIRTHDAYS TODAY (${dd}.${mm}) — born 1965–1980 STRICTLY:\n${birthList.map(b => `  - ${b}`).join('\n')}\n\n🚫 ABSOLUTE RULE: ONLY use names from this list. Anyone NOT on this list is FORBIDDEN.`);
    if (deathList.length) sections.push(`⚰️ GENX DEATHS ON THIS DAY (${dd}.${mm}) — born 1965–1980 ONLY:\n${deathList.map(d => `  - ${d}`).join('\n')}\n\n🚫 ABSOLUTE RULE: ONLY GenX deaths. If list is empty, NO RIP articles today.`);

    const contextStr = sections.length
      ? `\n================================================================================\nTODAY IN HISTORY (${dd}.${mm}) — GENX ONLY (1965–1980)\n================================================================================\n${sections.join('\n\n')}\n`
      : '';
    return { contextStr, birthList, deathList };
  } catch { return empty; }
}

// Daily cache — Wikipedia death lists change at most once per day
let _briefDeathsCache: { key: string; value: { contextStr: string; nameList: string[] } } | null = null;

// Parse one Wikipedia "Deaths in <Month> <Year>" page into structured entries.
// explaintext strips wiki markup, so day headers render as standalone numbers and
// entries render as "Name, age, nationality occupation." lines.
async function parseDeathsMonth(monthName: string, year: number): Promise<{ name: string; age: number; birthYear: number; day: number; desc: string }[]> {
  try {
    const title = `Deaths in ${monthName} ${year}`;
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&redirects=1&titles=${encodeURIComponent(title)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'BOGX-Editorial/1.0' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    const pages = data?.query?.pages || {};
    const page: any = Object.values(pages)[0];
    if (!page || page.missing !== undefined) return [];
    const extract: string = page.extract || '';
    if (!extract) return [];
    const body = extract.split(/\n=+\s*(Previous months|References|See also|External links)/i)[0];
    const lines = body.split('\n');
    const out: { name: string; age: number; birthYear: number; day: number; desc: string }[] = [];
    let currentDay = 0;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      // Day heading = a standalone number 1-31
      const dayMatch = line.match(/^(\d{1,2})$/);
      if (dayMatch) {
        const d = parseInt(dayMatch[1]);
        if (d >= 1 && d <= 31) { currentDay = d; continue; }
      }
      // Entry: "Name, age, description"
      const m = line.match(/^(.+?),\s*(\d{2,3}),\s*(.+)$/);
      if (m) {
        const name = m[1].trim();
        const age = parseInt(m[2]);
        if (age < 1 || age > 120) continue;
        out.push({ name, age, birthYear: year - age, day: currentDay, desc: m[3].trim() });
      }
    }
    return out;
  } catch { return []; }
}

// Build a verified, worldwide, newest-first list of GenX (born 1965-1980) deaths.
// Pulls the current month and, if sparse, the previous month too.
// wholeYear=true → pull every month of the current year (for "this year" campaigns).
async function fetchRecentGenXDeaths(now: Date, wholeYear = false): Promise<{ contextStr: string; nameList: string[] }> {
  const empty = { contextStr: '', nameList: [] };
  const cacheKey = `${now.toISOString().slice(0, 10)}${wholeYear ? '-year' : ''}`;
  if (_briefDeathsCache?.key === cacheKey) return _briefDeathsCache.value;
  try {
    const cm = now.getMonth();
    const cy = now.getFullYear();

    let all: any[];
    if (wholeYear) {
      // Fetch every month of the current year up to the current month
      const monthsToFetch = Array.from({ length: cm + 1 }, (_, i) => i);
      const results = await Promise.all(
        monthsToFetch.map(async (mIdx) => {
          const mName = new Date(cy, mIdx, 1).toLocaleDateString('en-US', { month: 'long' });
          const entries = await parseDeathsMonth(mName, cy);
          return entries.map(e => ({ ...e, monthNum: mIdx + 1, year: cy }));
        })
      );
      all = results.flat();
    } else {
      const curName = now.toLocaleDateString('en-US', { month: 'long' });
      const prev = new Date(cy, cm - 1, 1);
      const prevName = prev.toLocaleDateString('en-US', { month: 'long' });
      all = (await parseDeathsMonth(curName, cy)).map(e => ({ ...e, monthNum: cm + 1, year: cy }));
      let genxCheck = all.filter(e => e.birthYear >= 1965 && e.birthYear <= 1980);
      if (genxCheck.length < 8) {
        const prevMapped = (await parseDeathsMonth(prevName, prev.getFullYear())).map(e => ({ ...e, monthNum: prev.getMonth() + 1, year: prev.getFullYear() }));
        all = [...all, ...prevMapped];
      }
    }
    let genx = all.filter(e => e.birthYear >= 1965 && e.birthYear <= 1980);
    // Newest first
    genx.sort((a, b) => b.year - a.year || b.monthNum - a.monthNum || b.day - a.day);
    const top = genx.slice(0, 30);
    if (!top.length) return empty;

    // IMPORTANT: save every newly found, verified GenX death to the Menschen DB immediately (idempotent).
    savePeopleToDB(top.map((e: any) => ({
      name: e.name,
      born: String(e.birthYear),
      died: `${e.year}-${String(e.monthNum).padStart(2, '0')}-${String(e.day).padStart(2, '0')}`,
      desc: e.desc,
    }))).catch(() => {});

    const fmt = (e: any) => {
      const dd = String(e.day).padStart(2, '0');
      const mm = String(e.monthNum).padStart(2, '0');
      return `${e.name} (b. ~${e.birthYear} † ${dd}.${mm}.${e.year}, age ${e.age}) — ${e.desc}`;
    };
    const nameList = top.map(fmt);
    const contextStr = `\n================================================================================\nVERIFIED RECENT GENX DEATHS (born 1965–1980) — WORLDWIDE, NEWEST FIRST\n================================================================================\n🚫 ABSOLUTE RULE: For death/RIP campaigns, use ONLY people from THIS list. Anyone NOT on this list is FORBIDDEN. All are confirmed GenX (born 1965–1980). Each entry already has the birth year and full death date — carry them into the topic verbatim.\n\n${nameList.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n`;
    const value = { contextStr, nameList };
    _briefDeathsCache = { key: cacheKey, value };
    return value;
  } catch { return empty; }
}

export async function POST(request: NextRequest) {
  try {
    const { campaignTopic, reporters, userMessage, history } = await request.json() as {
      campaignTopic: string;
      reporters: { id: string; name: string; role: string; avatar?: string; personality?: string; writingStyle?: string; specialty?: string; responsibilities?: string }[];
      userMessage?: string;
      history?: { name: string; content: string; isUser: boolean }[];
    };
    if (!campaignTopic || !reporters?.length) {
      return NextResponse.json({ success: false, error: 'Missing params' }, { status: 400 });
    }

    const broadenCoverage = (raw: string): string => {
      const r = raw.toLowerCase();
      if (['sport','boxing','football','soccer','baseball','basketball','tennis','athletics','swimming','cycling','racing','motorsport','hockey','cricket','rugby','golf','wrestling','mma'].some(k => r.includes(k)))
        return 'Sports — ALL disciplines worldwide (football, baseball, boxing, basketball, motorsport, athletics, any sport)';
      if (['music','band','album','song','musician','singer','rapper','dj','rock','pop','hiphop','hip-hop','jazz','country'].some(k => r.includes(k)))
        return 'Music & Entertainment — all genres, all eras, worldwide artists';
      if (['tech','anime','gaming','game','manga','esport','internet','digital','gadget'].some(k => r.includes(k)))
        return 'Tech & Pop Culture — games, anime, technology, internet culture, sci-fi';
      if (['history','politic','war','event','anniversary','world','news'].some(k => r.includes(k)))
        return 'History & World Affairs — historical figures, political icons, anniversaries, global events';
      if (['rip','obituar','tribute','death','memorial'].some(k => r.includes(k)))
        return 'RIP & Tributes — covers people who DIED on this day; writes tribute/legacy articles; MUST check the deaths list above and save deceased persons to DB';
      if (['lifestyle','travel','food','fashion','wellness','health'].some(k => r.includes(k)))
        return 'Lifestyle & International Culture — food, travel, fashion, global personalities';
      if (['culture','society','film','movie','cinema','tv','television','art','comedy','actor','actress'].some(k => r.includes(k)))
        return 'Culture & Entertainment — film, TV, comedy, arts, actors, directors';
      return raw || 'General — all topics';
    };
    const teamList = reporters.map((r) => {
      const rawArea = [r.specialty, r.responsibilities].filter(Boolean).join(', ');
      const coverageLabel = rawArea ? broadenCoverage(rawArea) : '';
      const coverage = coverageLabel ? ` [COVERS: ${coverageLabel}]` : '';
      const styleNote = r.writingStyle ? ` — writing style: ${r.writingStyle}` : '';
      return `${r.name} (${r.role || 'journalist'}${coverage}${styleNote})`;
    }).join('\n');
    const bogxKnowledge = loadBogxKnowledge();
    const isFollowUp = !!(userMessage && history?.length);

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const isBirthdayCampaign = /birthday|born|birth|geburtstag/i.test(campaignTopic);
    const isDeathCampaign =
      /\b(rip|r\.i\.p|deaths?|died|dead|passed away|obituar|tribute|memorial|in memoriam)\b/i.test(campaignTopic)
      // German stems (no strict word boundary — German compounds + tolerate typos like "verstroene")
      || /(gestorb|verstorb|verstro|verstarb|todesf|todes\b|nachruf|trauer|tote[nr]?\b)/i.test(campaignTopic);
    // Fetch today's context for BOTH birthday AND death campaigns
    const needsTodayContext = (isBirthdayCampaign || isDeathCampaign) && !isFollowUp;
    const todayCtx = needsTodayContext
      ? await fetchTodayContext(now.getMonth() + 1, now.getDate())
      : { contextStr: '', birthList: [], deathList: [] };
    const wantsWholeYear = /\b(this year|year|jahr|jahres|heuer)\b/i.test(campaignTopic);
    const deathsCtx = isDeathCampaign && !isFollowUp
      ? await fetchRecentGenXDeaths(now, wantsWholeYear)
      : { contextStr: '', nameList: [] as string[] };

    const fullKnowledge = `TODAY'S DATE: ${todayStr}\n\n${PLATFORM_STRUCTURE}${todayCtx.contextStr}${deathsCtx.contextStr}\n\n================================================================================\nBOGX BRAND & CONTENT GUIDE\n================================================================================\n${bogxKnowledge}`;

    const reporterKnowledge = `
EDITORIAL INTELLIGENCE — you know this, the CEO does not need to tell you:

GENX DEFINITION: Born 1965–1980. Never pitch someone outside this range without flagging it.

BIRTHDAY PROTOCOL: When the topic involves birthdays:
- A birthday is the DAILY TRIGGER that surfaces a person — it is NOT the main subject of the article.
- The article is about WHO THE PERSON IS: their career, legacy, personality, cultural impact. The birthday appears only as a brief passing mention (e.g. "who turns 56 today") — never as the headline angle.
- Tomorrow's date is key. Calculate it from today (${todayStr}).
- Each reporter MUST pick from the confirmed birthday list above — ONLY people on that list.
- Each reporter picks a person that MATCHES THEIR SPECIALTY: a sports reporter picks an athlete, a music reporter picks a musician, a film reporter picks an actor/director. A sports reporter must NEVER pick an actor. A film reporter must NEVER pick an athlete. Match the reporter's role to the person's field.
- When multiple options exist in a reporter's specialty area, always pick the MOST GLOBALLY FAMOUS and culturally significant person — not whoever appears first alphabetically. Paolo Maldini > Michael Vartan. Derek Jeter > a minor athlete.
- SEARCH GLOBALLY — NOT just USA. GenX celebrities exist in EVERY country: Europe, Latin America, Asia, Africa, Australia, Middle East, Eastern Europe.
- The PLAN entry topic MUST include the person's full name and birth year, e.g. "Paolo Maldini (1968) — Football Legend" NOT "Happy Birthday Paolo Maldini".
- If you genuinely cannot confirm a birthday with confidence, say so — never invent birthdays.
- Rankroll and TV tasks MUST be tied to a SPECIFIC person from the birthday list — NOT a generic "GenX Celebrities Born Today" theme. Each rankroll ranks something about ONE named person's career. Examples: "Paolo Maldini's Greatest Defensive Moments — Rank Them", "Rank Ryan Tedder's Biggest Hit Songs", "Paul Thomas Anderson's Best Films — Vote". A TV task: "Paolo Maldini's Top Career Highlights — Clips". NEVER a generic birthday-roundup rankroll.
- CRITICAL: If a reporter CANNOT find a person from the birthday list that fits their specialty, assign them a RANKROLL or TV task about the birthday campaign theme INSTEAD. Example: "Top 10 GenX Athletes of All Time → Rankroll → Frank". NEVER invent or guess a birthday person not on the confirmed list.

RIP PROTOCOL: When the topic involves RIP, deaths, tributes, or memorials:
- 🚫 CRITICAL: ONLY use people from the CONFIRMED DEATHS list above. These are REAL people who ACTUALLY DIED on this day.
- NEVER invent death dates. NEVER say someone died in 2026 — that would mean they died THIS YEAR which is almost certainly FALSE.
- The format MUST be: "Name (b. DD.MM.YYYY † DD.MM.YYYY)" — showing FULL birth and death DATES, not just years.
- Example: "Nick Cordero (b. 17.09.1978 † 05.07.2020)" — NOT "RZA (b. 1969 † 2026)" (RZA is ALIVE!)
- The death date is ALWAYS today's day/month (e.g. 05.07) + the year they actually died (e.g. 2020).
- If the deaths list is empty or has no GenX-relevant people, say so honestly. Do NOT make up deaths.
- RIP articles are tributes to people who died ON THIS DAY in a PAST YEAR — not people dying today.

CONTENT TYPES for the 3 homepage slots (pick the best mix, not always 3 articles):
- Article = written feature piece
- Rankroll = voting/ranking poll e.g. "Top 10 GenX movies of the 90s"
- TV = 3 curated YouTube clips on the topic
- Menschen = celebrity profile card

STANDARD STRUCTURE — birthday campaigns with many reporters:
- Generate ONE proposal per reporter — that means 7 proposals if there are 7 reporters.
- Each reporter MUST have a DIFFERENT person/topic. NO duplicates.
- For birthday: each article reporter picks a DIFFERENT person from the confirmed birthday list above.
- Spread across categories: sport, cinema, music, TV, comedy, etc.
- Mix task types: some Articles, some Rankrolls, some TV, some Menschen.
- If fewer than 7 people are on the birthday list, supplement with anniversary/history topics related to today.

STANDARD STRUCTURE — non-birthday campaigns:
1 Article + 1 Rankroll + 1 TV = exactly 3 tasks total.
- The Article covers the campaign topic
- The Rankroll ranks something related to the campaign topic
- The TV finds clips related to the campaign topic — same subject as the article, not a new angle

PLAN TOPIC RULES — apply to every campaign, not just birthdays:
- Topics must be SPECIFIC. Include real names, real dates, real events, real angles.
- WRONG: "GenX Movie Icons Birthday" / "Celebrating GenX Musicians" / "Sports Legends Feature"
- RIGHT: "Paolo Maldini (1968) — Football Legend" / "How Kurt Cobain Changed Alt-Rock Forever" / "Mike Tyson's Greatest Knockouts — Top 10"
- ⛔ NEVER use Ethan Hawke, Derek Jeter, or George Michael as defaults — only use them if they appear in today's confirmed birthday list above.
- For birthday campaigns: name the exact person born tomorrow in each category area (sport / cinema-tv / music — one each).
- For history/anniversary campaigns: name the exact event and year.
- For ranking campaigns: name the specific subject of the ranking.
- If you genuinely don't know a specific name, pick the best educated angle — but never leave a topic generic.

TV CLIPS RULE:
- There is always exactly ONE TV task per campaign.
- The TV topic must be the campaign topic itself — list the birthday people or campaign subject. NEVER invent a new unrelated angle for TV.
- WRONG: "The Rise and Fall of '90s Sitcom Stars" (unrelated new angle)
- RIGHT: "Birthday clips: [Person1], [Person2], [Person3]" or just the campaign topic verbatim.

SPEAKING RULES:
- ONLY Frank, Kristina, and Jolie speak — in that order. All others are silent in the chat but may appear in plan assignments.
- 1 sentence each. No filler, no "shall I", no "perhaps we could", no "I think we should".
- Be direct: pitch the concrete idea, name the person/event. No meeting-room warm-up talk.
- Jolie always closes with ONLY this block (no text after it):

📋 PLAN:
1. [topic — specific person/event] → [Article/Rankroll/TV/Menschen] → [ReporterFirstName]
2. [different topic — different person] → [Article/Rankroll/TV/Menschen] → [ReporterFirstName]
... (one line per reporter, all reporters assigned, each a unique topic)

CEO, ready to run.`;

    const systemPrompt = isFollowUp
      ? `You are a journalist in an editorial team chat. The CEO just sent a message — you MUST respond to exactly what they said.\n\nCRITICAL RULES:\n- If the CEO asked a question, ANSWER IT directly. Do not dodge, deflect, or change the subject.\n- If the CEO criticised something (e.g. "why always Top 10?"), acknowledge the critique and propose a concrete alternative.\n- Never just make a general comment about the campaign topic — always respond to the CEO's actual words.\n- 1 sentence each. No filler. No "I think", no "perhaps".\n\nToday: ${todayStr}. Campaign: "${campaignTopic}".\n\nOnly Frank, Kristina, or Jolie may reply — pick 1-2 of them max. Output ONLY JSON:\n[{"reporterId":"id","name":"Name","content":"message"},...]`
      : `You are simulating a real editorial team meeting. The CEO just dropped a short brief — your job is to run with it.\n\n${fullKnowledge}\n\n${reporterKnowledge}\n\nOutput ONLY valid JSON:\n{"messages":[{"reporterId":"id","name":"Name","content":"message"},...],"proposedAssignments":[{"name":"ReporterFullName","taskType":"article|rankroll|tv|menschen","topic":"specific topic"},...]}`;

    const birthEnforcement = todayCtx.birthList.length
      ? `\n\n🚫 CONFIRMED GenX BIRTHDAY LIST — USE ONLY THESE NAMES, NO OTHERS:\n${todayCtx.birthList.map((b, i) => `${i + 1}. ${b}`).join('\n')}\n\n⚠️ MANDATORY FORMAT: Use DD.MM.YYYY format. Example topic: "Paolo Maldini (26.06.1968) — Football Legend". NEVER write just a year like "(1968)". The full date must appear so editors can instantly verify it.`
      : '';

    // For RIP campaigns, prefer todayCtx.deathList (people who died ON THIS DAY in past years)
    // Fall back to deathsCtx.nameList (recent GenX deaths) if today's list is empty
    const deathListToUse = todayCtx.deathList.length > 0 ? todayCtx.deathList : deathsCtx.nameList;
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const deathEnforcement = deathListToUse.length
      ? `\n\n🚫 CONFIRMED DEATHS ON THIS DAY (${dd}.${mm}) — USE ONLY THESE PEOPLE, NO OTHERS:\n${deathListToUse.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\n⚠️ MANDATORY FORMAT: "Name (b. DD.MM.YYYY † DD.MM.YYYY)" with FULL dates. Example: "Nick Cordero (b. 17.09.1978 † 05.07.2020)". The death date is ALWAYS ${dd}.${mm} + the year they died. NEVER use 2026 as death year. NEVER invent deaths.`
      : '\n\n⚠️ NO CONFIRMED DEATHS found for this day. Do NOT invent any deaths. Suggest alternative content instead.';

    // Only add enforcement sections for relevant campaigns
    const birthdaySection = isBirthdayCampaign ? birthEnforcement : '';
    const deathSection = isDeathCampaign ? deathEnforcement : '';
    
    const userContent = isFollowUp
      ? `Campaign: "${campaignTopic}"\n\nTeam:\n${teamList}\n\nConversation:\n${(history || []).map(m => `${m.isUser ? 'CEO' : m.name}: ${m.content}`).join('\n')}\n\nCEO just said: "${userMessage}"`
      : `Campaign brief from CEO: "${campaignTopic}"\n\nTeam has ${reporters.length} reporters — generate EXACTLY ${reporters.length} proposals, one per reporter, each with a UNIQUE topic and person. No duplicates.${birthdaySection}${deathSection}\n\nTeam (speak in this order):\n${teamList}`;

    // Lower temperature for birthday/death campaigns to enforce factual compliance
    const temp = ((isBirthdayCampaign || isDeathCampaign) && !isFollowUp) ? 0 : 0.9;
    const completion = await openai.chat.completions.create({
      model: isFollowUp ? 'gpt-4o-mini' : 'gpt-4o',
      temperature: temp,
      max_tokens: isFollowUp ? 300 : 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    });

    const raw = (completion.choices[0]?.message?.content || '').replace(/```json|```/g, '').trim();

    // Try object format first: { messages: [...], proposedAssignments: [...] }
    const objMatch = raw.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        const parsed = JSON.parse(objMatch[0]);
        if (Array.isArray(parsed.messages)) {
          // Post-process: strip proposals with birth years outside GenX range (1965-1980)
          const rawAssignments = parsed.proposedAssignments || [];
          const validatedAssignments = (isBirthdayCampaign || isDeathCampaign)
            ? rawAssignments.filter((pa: any) => {
                const topic = pa.topic || '';
                const tt = (pa.taskType || '').toLowerCase();
                // Rankroll/TV always pass
                if (tt === 'rankroll' || tt === 'tv') return true;
                // Birth-year check — reject anything clearly outside GenX (1965-1980)
                const yearMatch = topic.match(/\bb\.?\s*~?\s*(1\d{3})\b/i)
                  || topic.match(/born[^,\d]*,?\s*(1\d{3})/i)
                  || topic.match(/\((\d{4})\)/);
                if (!yearMatch) return true; // no year = allow (rankroll etc. with no person)
                const year = parseInt(yearMatch[1]);
                return year >= 1965 && year <= 1980;
              })
            : rawAssignments;
          const assignments = (validatedAssignments).map((pa: any) => {
            const topic = (pa.topic || '').toLowerCase();
            // Respect explicit taskType from AI first, then fall back to keyword detection
            let taskType = (pa.taskType || 'article').toLowerCase();
            if (!['article','rankroll','tv','menschen'].includes(taskType)) {
              if (/rankroll|ranking|vote|top \d+/i.test(topic)) taskType = 'rankroll';
              else if (/\btv\b|youtube|video|clips?/i.test(topic)) taskType = 'tv';
              else if (/menschen|people|profile|celebrity card/i.test(topic)) taskType = 'menschen';
              else taskType = 'article';
            }
            return { ...pa, taskType };
          });
          return NextResponse.json({ success: true, messages: parsed.messages, proposedAssignments: assignments });
        }
      } catch { /* fall through to array parse */ }
    }

    // Fallback: plain array
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    if (!arrMatch) return NextResponse.json({ success: false, error: 'Parse failed' }, { status: 500 });
    const messages = JSON.parse(arrMatch[0]);
    return NextResponse.json({ success: true, messages, proposedAssignments: [] });
  } catch (err: any) {
    console.error('[group-brief] ERROR:', err);
    console.error('[group-brief] Stack:', err.stack);
    return NextResponse.json({ success: false, error: err.message, stack: err.stack }, { status: 500 });
  }
}
