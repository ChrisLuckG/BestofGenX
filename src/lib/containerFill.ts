import { getAutoFillSlugs } from "@/lib/categories";

// Shared container resolution used by BOTH the live feed (WelcomeReel) and the
// admin template editor (ContainerBlock / ArticlesTab) so they ALWAYS match.
// Implements the waterfall rule: each article appears in exactly one place.

export interface FillArticle {
  _id?: string;
  title?: string;
  coverImage?: string;
  category?: string;
  status?: string;
  createdAt?: string;
  contentType?: string;
  order?: number;  // Manual sort order (lower = higher); drives the Top Area order
}

export interface ResolvedBlock {
  type: string;
  main?: FillArticle | null;     // MAIN / SOCIAL
  left?: FillArticle | null;     // 2H
  right?: FillArticle | null;    // 2H
  vertical?: FillArticle[];      // VERTICAL
}

interface ContainerBlockLike {
  type: string;
  articleId?: string | null;
  articleId2?: string | null;
  articles?: string[];
  autoFillCategory?: string;
  autoFillLimit?: number;
}

const byNewest = (a: FillArticle, b: FillArticle) =>
  new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();

// Top Area: manual drag order (lower = higher) wins, then newest first.
const byTopOrder = (a: FillArticle, b: FillArticle) => {
  const ao = a.order ?? 0, bo = b.order ?? 0;
  if (ao !== bo) return ao - bo;
  return byNewest(a, b);
};

// Date-based banner areas whose WHOLE category belongs to their FIXED banner box and is
// therefore excluded from the global Top Area (mirrors WelcomeReel).
const DATE_BASED_AREAS = new Set(['gaming', 'history']);

/**
 * Categories that belong entirely to a date-based FIXED banner area (Arcade → gaming/tech,
 * History → history). Articles in these categories must NOT flow into the global Top Area.
 */
export function computeBannerCategories(
  templateItems: Array<{ size: number; containerName?: string; containerTheme?: string; containerBlocks?: ContainerBlockLike[] }>
): Set<string> {
  const bannerCategories = new Set<string>();
  templateItems
    .filter(item => item.size === 12 && (item.containerBlocks || []).length > 0)
    .forEach(item => {
      (item.containerBlocks || []).forEach(block => {
        if (block.type !== 'FIXED') return;
        const cats = getAutoFillSlugs(item.containerName, item.containerTheme);
        if (cats.length === 0) return;
        if (DATE_BASED_AREAS.has(cats[0])) cats.forEach(c => bannerCategories.add(c.toLowerCase()));
      });
    });
  return bannerCategories;
}

/**
 * Resolve which articles each block in a container should show, given the set of
 * article IDs already consumed by earlier containers/blocks (waterfall exclusion).
 * Returns the per-block resolution and the updated consumed set.
 */
export function resolveContainer(
  containerName: string | undefined,
  containerTheme: string | undefined,
  blocks: ContainerBlockLike[],
  articles: FillArticle[],
  excludeIds: Set<string>,
  globalScope: boolean = false,
  bannerCategories: Set<string> = new Set()
): { perBlock: ResolvedBlock[]; consumed: Set<string> } {
  const localUsed = new Set<string>(excludeIds);
  const catSlugs = getAutoFillSlugs(containerName, containerTheme);
  const byId = (id?: string | null) => (id ? articles.find(a => a._id === id) || null : null);

  // Feature/banner content (Rankrolls, Community Sound, dedicated banner pages) live only
  // in their own areas/banners — never auto-fill into template cards. This keeps the admin
  // template view in sync with the live frontend feed.
  const NON_FILLABLE_TYPES = new Set(['rankroll', 'music-community', 'banner-page']);
  const isFillable = (a: FillArticle) => a.status === 'published' && !NON_FILLABLE_TYPES.has(a.contentType || 'article');

  // Top container = global newest (any category) EXCEPT date-based banner categories
  // (Arcade gaming/tech, History) which belong only to their banner box. Others = own category.
  const autoPool = globalScope
    ? [...articles].filter(a => isFillable(a) && !bannerCategories.has((a.category || '').toLowerCase())).sort(byTopOrder)
    : (catSlugs.length > 0
        ? [...articles]
            .filter(a => isFillable(a) && catSlugs.includes((a.category || '').toLowerCase()))
            .sort(byNewest)
        : []);

  const perBlock: ResolvedBlock[] = blocks.map((block) => {
    if (block.type === 'MAIN' || block.type === 'SOCIAL') {
      // Auto-fill primary: newest from category waterfalls to top, pinned as fallback
      let main: FillArticle | null = null;
      if (autoPool.length > 0) {
        main = autoPool.find(a => !localUsed.has(a._id || '')) || null;
      }
      if (!main && block.articleId && !localUsed.has(block.articleId)) main = byId(block.articleId);
      if (main?._id) localUsed.add(main._id);
      return { type: block.type, main };
    }

    if (block.type === '2H') {
      let left: FillArticle | null = null;
      let right: FillArticle | null = null;
      if (autoPool.length > 0) {
        const pool = autoPool.filter(a => !localUsed.has(a._id || ''));
        left = pool[0] || null;
        right = pool[1] || null;
      }
      if (!left && block.articleId && !localUsed.has(block.articleId)) left = byId(block.articleId);
      if (!right && block.articleId2 && !localUsed.has(block.articleId2)) right = byId(block.articleId2);
      if (left?._id) localUsed.add(left._id);
      if (right?._id) localUsed.add(right._id);
      return { type: '2H', left, right };
    }

    if (block.type === 'VERTICAL') {
      const cat = (block.autoFillCategory || '').toLowerCase();
      let vertical: FillArticle[] = [];
      if (cat) {
        vertical = [...articles]
          .filter(a => (a.category || '').toLowerCase() === cat && isFillable(a) && a.coverImage && !localUsed.has(a._id || ''))
          .sort(byNewest)
          .slice(0, block.autoFillLimit || 3);
      } else {
        vertical = (block.articles || []).map(id => byId(id)).filter(Boolean) as FillArticle[];
      }
      vertical.forEach(a => { if (a._id) localUsed.add(a._id); });
      return { type: 'VERTICAL', vertical };
    }

    return { type: block.type };
  });

  return { perBlock, consumed: localUsed };
}

/**
 * Compute, for each container index, the set of article IDs consumed by all
 * PRECEDING containers — used by the admin editor to dedup across containers.
 */
export function computeContainerExcludes(
  templateItems: Array<{ size: number; containerName?: string; containerTheme?: string; containerBlocks?: ContainerBlockLike[] }>,
  articles: FillArticle[]
): Record<number, Set<string>> {
  const excludes: Record<number, Set<string>> = {};
  const used = new Set<string>();
  const bannerCategories = computeBannerCategories(templateItems);
  let firstContainerSeen = false;
  templateItems.forEach((item, idx) => {
    if (item.size !== 12) return;
    excludes[idx] = new Set(used);
    const isTop = !firstContainerSeen;
    firstContainerSeen = true;
    const { consumed } = resolveContainer(item.containerName, item.containerTheme, item.containerBlocks || [], articles, used, isTop, bannerCategories);
    consumed.forEach(id => used.add(id));
  });
  return excludes;
}
