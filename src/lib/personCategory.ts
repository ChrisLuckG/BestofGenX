// Which category an article about a person is filed under.
// Order: a specific Person.category, then the profession, then a catch-all Person.category,
// then the model's suggestion, then Lifestyle.
//
// The article route used to ask the model for a category and store whatever came back,
// mapped to 'culture' / 'genx-icons' / 'tech'. Those are ALIASES in lib/categories.ts: the
// category dropdown only lists the canonical slugs, so such an article showed "-" in the
// Post Manager and fell back to the first dropdown entry (History) in the editor.
//
// Now the result is always a canonical slug, and it comes from the person first: the
// curated `category` / `profession` fields say more than a model guess. The model's
// suggestion only fills the gap when the data is silent ("Other", "unknown").
//
// Dependency-free apart from categories.ts (pure data), so server and client can use it.
import { getCategoryDef } from './categories';

/** Person.category values that name a real subject - trusted over everything else */
const FROM_SPECIFIC_CATEGORY: Record<string, string> = {
  sports: 'sports',
  music: 'music',
  'movies-tv': 'movies-tv',
  politics: 'news',
  gaming: 'gaming',
};
/** Catch-all buckets (the import default is "culture"): they only apply when the profession
 *  says nothing more specific - a comedian filed under "culture" is TV & Cinema, not Lifestyle */
const FROM_GENERIC_CATEGORY: Record<string, string> = {
  lifestyle: 'lifestyle',
  culture: 'lifestyle',
  authors: 'lifestyle',
};

/** Person.profession (the enum) -> article category */
const FROM_PROFESSION: Record<string, string> = {
  music: 'music',
  actor: 'movies-tv',
  comedy: 'movies-tv',
  sport: 'sports',
  politik: 'news',
  art: 'lifestyle',
  tech: 'gaming',
  model: 'lifestyle',
};

/** Words the model uses that are not slugs */
const SUGGESTION_ALIASES: Record<string, string> = {
  movies: 'movies-tv', tv: 'movies-tv', obituary: 'rip', memorial: 'rip', tribute: 'rip',
};
/** "General icon" answers carry no information about the category */
const NO_OPINION = new Set(['genx-icons', 'icons', 'people', 'person']);
/** Never the home of a person article: History/Eastercorn are banner areas */
const NOT_FOR_PEOPLE = new Set(['history', 'eastercorn']);

export interface CategoryPerson {
  category?: string;
  profession?: string;
  died?: string;
}

export function articleCategoryFor(person: CategoryPerson | undefined, suggested?: string): string {
  const alive = !person?.died;

  const fromData =
    FROM_SPECIFIC_CATEGORY[(person?.category || '').toLowerCase()] ||
    FROM_PROFESSION[(person?.profession || '').toLowerCase()] ||
    // The older imports stored the sport itself as the profession ("football", "tennis", ...)
    (person?.profession && person.profession.toLowerCase() !== 'other' ? 'sports' : undefined) ||
    FROM_GENERIC_CATEGORY[(person?.category || '').toLowerCase()];
  if (fromData) return fromData === 'rip' && alive ? 'lifestyle' : fromData;

  const raw = (suggested || '').toLowerCase().trim();
  if (raw && !NO_OPINION.has(raw)) {
    const slug = getCategoryDef(SUGGESTION_ALIASES[raw] || raw)?.slug;
    if (slug && !NOT_FOR_PEOPLE.has(slug) && !(slug === 'rip' && alive)) return slug;
  }
  return 'lifestyle';
}
