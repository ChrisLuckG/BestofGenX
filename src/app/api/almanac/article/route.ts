import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { YouTubeQuotaError } from "@/lib/youtubeSearch";
import { buildYoutubeIframe, findSectionVideo, pendingMarker } from "@/lib/articleVideos";
import { countryNameToCode } from "@/lib/countryFlags";
import { styleInstructionFor, isAuthorVoice, buildOccasionBlock } from "@/lib/authorStylePrompts";
import { fetchWikipediaSource, buildSourceBlock, BANNED_HEADINGS_RULE, VIDEO_PROSE_RULES } from "@/lib/wikipediaSource";
import { articleCategoryFor } from "@/lib/personCategory";

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

// Articles are always long. A caller-supplied `options.length` is ignored on purpose:
// the admin used to offer short (~150) and medium (~300) and the medium result was
// "nothing"; there is no shorter option any more, in the UI or here.
const ARTICLE_LENGTH = 'long (~800 words)';

// Fetch country from Wikidata if missing
async function fetchCountryFromWikidata(name: string, birthYear?: string): Promise<{ country?: string; countryCode?: string } | null> {
  const sparql = `
    SELECT ?countryLabel WHERE {
      ?person wdt:P31 wd:Q5 .
      ?person rdfs:label "${name.replace(/"/g, '\\"')}"@en .
      ${birthYear ? `?person wdt:P569 ?birthDate . FILTER(YEAR(?birthDate) = ${birthYear})` : ''}
      ?person wdt:P27 ?country .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 1
  `;
  
  try {
    const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`;
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'BestOfGenX/1.0',
        'Accept': 'application/sparql-results+json'
      },
      signal: AbortSignal.timeout(8000)
    });
    
    if (!res.ok) return null;
    
    const data = await res.json();
    const results = data.results?.bindings || [];
    
    if (results.length === 0) return null;
    
    let country = results[0].countryLabel?.value || '';
    // Normalize common country names
    if (country === 'United States of America' || country === 'United States') country = 'USA';
    if (country === 'United Kingdom of Great Britain and Northern Ireland' || country === 'United Kingdom') country = 'UK';
    
    return {
      country,
      countryCode: countryNameToCode(country) || ''
    };
  } catch (e) {
    console.error('[Almanac] Wikidata country fetch error:', e);
    return null;
  }
}


type ArticleSection = {
  heading: string | null;
  text: string;
  youtubeSearch?: string;
  year?: number | null;
  /** 1-12. Only needed when two sections share a year - see orderSectionsChronologically. */
  month?: number | null;
};

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** First month named in the text, so a missing `month` field can still be recovered. */
function monthFromText(text: string): number | null {
  const lower = text.toLowerCase();
  let best: { idx: number; month: number } | null = null;
  for (let m = 0; m < MONTH_NAMES.length; m++) {
    const at = lower.indexOf(MONTH_NAMES[m]);
    if (at >= 0 && (!best || at < best.idx)) best = { idx: at, month: m + 1 };
  }
  return best ? best.month : null;
}

/**
 * Put the sections in chronological order, keeping the intro first.
 *
 * The prompt asks for a forward-running life, but asking is not enough: an observed
 * article placed the December 2000 Rockies contract BEFORE the October 2000 Mets
 * playoff run, and joined them with "Fast-forward to 2000" - a transition pointing
 * forwards while the text moved backwards.
 *
 * Sorting in code makes the order a property of the output rather than a hope. Stable
 * on purpose (index tie-break), so sections sharing a year keep the order the model
 * chose, and sections with no usable year keep their relative position too.
 */
function orderSectionsChronologically(sections: ArticleSection[]): ArticleSection[] {
  if (sections.length < 3) return sections;

  // The intro (no heading) always leads - it is the hook and is deliberately out of order.
  const introCount = sections[0] && !sections[0].heading ? 1 : 0;
  const intro = sections.slice(0, introCount);
  const rest = sections.slice(introCount);

  const withIndex = rest.map((s, i) => {
    const blob = `${s.heading || ''} ${s.text || ''}`;
    // Fall back to the first 4-digit year in heading/text when the field is missing:
    // the model does omit it, and dropping such a section to the end would be worse
    // than placing it by what it actually talks about.
    let year = typeof s.year === 'number' && s.year > 1900 ? s.year : null;
    if (year === null) {
      const m = blob.match(/\b(19|20)\d{2}\b/);
      if (m) year = parseInt(m[0], 10);
    }
    // The month only matters within a shared year - which is exactly the reported case:
    // the Rockies contract (December 2000) and the Mets playoff run (October 2000) are
    // both "2000", so a year-only sort leaves them in the wrong order.
    let month = typeof s.month === 'number' && s.month >= 1 && s.month <= 12 ? s.month : null;
    if (month === null) month = monthFromText(blob);
    return { s, i, year, month };
  });

  const anyYear = withIndex.some(x => x.year !== null);
  if (!anyYear) return sections;

  const sorted = [...withIndex].sort((a, b) => {
    if (a.year === null && b.year === null) return a.i - b.i;
    if (a.year === null) return a.i - b.i;   // keep undated where it was
    if (b.year === null) return b.i - a.i;
    if (a.year !== b.year) return a.year - b.year;
    // Same year: order by month when both are known, otherwise keep the model's order.
    if (a.month !== null && b.month !== null && a.month !== b.month) return a.month - b.month;
    return a.i - b.i;
  });

  const label = (x: { year: number | null; month: number | null }) =>
    x.year === null ? '?' : `${x.year}${x.month ? `-${String(x.month).padStart(2, '0')}` : ''}`;
  const moved = sorted.some((x, pos) => x.i !== pos);
  if (moved) {
    console.log('[Almanac] Re-ordered sections chronologically:',
      withIndex.map(label).join(' -> '), '=>', sorted.map(label).join(' -> '));
  }

  return [...intro, ...sorted.map(x => x.s)];
}

// Convert sections to HTML content with YouTube videos (no duplicates!)
// personName is used to verify the video is actually about this person
async function convertSectionsToContent(
  sections: ArticleSection[],
  personName?: string
): Promise<string> {
  console.log('[Almanac] Converting', sections.length, 'sections to content with videos for:', personName);
  const contentParts: string[] = [];
  const usedVideoIds = new Set<string>(); // Track used videos to avoid duplicates
  
  // Once YouTube refuses (daily quota used up), every further section gets a marker instead of a search;
  // the Daily Auto tick fills it in later (lib/articleVideos.ts)
  let quotaGone = false;
  for (const section of sections) {
    // Add heading if present
    if (section.heading) {
      contentParts.push(`<h2>${section.heading}</h2>`);
    }
    
    // Add text content
    contentParts.push(section.text);
    
    // Search for YouTube video if search term provided
    if (section.youtubeSearch) {
      const ctx = [section.heading || '', section.text || ''].join(' ');
      if (quotaGone) { contentParts.push(pendingMarker({ q: section.youtubeSearch, ctx, person: personName })); continue; }
      console.log('[Almanac] Searching YouTube for:', section.youtubeSearch, '| excluding:', usedVideoIds.size, 'videos');
      let youtubeId: string | null = null;
      try {
        youtubeId = await findSectionVideo(section.youtubeSearch, ctx, usedVideoIds, personName);
      } catch (e) {
        if (!(e instanceof YouTubeQuotaError)) throw e;
        console.log('[Almanac] YouTube quota used up - marking the section, the video is filled in later');
        quotaGone = true;
        contentParts.push(pendingMarker({ q: section.youtubeSearch, ctx, person: personName }));
        continue;
      }
      if (youtubeId) {
        console.log('[Almanac] Adding video:', youtubeId);
        usedVideoIds.add(youtubeId); // Track this video
        contentParts.push(buildYoutubeIframe(youtubeId));
      } else {
        console.log('[Almanac] No relevant video found for this section - skipping embed');
      }
    }
  }
  
  return contentParts.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "OpenAI API key not configured" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });
    const { person, options, isItem, itemCategory } = await request.json();

    const subjectName = `${person.firstname}${person.lastname ? ' ' + person.lastname : ''}`;
    console.log(`[Almanac] Generating article for ${subjectName} (${isItem ? itemCategory : 'person'})...`);

    // The chosen author voice. This used to be passed as a bare slug in the user
    // message ("Tone: irvine-welsh") with nothing explaining it, while the system
    // prompt simultaneously demanded "nostalgic, engaging, celebrate GenX culture" -
    // so every article came out in the same uplifting house register regardless of
    // the selection. The brief now leads the system prompt, and the cheerleading
    // instruction is dropped whenever a real voice is picked, because the two
    // actively contradict each other.
    const styleId = options?.tone || 'informative';
    const styleInstruction = styleInstructionFor(styleId);
    const hasVoice = isAuthorVoice(styleId);

    // Source text to write FROM, not from model memory. Only for people: the item
    // branch has no name to verify a page against.
    const wikiSource = isItem
      ? null
      : await fetchWikipediaSource(subjectName, {
          birthYear: person.born ? String(person.born).substring(0, 4) : undefined,
          profession: person.profession,
        });

    const sourceBlock = buildSourceBlock(wikiSource);

    // Why this person, why today. Empty unless today really is the birthday or the
    // day they died - see buildOccasionBlock.
    const occasionBlock = buildOccasionBlock({
      born: person.born,
      died: person.died,
      isItem,
    });

    // System prompt for structured article with sections
    const systemPrompt = `${hasVoice
      ? `You are ghostwriting for BOGX in a specific author's voice. The voice is the point of the piece - hold it in every sentence, including headings.

WRITING VOICE (highest priority, overrides any house tone):
${styleInstruction}`
      : `You are a GenX culture expert writing about GenX icons and cultural moments.

WRITING VOICE:
${styleInstruction}`}

IMPORTANT: Return a JSON object with this EXACT structure:
{
  "title": "Catchy article title",
  "subtitle": "Engaging subtitle",
  "category": "music|sports|movies-tv|gaming|lifestyle|news|rip",
  "tags": ["tag1", "tag2", "tag3"],
  "sections": [
    {"heading": null, "year": null, "month": null, "text": "<p>Opening paragraph. No video is mentioned in the prose, ever.</p>", "youtubeSearch": null},
    {"heading": "Section Title", "year": 1996, "month": 6, "text": "<p>Content naming a concrete work, e.g. <strong>the 1996 Sabres draft</strong>...</p>", "youtubeSearch": "Person Name Sabres 1996 draft"},
    {"heading": "Another Section", "year": 2005, "month": null, "text": "<p>More content, no concrete work named here...</p>", "youtubeSearch": null}
  ]
}

RULES:
- This is a LONG article, about 800 words in total: write 6 sections - an intro of
  80-100 words and every other section 130-170 words - with engaging content.
  Length never justifies a fact the SOURCE does not contain: when the source material
  is thin, write fewer and shorter sections instead of padding or inventing.
- First section has NO heading (null) and "year": null - it's the intro. Open with the
  most surprising fact from the source, NOT the birth date.
- ⛔ "year" IS REQUIRED on every other section: the year that section centres on. The
  sections after the intro MUST run in ascending years - a life told forwards.
  The article is re-sorted by this field before publishing, so a wrong year physically
  moves the section to the wrong place.
- ⛔ "month" (1-12) IS REQUIRED WHENEVER TWO SECTIONS SHARE A YEAR, and otherwise may be
  null. Without it the two cannot be ordered. This is not hypothetical: a contract signed
  in December 2000 and a playoff run in October 2000 are both "2000", and the piece
  presented them in the wrong order.
- ⛔ NEVER write a directional transition. FORBIDDEN: "Fast-forward to", "Flash forward",
  "Let's zip back", "Rewind to", "Earlier that year", "Meanwhile, back in".
  Reason: they hard-code a position and were observed to be flatly wrong - a section
  dated December 2000 was followed by "Fast-forward to 2000" pointing BACKWARDS to the
  previous October. State the year plainly instead ("By the summer of 2000, ...").
- Within one section keep the events in order too: if the contract came after the
  playoff run, write the playoff run first.
- ${BANNED_HEADINGS_RULE}
- Use HTML formatting: <p>, <strong>, <em>, <ul>, <li>
- VIDEO RULES (IMPORTANT!):
${VIDEO_PROSE_RULES}
  - Be SPECIFIC: "Michael Jordan 1998 finals game 6" not just "Michael Jordan"
- For MUSIC: "Artist Name song title official video" or "Artist Name live performance venue year"
- For SPORTS: "Athlete Name best moments championship year"
- For ACTORS: "Actor Name movie title scene year"
- Write in the requested language
- â›” FACTS: only state a club, team, employer, award, title, date or number if it appears
  in the SOURCE section of the user message. If there is no SOURCE, you do not know these
  things - omit them. A short article with real facts beats a long one with invented ones.
  Never borrow a club or competition from a different sport than the subject's.
- Headings must be written in the voice too - a neutral heading over voiced prose
  breaks the piece${hasVoice ? '' : `
- Content should be nostalgic and engaging, but never generic: no "beacon of hope",
  "testament to", "emerged as", "not just X but also Y"`}`;

    const userMessage = isItem
      ? `Write an article about "${subjectName}" (${itemCategory}).
Details: ${person.knownfor || 'a GenX cultural icon'}.
Language: ${options.language || 'English'}
Length: ${ARTICLE_LENGTH}
${options.topic ? `Focus: ${options.topic}` : ''}
${options.extra ? `Extra instructions: ${options.extra}` : ''}`
      : `Write an article about ${subjectName}.
Profession: ${person.profession}
Born: ${person.born || 'unknown'}
Country: ${person.countryBorn || 'unknown'}
Known for: ${person.knownfor || 'various works'}
${person.died ? `Died: ${person.died}` : 'Still alive'}
${sourceBlock}
${occasionBlock}
Language: ${options.language || 'English'}
Length: ${ARTICLE_LENGTH}
${options.topic ? `Focus: ${options.topic}` : ''}
${options.extra ? `Extra instructions: ${options.extra}` : ''}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      // A distinctive voice needs room; the neutral register does not.
      temperature: hasVoice ? 0.95 : 0.7,
      response_format: { type: "json_object" },
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      return NextResponse.json({ success: false, error: "No response from AI" }, { status: 500 });
    }

    try {
      const data = JSON.parse(response);
      
      // Always a canonical slug the category dropdown knows: from the person's own data
      // first, the model's suggestion only when that is silent (lib/personCategory.ts).
      const mappedCategory = articleCategoryFor(person, data.category);
      
      // Convert sections to HTML content with YouTube videos
      let finalContent = '';
      if (data.sections && Array.isArray(data.sections)) {
        console.log(`[Almanac] Processing ${data.sections.length} sections with YouTube search for ${subjectName}...`);
        const ordered = orderSectionsChronologically(data.sections);
        finalContent = await convertSectionsToContent(ordered, subjectName);
        console.log(`[Almanac] Article generated with videos`);
      } else if (data.content) {
        // Fallback to plain content
        finalContent = data.content;
      }
      
      return NextResponse.json({ 
        success: true, 
        title: data.title,
        subtitle: data.subtitle,
        article: finalContent,
        content: finalContent,
        tags: data.tags || [],
        category: mappedCategory,
      });
    } catch (e) {
      console.error('[Almanac] Parse error:', e);
      // Fallback: return raw text as content
      return NextResponse.json({ 
        success: true, 
        article: response,
        content: response,
      });
    }

  } catch (error: any) {
    console.error("Almanac article error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
