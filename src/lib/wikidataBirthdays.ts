/**
 * GenX birthday lookup from the local Person collection (Almanac).
 *
 * Previously this queried the Wikidata SPARQL endpoint live, which was slow
 * (9–55s per query), unreliable (HTTP 504 timeouts, rate limiting), and made
 * the editorial conference depend on an external service. The Person
 * collection now holds ~7000 GenX people, so this module simply reads from
 * MongoDB — instant, reliable, no external calls.
 */

import dbConnect from '@/lib/mongoose';
import { Person } from '@/models/Almanac';

export interface WikidataPerson {
  name: string;
  year: number;
  occupation: string;
  country: string;
  sitelinks: number;
  isDeceased?: boolean;
}

/**
 * Map category slugs to Person.profession values.
 * Person uses: 'Music', 'Actor', 'Sport', 'Politik', 'Art', 'Tech', 'Comedy', 'Model', 'Other'
 */
const CATEGORY_TO_PROFESSION: Record<string, string[]> = {
  politics: ['Politik'],
  sports: ['Sport'],
  music: ['Music'],
  'movies-tv': ['Actor', 'Comedy'],
  culture: ['Art', 'Other'],
  news: ['Other'],
  tech: ['Tech'],
};

const GENX_FROM = 1965;
const GENX_TO = 1980;

// In-memory cache per (day, category) — the data doesn't change during a session.
const cache = new Map<string, WikidataPerson[]>();

export function hasWikidataCategory(category?: string | null): boolean {
  if (!category) return true; // "any" category is valid
  return !!CATEGORY_TO_PROFESSION[category.toLowerCase()];
}

/**
 * Label for the prompt block.
 */
export function birthdayScopeLabel(category?: string | null): string {
  return (category || 'GenX').toUpperCase();
}

/**
 * Returns GenX (1965–1980) people born on `month`/`day` for the given category.
 * Reads from the local Person collection instead of querying Wikidata.
 *
 * Return value:
 *   - `[]`   → no matches found
 *   - `null` → database error (should not happen with local DB)
 */
export async function fetchWikidataBirthdays(
  month: number,
  day: number,
  category?: string | null
): Promise<WikidataPerson[] | null> {
  const slug = (category || '').toLowerCase();
  
  // Build cache key
  const cacheKey = `${month}-${day}-${slug || 'any'}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    await dbConnect();

    // Build date pattern: YYYY-MM-DD where we match MM-DD
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const datePattern = `-${mm}-${dd}`; // e.g. "-08-31"

    // Build query
    const query: any = {
      born: { $regex: datePattern + '$' }, // ends with -MM-DD
      isGenX: { $ne: false }, // include if true or undefined
    };

    // Filter by profession if category specified
    if (slug && CATEGORY_TO_PROFESSION[slug]) {
      query.profession = { $in: CATEGORY_TO_PROFESSION[slug] };
    }

    const docs = await Person.find(query)
      .select('firstname lastname born died profession countryBorn')
      .lean()
      .limit(400);

    const people: WikidataPerson[] = docs.map((doc: any) => {
      const name = `${doc.firstname || ''} ${doc.lastname || ''}`.trim();
      const year = doc.born ? parseInt(doc.born.substring(0, 4), 10) : 0;
      
      return {
        name,
        year,
        occupation: doc.profession || 'public figure',
        country: doc.countryBorn || '',
        sitelinks: 10, // Local DB doesn't have sitelinks, use default
        isDeceased: !!doc.died,
      };
    });

    // Sort by name for consistency (we don't have sitelinks for popularity)
    people.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`[Local birthdays] ${slug || 'any'} ${day}.${month}: ${people.length} GenX people`);
    cache.set(cacheKey, people);
    return people;
  } catch (err) {
    console.error('[Local birthdays] query failed:', err);
    return null;
  }
}

/**
 * Pool for an unrestricted ("any category") birthday request.
 */
export async function fetchWikidataBirthdaysAnyCategory(
  month: number,
  day: number
): Promise<WikidataPerson[] | null> {
  // Just call the main function without a category filter
  return fetchWikidataBirthdays(month, day, null);
}

/**
 * Prompt block for the case where the database could not be reached.
 */
export function formatBirthdayUnavailable(
  month: number,
  day: number,
  category?: string | null
): string {
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return `
================================================================================
⚠️ ${birthdayScopeLabel(category)} BIRTHDAYS ON ${dd}.${mm} — SOURCE UNAVAILABLE
================================================================================
The birthday lookup FAILED (database error). There is NO verified list of
people born on this date available to you right now.

🚫 Do NOT name anyone from memory. Your recall of exact birth dates is not
   reliable and a wrong date is worse than no article.
✅ Reply that the birthday source is currently unavailable and no proposal can
   be made. The editor will retry.
`;
}

/**
 * Formats the pool as a prompt block.
 */
export function formatBirthdayContext(
  people: WikidataPerson[],
  month: number,
  day: number,
  category?: string | null,
  countryFilter?: string,
  covered?: Map<string, { title?: string }>,
  continentFilter?: (country: string) => boolean,
  excludeDeceased: boolean = true
): string {
  const catLabel = birthdayScopeLabel(category);
  
  // For birthday articles, filter out deceased people
  const livingPeople = excludeDeceased ? people.filter(p => !p.isDeceased) : people;
  
  if (!livingPeople.length) {
    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    const deceasedNote = excludeDeceased && people.length > 0
      ? `\n(${people.length} people were born on this date but are deceased — they belong in RIP articles on their death anniversary.)`
      : '';
    return `
================================================================================
🌍 ${catLabel} BIRTHDAYS ON ${dd}.${mm} — GenX (${GENX_FROM}–${GENX_TO})
================================================================================
Source: Local database (complete). Result: NOBODY matches.${deceasedNote}
🚫 Do NOT name anyone from memory — the complete source says there is no one.
✅ Answer that no ${category || 'GenX'} birthday falls on ${dd}.${mm}.
`;
  }

  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');

  const pool = countryFilter
    ? livingPeople.filter(p => {
        const c = p.country.toLowerCase();
        if (!c) return false;
        const wanted = countryFilter.toLowerCase();
        return c.includes(wanted) || wanted.includes(c);
      })
    : continentFilter
      ? livingPeople.filter(p => !!p.country && continentFilter(p.country))
      : livingPeople;

  const originLabel = countryFilter || 'the selected region';

  if (!pool.length) {
    return `
================================================================================
🌍 ${catLabel} BIRTHDAYS ON ${dd}.${mm} — GenX (${GENX_FROM}–${GENX_TO})
================================================================================
⚠️ NOBODY from ${originLabel} was born on this date in this category.
🚫 Do NOT substitute a person from another country/region.
✅ Answer that nothing was found for ${originLabel}.
`;
  }

  // People we already wrote about go to the bottom
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

  const scope = countryFilter || continentFilter ? ` — ${originLabel} ONLY` : ' WORLDWIDE';

  return `
================================================================================
🌍${scope} ${catLabel} BIRTHDAYS ON ${dd}.${mm} — GenX (${GENX_FROM}–${GENX_TO})
Source: Local database (complete), ordered alphabetically.
================================================================================
${sections.join('\n')}

✅ Use names from this list. The date in brackets is verified.
🚫 NEVER pick a name from the "ALREADY COVERED" block — we published that piece before.
`;
}
