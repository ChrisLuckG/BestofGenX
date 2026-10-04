/**
 * Verified Wikipedia source material for article generation, and the prompt blocks that
 * go with it. Single definition, used by every route that writes an article.
 *
 * Dependency-free (no mongodb, no models) so it is safe to import anywhere.
 *
 * WHY THIS EXISTS
 * Without source text the article routes were handed a name, a profession and a birth
 * year, and then told to produce "a specific moment, quote or anecdote" per section.
 * That does not yield a thin article, it yields a WRONG one - the model has to invent
 * the specifics. Measured: Marco Sturm (ice hockey) was described as playing for
 * Schalke 04, a football club, and as being drafted by Buffalo in 1995 when it was
 * San Jose in 1996.
 *
 * THE VERIFICATION IS THE IMPORTANT HALF
 * Handing over the WRONG page is worse than handing over nothing, because the invented
 * facts then look sourced. "Marco Sturm", "Chris Powell" and "Thorsten Schmidt" all
 * match several people in different fields. So a candidate page is only accepted when
 * its text independently corroborates the record we already hold - the birth year, or
 * failing that a profession word. Otherwise this returns null and the prompt is told
 * plainly that no source exists, the same contract as formatBirthdayUnavailable() in
 * lib/wikidataBirthdays.ts.
 */

export interface WikipediaSource {
  title: string;
  url: string;
  extract: string;
}

/**
 * Words that should occur in the article of the right person.
 * Keyed by BOTH the Menschen `profession` values and the article `category` slugs,
 * because the two callers use different vocabularies for the same thing.
 */
const PROFESSION_HINTS: Record<string, string[]> = {
  // Menschen professions
  Sport: ['player', 'athlete', 'footballer', 'hockey', 'boxer', 'coach', 'olympic', 'club', 'team'],
  Music: ['singer', 'musician', 'band', 'album', 'songwriter', 'rapper', 'guitarist'],
  Actor: ['actor', 'actress', 'film', 'television', 'movie', 'starred'],
  Politik: ['politician', 'minister', 'party', 'parliament', 'senator', 'president'],
  Art: ['artist', 'painter', 'sculptor', 'gallery', 'designer', 'photographer'],
  Tech: ['engineer', 'programmer', 'founder', 'software', 'entrepreneur', 'computer'],
  Comedy: ['comedian', 'comedy', 'stand-up', 'sketch'],
  Model: ['model', 'fashion', 'runway'],
  // Article categories
  sports: ['player', 'athlete', 'footballer', 'hockey', 'boxer', 'coach', 'olympic', 'club', 'team'],
  music: ['singer', 'musician', 'band', 'album', 'songwriter', 'rapper', 'guitarist'],
  'movies-tv': ['actor', 'actress', 'film', 'television', 'movie', 'director', 'starred'],
  gaming: ['game', 'developer', 'studio', 'console', 'esports'],
  politics: ['politician', 'minister', 'party', 'parliament', 'senator', 'president'],
  tech: ['engineer', 'programmer', 'founder', 'software', 'entrepreneur', 'computer'],
  lifestyle: ['chef', 'designer', 'model', 'fashion', 'travel', 'author', 'writer'],
};

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const UA = { 'User-Agent': 'BestOfGenX/1.0' };

/** Extract for the accepted page. Generous, because the interesting material (odd
 *  transfer, injury, fallout) sits in the BODY, not the intro. A 6000-char cut left the
 *  story-building step with little more than a summary - measured on Marco Sturm, whose
 *  article is 13181 chars, so more than half was being discarded. */
const MAX_EXTRACT_CHARS = 14000;

export async function fetchWikipediaSource(
  name: string,
  opts: { birthYear?: string; profession?: string } = {}
): Promise<WikipediaSource | null> {
  const { birthYear, profession } = opts;
  if (!name || name.trim().length < 3) return null;

  try {
    // srlimit 6, not 4: for a common name the right page can sit behind a namesake
    // plus a disambiguation page plus a list article. Kyle Snyder needed rank 3.
    const searchUrl = `${WIKI_API}?action=query&list=search&srsearch=${encodeURIComponent(name)}&srlimit=6&format=json&origin=*`;
    const searchRes = await fetch(searchUrl, { headers: UA, signal: AbortSignal.timeout(8000) });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const candidates: string[] = (searchData.query?.search || []).map((s: any) => s.title);
    if (candidates.length === 0) return null;

    const hints = profession ? (PROFESSION_HINTS[profession] || []) : [];

    for (const title of candidates) {
      const extractUrl = `${WIKI_API}?action=query&prop=extracts|pageprops&explaintext=1&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`;
      const res = await fetch(extractUrl, { headers: UA, signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = await res.json();
      const page: any = Object.values(data.query?.pages || {})[0];
      const extract: string = page?.extract || '';
      if (extract.length < 200) continue;

      // Disambiguation pages must be skipped, not accepted.
      //
      // "Kyle Snyder" is a list of three people, and because one of the LINES reads
      // "(born 1977)" it satisfied the birth-year check and was accepted as the source
      // - 252 characters of nothing, which also stopped the loop before it reached
      // "Kyle Snyder (baseball)". pageprops.disambiguation is the authoritative marker;
      // the text check catches the few pages that lack the property.
      if (page?.pageprops?.disambiguation !== undefined || /\bmay refer to\b/i.test(extract.slice(0, 200))) {
        console.log(`[WikiSource] Skipping disambiguation page "${title}" for ${name}`);
        continue;
      }

      const yearOk = !!birthYear && extract.includes(String(birthYear));
      const lower = extract.toLowerCase();
      const professionOk = hints.length > 0 && hints.some(h => lower.includes(h));

      // The birth year is the ONLY strong signal. When we have one it must match -
      // the profession words must never substitute for it.
      //
      // Measured failure of the earlier "year OR profession" rule: the Menschen record
      // is Kyle Snyder the MLB pitcher (born 1977, so GenX). The search returned
      // "Kyle Snyder (wrestler)" (born 1995) first, 1977 was absent, but "olympic"
      // matched the Sport hints - so the wrong athlete was accepted and the article
      // came out entirely true about a different man. A same-name page from the same
      // field is exactly what the profession hints CANNOT tell apart, which is why
      // they are only a last resort for records with no birth year at all.
      const corroborated = birthYear ? yearOk : professionOk;
      if (!corroborated) {
        const why = birthYear
          ? `birth year ${birthYear} does not appear`
          : `profession ${profession || '(none)'} not corroborated`;
        console.log(`[WikiSource] Rejecting "${title}" for ${name} - ${why}`);
        continue;
      }

      const acceptedTitle = page.title || title;
      console.log(`[WikiSource] Accepted "${acceptedTitle}" for ${name} (year=${yearOk}, profession=${professionOk})`);
      return {
        title: acceptedTitle,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(acceptedTitle.replace(/ /g, '_'))}`,
        extract: extract.slice(0, MAX_EXTRACT_CHARS),
      };
    }

    console.log(`[WikiSource] No corroborated page for ${name} - writing without a source`);
    return null;
  } catch (e) {
    console.error('[WikiSource] fetch error:', e);
    return null;
  }
}

/**
 * The prompt block: the source itself, the factual limits, and the instruction to
 * actually build a story out of it. Both halves matter - the restrictive half alone
 * produced correct but flat articles, the story half alone produced invented ones.
 */
export function buildSourceBlock(source: WikipediaSource | null): string {
  if (!source) {
    return `
⛔ NO VERIFIED SOURCE IS AVAILABLE for this subject.
- Wikipedia could not be matched to this record, so you do NOT have their career details.
- Do NOT name any club, team, employer, award, title, album, film, date or number from
  memory. Inventing them is worse than omitting them.
- Write only from the fields given above, plus general, clearly-framed context about the
  era and the field. Keep it SHORT - 2 sections is fine.
- If you cannot say anything concrete, say so plainly in the prose rather than filling
  the space with plausible-sounding detail.`;
  }

  return `
================================================================================
SOURCE — Wikipedia: ${source.title}
${source.url}
================================================================================
${source.extract}
================================================================================

⛔ FACTUAL DISCIPLINE — NON-NEGOTIABLE:
- Every club, team, employer, award, title, chart position, date and number you write
  MUST appear in the SOURCE above. If it is not there, you do not know it.
- NEVER assign a club, league or competition from a different sport or field. An ice
  hockey player has never played for a football club.
- If the source is thin, write a SHORTER article. Fewer sections with real facts beats
  more sections with invented ones.

NOW BUILD A STORY OUT OF IT — THIS IS THE ACTUAL JOB:
The source is raw material, not a template. Do NOT summarise it and do not restate it in
Wikipedia's own order and weighting. Wikipedia is already the boring version.

STRUCTURE — A LIFE, IN ORDER, BUT SELECTIVE:
This is a birthday piece: the reader is looking back over someone's life, so the SPINE is
chronological. Chronological ORDER is right. Chronological COMPLETENESS is not, and
chronological HEADINGS ("Early Life", "The Breakthrough", "Legacy") are banned.
1. READ THE WHOLE SOURCE FIRST. Then pick the 3-5 stations that actually carry the life:
   the odd transfer, the exact number, the injury, the fallout, the year everything
   turned, the detail that makes you go "wait, really?".
2. OPEN OUT OF ORDER, ONCE. Lead with the best of those moments as a hook - never with
   the birth date, the single most boring fact available. Then drop back and take the
   life in sequence.
3. From there run FORWARD in time, one section per station, each built around ONE
   concrete moment with the specifics from the source: the opponent, the score, the
   venue, the year, the money. Specifics ARE the story.
   Check the source's dates before you order the sections. An observed article put a
   contract signed in December 2000 BEFORE the playoff run of October 2000 and joined
   them with "Fast-forward to 2000" - forwards in wording, backwards in fact.
   NEVER use a directional transition: no "Fast-forward to", "Flash forward",
   "Let's zip back", "Rewind to", "Meanwhile, back in". State the year plainly.
4. Weight by interest, not by calendar. Skip the dead years - say plainly that nothing
   much happened rather than padding them. Two vivid stations beat six dutiful ones.
5. LAND IN THE PRESENT. Close on where they are TODAY, on this birthday - what they do
   now, what became of it. That is what makes it a reflection on a life rather than a
   career table.
6. Find the tension: what nearly went wrong, what was unlikely, what it cost. If the
   source only supports a modest story, tell a modest story WELL - a small true detail
   beats a big invented arc.
7. The VOICE does the entertaining, the SOURCE does the facts. Never swap those roles:
   do not invent facts to be entertaining, and do not go flat because you are being
   careful.
- Do not paraphrase the source into vagueness - vague is the other failure mode. "He had
  a successful career" is as bad as an invented club.`;
}

/** Headings that announce nobody thought about the subject. Shared so both routes ban
 *  the same ones - "Early Beginnings: A Passion for the Ice" was a real output. */
export const BANNED_HEADINGS_RULE = `🚫 BANNED HEADINGS - these announce that nobody thought about the subject:
  "Early Beginnings", "Early Life", "The Early Years", "A Passion for the Ice/Game",
  "Rise to Fame", "The Breakthrough", "Career Highlights", "Legacy", "Personal Life",
  "The Later Years", "Final Thoughts".
  A heading must be impossible to reuse for anyone else. Name the thing:
  ✅ "The 1995 Draft Nobody Saw Coming"  ✅ "Three Teams In Eleven Months"
  ❌ "Early Beginnings: A Passion for the Ice"`;

/**
 * The video rules. The prose must never point at a video, because the embed is only
 * added when the relevance gate in lib/youtubeSearch.ts finds something genuinely on
 * topic - and it returns nothing rather than something wrong. A sentence saying "in the
 * clip below" above no clip makes the article look broken.
 */
export const VIDEO_PROSE_RULES = `- ⛔ NEVER refer to the video in the prose. FORBIDDEN: "In the clip below", "the
  following footage", "Watch his legendary performance", "as you can see below",
  "check out the video". Not one word about a video, ever.
- Write every section as plain, self-contained information that reads correctly with
  NO video present.
- Derive "youtubeSearch" FROM A CONCRETE FACT YOU JUST WROTE in that same section —
  the named match, song, film, event or year. You are describing what you already
  said, not announcing something.
  Example — text says: "He was traded to Boston in the Joe Thornton deal in 2005."
  → "youtubeSearch": "Joe Thornton trade 2005 Sharks Bruins"
- Never search for a work named in a DIFFERENT section.
- If a section names no concrete work, match or event, set "youtubeSearch": null
- Aim for 1-2 videos per article MAX, not one per section.`;
