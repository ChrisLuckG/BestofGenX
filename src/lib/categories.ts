/**
 * SINGLE SOURCE OF TRUTH for all content categories.
 * Change labels, colors, or mappings here — updates everywhere automatically.
 */

export interface CategoryDef {
  slug: string;       // Canonical DB value
  label: string;      // Display label shown to users
  color: string;      // Hex accent color
  /** Legacy/alias DB slugs that should display as this category */
  aliases?: string[];
  /** Container name keyword regex that triggers this category's auto-fill */
  keywords: RegExp;
}

export const CATEGORIES: CategoryDef[] = [
  {
    slug: 'history',
    label: 'History',
    color: '#E36B11',
    keywords: /history|war|revolution|past|century|historic|this day/,
  },
  {
    slug: 'sports',
    label: 'Sport',
    color: '#C0392B',
    keywords: /sport|football|soccer|basketball|boxing|tennis|athlete|champion|winner/,
  },
  {
    slug: 'music',
    label: 'Music',
    color: '#15803D',
    keywords: /music|song|band|concert|artist|album|guitar|drum|radio/,
  },
  {
    slug: 'movies-tv',
    label: 'TV & Cinema',
    color: '#1D4ED8',
    aliases: ['genx-icons'],
    keywords: /movie|film|cinema|screen|serie|series|tv|television|show|actor|actress|director|stream/,
  },
  {
    slug: 'gaming',
    label: 'Gaming & Tech',
    color: '#A21CAF',
    aliases: ['tech'],
    keywords: /game|gaming|arcade|trivia|esport|console|playstation|xbox|nintendo|tech|computer|software|digital|gadget/,
  },
  {
    slug: 'lifestyle',
    label: 'Lifestyle & Culture',
    color: '#db2777',
    aliases: ['culture'],
    keywords: /lifestyle|travel|food|fashion|style|culture|living|wellness/,
  },
  {
    slug: 'news',
    label: 'Politics',
    color: '#334155',
    keywords: /news|breaking|update|current|politic|election|world|politik/,
  },
  {
    slug: 'rip',
    label: 'RIP',
    color: '#4b5563',
    keywords: /rip|memorial|obituary|died|death|passed|legend|tribute/,
  },
  {
    slug: 'eastercorn',
    label: 'Eastercorn',
    color: '#1E3A8A',
    keywords: /eastercorn/,
  },
];

/** All valid DB slugs (canonical + aliases) — used for API validation */
export const VALID_CATEGORY_SLUGS: string[] = CATEGORIES.flatMap(
  c => [c.slug, ...(c.aliases || [])]
);

/**
 * Container/category name -> DB slug. Must stay in sync with the slug written
 * by POST /api/categories, otherwise a container named "EisHockey" and the
 * Category document created for it disagree and auto-fill finds nothing.
 *
 * German umlauts are transliterated rather than stripped: "Fussball" and
 * "Fußball" have to produce the same slug, or renaming a container by typing
 * the ß version silently creates a SECOND category.
 */
export function slugify(input: string): string {
  return (input || '')
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Categories that do not auto-fill the Top Area: History and Arcade/Gaming belong to
 * their own date-based banner sections. Exceptions: an editor-pinned (`featured`)
 * article, and the History and Trivia Winner articles, which join the waterfall -
 * see joinsTopWaterfall() in containerFill.ts.
 */
export const TOP_AREA_EXCLUDED_SLUGS: string[] = ['history', 'gaming', 'tech'];

/** Categories shown in admin UI dropdowns (canonical only, no aliases) */
export const UI_CATEGORIES = CATEGORIES.map(c => ({ value: c.slug, label: c.label }));

/** Container theme → DB slugs — theme on container takes top priority */
const THEME_MAP: Record<string, string[]> = {
  arcade:  ['gaming', 'tech'],
  gaming:  ['gaming', 'tech'],
  sports:  ['sports'],
  music:   ['music'],
  movies:  ['movies-tv', 'genx-icons'],
  history: ['history'],
  culture: ['lifestyle', 'culture'],
  retro:   ['history', 'culture', 'lifestyle'],
  bogx:    ['movies-tv', 'genx-icons', 'rip', 'music'],
};

/**
 * Find the canonical CategoryDef for any DB slug (including legacy aliases).
 */
export function getCategoryDef(slug: string): CategoryDef | undefined {
  return CATEGORIES.find(
    c => c.slug === slug || (c.aliases || []).includes(slug)
  );
}

/**
 * Resolve a human-typed name (a container name, a label) to an existing static
 * category, or undefined if it is genuinely new.
 *
 * Checks three things, because for five of the nine static entries the slug is
 * NOT the slugified label:
 *
 *   slug=sports     label="Sport"               slugify -> sport
 *   slug=movies-tv  label="TV & Cinema"         slugify -> tv-cinema
 *   slug=gaming     label="Gaming & Tech"       slugify -> gaming-tech
 *   slug=lifestyle  label="Lifestyle & Culture" slugify -> lifestyle-culture
 *   slug=news       label="Politics"            slugify -> politics
 *
 * Matching on `slug` alone meant renaming a container to "Sport" created a
 * SECOND, dynamic category 'sport' sitting next to the static 'sports', and
 * both appeared in every dropdown with the identical label "Sport" - with no
 * way to tell which one the articles were on. Same for "Politics" vs 'news'.
 * Both of those are live container names in this project's template.
 */
export function findStaticCategory(name: string): CategoryDef | undefined {
  const slug = slugify(name);
  if (!slug) return undefined;
  return CATEGORIES.find(
    c =>
      c.slug === slug ||
      slugify(c.label) === slug ||
      (c.aliases || []).includes(slug)
  );
}

export function getCategoryLabel(slug: string): string {
  return getCategoryDef(slug)?.label ?? slug;
}

export function getCategoryColor(slug: string): string {
  return getCategoryDef(slug)?.color ?? '#334155';
}

/**
 * Quiz topic id -> content category slug.
 *
 * The games use their own ids ('sport', 'film', 'games', 'politik') while the
 * editorial side uses the slugs above. They are deliberately NOT registered as
 * `aliases`, because aliases widen VALID_CATEGORY_SLUGS and would let an article
 * be stored with the slug 'film'.
 */
const TOPIC_TO_SLUG: Record<string, string> = {
  music: 'music',
  sport: 'sports',
  sports: 'sports',
  film: 'movies-tv',
  movies: 'movies-tv',
  tv: 'movies-tv',
  'tv & movies': 'movies-tv',
  games: 'gaming',
  gaming: 'gaming',
  politik: 'news',
  politics: 'news',
  fashion: 'lifestyle',
};

/**
 * Quiz-only topic colours that don't map to editorial categories.
 * 'all' (Mixed) is a quiz concept, not a content category.
 */
const TOPIC_ONLY_COLORS: Record<string, string> = {
  all: '#E36B11',    // GenX orange for Mixed
  mixed: '#E36B11',
};

/**
 * Accent colour for a quiz topic id. Same colour the editorial surfaces use for
 * that subject, so a Music battle and a Music article are never two different
 * colours - which is exactly what happened while both sides kept their own maps.
 */
export function getTopicColor(topicId: string): string {
  const lower = topicId.toLowerCase();
  // Quiz-only topics (like 'all'/Mixed) have their own colours
  if (TOPIC_ONLY_COLORS[lower]) return TOPIC_ONLY_COLORS[lower];
  return getCategoryColor(TOPIC_TO_SLUG[lower] ?? topicId);
}

/**
 * Given a container name + theme, return which DB slugs to filter articles by.
 * Used by WelcomeReel for MAIN / 2H / FIXED / SLIDER auto-fill.
 */
export function getAutoFillSlugs(containerName?: string, containerTheme?: string): string[] {
  const theme = containerTheme?.toLowerCase() || '';
  const name  = (containerName || '').toLowerCase();

  // Container NAME wins over theme — the theme is only a colour style
  // (e.g. a "HISTORY" container with the orange 'bogx' theme must stay history).
  // Birthday / celebrity containers pull from celebs + RIP + Cinema
  if (/birthday|happy|celeb|icon|star|legend/.test(name)) {
    return ['movies-tv', 'genx-icons', 'rip', 'music', 'sports'];
  }

  // Match against each category's keyword regex
  for (const cat of CATEGORIES) {
    if (cat.keywords.test(name)) return [cat.slug, ...(cat.aliases || [])];
  }

  // No name match → fall back to the theme mapping
  if (THEME_MAP[theme]) return THEME_MAP[theme];

  // Still nothing: treat the container NAME as a category slug. This is what
  // makes dynamically created categories work without a code change - a
  // container renamed to "EisHockey" pulls articles whose category is
  // 'eishockey' (see POST /api/categories, which creates that Category from
  // the same slugify()).
  //
  // Before this existed, a name matching no keyword regex and no theme
  // returned [] and the container rendered EMPTY - indistinguishable from
  // "no articles published yet". Measured on the live template: 'Fussball'
  // and 'EisHockey' both resolved to [], because the sports regex matches
  // the English 'football' and not the German 'fussball'.
  const nameSlug = slugify(containerName || '');
  if (nameSlug) return [nameSlug];

  return [];
}
