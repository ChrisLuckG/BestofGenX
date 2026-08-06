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
    color: '#dc2626',
    keywords: /sport|football|soccer|basketball|boxing|tennis|athlete|champion|winner/,
  },
  {
    slug: 'music',
    label: 'Music',
    color: '#16a34a',
    keywords: /music|song|band|concert|artist|album|guitar|drum|radio/,
  },
  {
    slug: 'movies-tv',
    label: 'TV & Cinema',
    color: '#b91c1c',
    aliases: ['genx-icons'],
    keywords: /movie|film|cinema|screen|serie|series|tv|television|show|actor|actress|director|stream/,
  },
  {
    slug: 'gaming',
    label: 'Gaming & Tech',
    color: '#7c3aed',
    aliases: ['tech'],
    keywords: /game|gaming|arcade|esport|console|playstation|xbox|nintendo|tech|computer|software|digital|gadget/,
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
    color: '#374151',
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

export function getCategoryLabel(slug: string): string {
  return getCategoryDef(slug)?.label ?? slug;
}

export function getCategoryColor(slug: string): string {
  return getCategoryDef(slug)?.color ?? '#374151';
}

/**
 * Given a container name + theme, return which DB slugs to filter articles by.
 * Used by WelcomeReel for MAIN / 2H / FIXED / SLIDER auto-fill.
 */
export function getAutoFillSlugs(containerName?: string, containerTheme?: string): string[] {
  const theme = containerTheme?.toLowerCase() || '';
  const name  = (containerName || '').toLowerCase();

  if (THEME_MAP[theme]) return THEME_MAP[theme];

  // Birthday / celebrity containers pull from celebs + RIP + Cinema
  if (/birthday|happy|celeb|icon|star|legend/.test(name)) {
    return ['movies-tv', 'genx-icons', 'rip', 'music', 'sports'];
  }

  // Match against each category's keyword regex
  for (const cat of CATEGORIES) {
    if (cat.keywords.test(name)) return [cat.slug, ...(cat.aliases || [])];
  }

  return [];
}
