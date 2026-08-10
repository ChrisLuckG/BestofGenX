/**
 * Worldwide GenX birthday lookup via the Wikidata SPARQL endpoint.
 *
 * Why this exists: Wikipedia's `onthisday/births` feed is a manually curated,
 * heavily Anglo-centric shortlist. For 07.08. it yields 46 GenX people of whom
 * exactly 3 are politicians (2 usable, both American). Wikidata knows every
 * human with a birth date, so a category-scoped query returns a far larger and
 * genuinely international pool.
 *
 * The query is always scoped by occupation. An unscoped MONTH()/DAY() filter
 * would have to scan every human in Wikidata and reliably times out.
 */

export interface WikidataPerson {
  name: string;
  year: number;
  occupation: string;
  country: string;
  sitelinks: number;
}

/**
 * Category slug → Wikidata occupation classes. The query walks `P279*`
 * (subclass of), so `athlete` also matches footballers, boxers, swimmers …
 */
const OCCUPATION_CLASSES: Record<string, string[]> = {
  politics: ['Q82955', 'Q193391'],              // politician, diplomat
  sports: ['Q2066131'],                          // athlete
  music: ['Q639669', 'Q177220'],                 // musician, singer
  'movies-tv': ['Q33999', 'Q2526255', 'Q578109'],// actor, film director, TV presenter
  culture: ['Q36180', 'Q1930187'],               // writer, journalist
  news: ['Q1930187'],                            // journalist
  tech: ['Q5482740', 'Q131524'],                 // programmer, entrepreneur
};

const GENX_FROM = 1965;
const GENX_TO = 1980;

// WDQS throttles anonymous clients hard and requires a descriptive User-Agent
// with a contact address, otherwise it answers 429.
const USER_AGENT = 'BOGX-Editorial/1.0 (https://bestofgenx.com; contact@bestofgenx.com)';
const ENDPOINT = 'https://query.wikidata.org/sparql';

// Wikidata only changes slowly and this is a per-day lookup, so an in-memory
// cache per (day, category) keeps the conference snappy.
const cache = new Map<string, WikidataPerson[]>();

export function hasWikidataCategory(category?: string | null): boolean {
  return !!category && !!OCCUPATION_CLASSES[category.toLowerCase()];
}

function buildQuery(month: number, day: number, classes: string[]): string {
  const values = classes.map(q => `wd:${q}`).join(' ');
  return `
SELECT ?personLabel ?birthDate ?sitelinks ?occupationLabel ?countryLabel WHERE {
  VALUES ?occClass { ${values} }
  ?person wdt:P31 wd:Q5;
          wdt:P106/wdt:P279* ?occClass;
          wdt:P569 ?birthDate;
          wikibase:sitelinks ?sitelinks.
  FILTER(MONTH(?birthDate) = ${month} && DAY(?birthDate) = ${day})
  FILTER(YEAR(?birthDate) >= ${GENX_FROM} && YEAR(?birthDate) <= ${GENX_TO})
  FILTER(?sitelinks >= 3)
  OPTIONAL { ?person wdt:P106 ?occupation. }
  OPTIONAL { ?person wdt:P27 ?country. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?sitelinks)
LIMIT 400
`;
}

/**
 * Returns GenX (1965–1980) people born on `month`/`day` for the given category,
 * most prominent first (Wikidata sitelink count as the popularity proxy).
 * Returns an empty array for unmapped categories or on any failure — callers
 * keep their existing Wikipedia list as the fallback.
 */
export async function fetchWikidataBirthdays(
  month: number,
  day: number,
  category?: string | null
): Promise<WikidataPerson[]> {
  const slug = (category || '').toLowerCase();
  const classes = OCCUPATION_CLASSES[slug];
  if (!classes) return [];

  const cacheKey = `${month}-${day}-${slug}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const body = 'query=' + encodeURIComponent(buildQuery(month, day, classes));

    // POST + one retry on 429/503 — the endpoint rate-limits bursts, and the
    // conference fires several reporter requests in quick succession.
    let res: Response | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) break;
      if (attempt === 2) break;
      const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
      await new Promise(r => setTimeout(r, retryAfter ? retryAfter * 1000 : 3000));
    }

    if (!res || !res.ok) {
      console.error(`[Wikidata birthdays] HTTP ${res?.status} for ${slug}`);
      return [];
    }

    const data = await res.json();
    const rows = data.results?.bindings || [];

    // Wikidata returns one row per occupation/citizenship combination — collapse per person.
    const seen = new Set<string>();
    const people: WikidataPerson[] = [];

    for (const r of rows) {
      const name = r.personLabel?.value;
      // Unlabelled items come back as their Q-id — useless for an article.
      if (!name || /^Q\d+$/.test(name) || seen.has(name)) continue;
      seen.add(name);

      people.push({
        name,
        year: parseInt(r.birthDate?.value?.substring(0, 4) || '0', 10),
        occupation: r.occupationLabel?.value || 'public figure',
        country: r.countryLabel?.value || '',
        sitelinks: parseInt(r.sitelinks?.value || '0', 10),
      });
    }

    console.log(`[Wikidata birthdays] ${slug} ${day}.${month}: ${people.length} GenX people`);
    cache.set(cacheKey, people);
    return people;
  } catch (err) {
    console.error('[Wikidata birthdays] query failed:', err);
    return [];
  }
}

/**
 * Formats the pool as a prompt block. `countryFilter` is applied here (not in
 * SPARQL) so a miss can gracefully fall back to the worldwide list instead of
 * returning nothing.
 */
export function formatBirthdayContext(
  people: WikidataPerson[],
  month: number,
  day: number,
  category: string,
  countryFilter?: string,
  covered?: Map<string, { title?: string }>
): string {
  if (!people.length) return '';

  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');

  const matching = countryFilter
    ? people.filter(p => p.country.toLowerCase() === countryFilter.toLowerCase())
    : people;
  const pool = matching.length ? matching : people;

  // People we already wrote about go to the bottom and are marked, so the
  // reporter naturally reaches for fresh names first.
  const isCovered = (name: string) => !!covered?.has(name);
  const fresh = pool.filter(p => !isCovered(p.name));
  const done = pool.filter(p => isCovered(p.name));

  const line = (p: WikidataPerson) =>
    `  - ${p.name} (${dd}.${mm}.${p.year}) — ${p.occupation}${p.country ? `, ${p.country}` : ''}`;

  const sections = [fresh.slice(0, 60).map(line).join('\n')];

  if (done.length) {
    const doneLines = done.slice(0, 30).map(p => {
      const title = covered?.get(p.name)?.title;
      const ref = title ? ` — already covered: "${title}"` : ' — already covered';
      return `  ✖ ${p.name} (${dd}.${mm}.${p.year})${ref}`;
    });
    sections.push(`\n🚫 ALREADY COVERED BY BOGX — DO NOT PROPOSE THESE AGAIN:\n${doneLines.join('\n')}`);
  }

  const countryNote = countryFilter && !matching.length
    ? `\n⚠️ Nobody from ${countryFilter} in this list — pick the most prominent person instead.`
    : '';

  return `
================================================================================
🌍 WORLDWIDE ${category.toUpperCase()} BIRTHDAYS ON ${dd}.${mm} — GenX (${GENX_FROM}–${GENX_TO})
Source: Wikidata (complete), ordered by international prominence.
================================================================================
${sections.join('\n')}${countryNote}

✅ PREFER this list over the shorter Wikipedia list — it is complete and global.
🚫 Use ONLY names from this list. The date in brackets is verified.
🚫 NEVER pick a name from the "ALREADY COVERED" block — we published that piece before.
`;
}
