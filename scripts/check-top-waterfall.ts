// Asserts the feed waterfall: the Top Area takes the newest three articles (MAIN + 2H),
// History and Trivia Winner (Daily Champions) included; from place 4 on an article falls
// into its own section; every article has exactly one place.
//   npx tsx scripts/check-top-waterfall.ts
import {
  articleSortDate, byFeedOrder, computeBannerCategories, joinsTopWaterfall, resolveContainer,
  type FillArticle,
} from '../src/lib/containerFill';

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`}`);
};

// The layout as in the admin: Top container (MAIN + 2H), a History section (FIXED banner,
// MAIN, SLIDER) and an Arcade section.
const template = [
  { size: 12, containerName: 'BOGXERS', containerTheme: 'cream', containerBlocks: [{ type: 'MAIN' }, { type: '2H' }] },
  { size: 12, containerName: 'History', containerTheme: 'history', containerBlocks: [{ type: 'FIXED' }, { type: 'MAIN' }, { type: 'SLIDER', autoFillCategory: 'history', autoFillLimit: 20 }] },
  { size: 12, containerName: 'Arcade', containerTheme: 'arcade', containerBlocks: [{ type: 'FIXED' }, { type: 'MAIN' }] },
];

/** Resolve the whole layout like the feed does; returns where each article landed. */
function place(articles: FillArticle[]) {
  const banner = computeBannerCategories(template);
  const used = new Set<string>();
  const where: Record<string, string> = {};
  let first = true;
  for (const item of template) {
    const { perBlock, consumed } = resolveContainer(item.containerName, item.containerTheme, item.containerBlocks as any, articles, used, first, banner);
    first = false;
    const ids: string[] = [];
    for (const b of perBlock) {
      if (b.main?._id) ids.push(b.main._id);
      if (b.left?._id) ids.push(b.left._id);
      if (b.right?._id) ids.push(b.right._id);
      (b.vertical || []).forEach(a => a._id && ids.push(a._id));
    }
    ids.forEach(id => { where[id] = where[id] ? `${where[id]}+${item.containerName}` : item.containerName; });
    consumed.forEach(id => used.add(id));
  }
  return where;
}

let n = 0;
const at = (hour: number, min = 0) => `2026-10-18T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00Z`;
const art = (id: string, category: string, when: string, extra: Partial<FillArticle> = {}): FillArticle =>
  ({ _id: id, title: id, category, status: 'published', coverImage: 'x', createdAt: when, publishedAt: when, order: 0, ...extra, ...(n++ ? {} : {}) });

// --- the rule itself ---
eq('history joins the waterfall', joinsTopWaterfall({ category: 'history' }), true);
eq('Daily Champions (gaming + daily-winners tag) joins it', joinsTopWaterfall({ category: 'gaming', tags: ['daily-winners', 'rankings'] }), true);
eq('an ordinary gaming article does NOT', joinsTopWaterfall({ category: 'gaming', tags: ['reviews'] }), false);
eq('tech does NOT', joinsTopWaterfall({ category: 'tech' }), false);

// --- waterfall: place 1-3 on top, then into the section ---
const base = [
  art('sports-1', 'sports', at(7)),
  art('movies-1', 'movies-tv', at(7, 30)),
  art('hist-old1', 'history', at(6)),
  art('hist-old2', 'history', at(5)),
  art('hist-old3', 'history', at(4)),
];
const withNewHistory = [...base, art('hist-new', 'history', at(11))];
let w = place(withNewHistory);
eq('newest article (History, 11:00) takes Top place 1', w['hist-new'], 'BOGXERS');
eq('it is NOT also shown in the History section', w['hist-new']?.includes('History'), false);
eq('History section shows the next older history article instead', w['hist-old1']?.includes('History'), true);
eq('places 2 and 3 are the next newest', [w['movies-1'], w['sports-1']], ['BOGXERS', 'BOGXERS']);

// two more arrive -> hist-new is now place 3, one more -> place 4: falls into History
const after2 = [...withNewHistory, art('n1', 'music', at(12)), art('n2', 'culture', at(13))];
eq('still on top at place 3', place(after2)['hist-new'], 'BOGXERS');
const after3 = [...after2, art('n3', 'sports', at(14))];
w = place(after3);
eq('at place 4 it falls into its History section', w['hist-new']?.startsWith('History'), true);
eq('and is not on top any more', w['hist-new']?.includes('BOGXERS'), false);

// --- Trivia Winner ---
const winners = art('winners', 'gaming', at(10), { tags: ['daily-winners', 'rankings'] });
w = place([...base, winners]);
eq('Daily Champions takes a Top place when newest', w['winners'], 'BOGXERS');
const plainGaming = art('gaming-news', 'gaming', at(10, 5), { tags: ['reviews'] });
w = place([...base, plainGaming]);
eq('a plain gaming article stays out of the Top Area', w['gaming-news']?.includes('BOGXERS') ?? false, false);
const w4 = place([winners, art('a', 'music', at(11)), art('b', 'culture', at(12)), art('c', 'sports', at(13))]);
eq('Daily Champions falls to Arcade from place 4', w4['winners'], 'Arcade');

// --- every article has exactly one place ---
const all = [...after3, winners, plainGaming];
const placed = place(all);
eq('no article appears twice', Object.values(placed).filter(v => v.includes('+')).length, 0);

// --- ordering: go-live, not creation ---
const drafted = art('daily-auto', 'movies-tv', at(12), { createdAt: at(10) });   // written 10:00, live 12:00
const manual = art('manual', 'sports', at(11, 30), { createdAt: at(11, 30) });   // created and published 11:30
eq('go-live time orders the Daily Auto article above a manual one made in between',
  [drafted, manual].sort(byFeedOrder).map(a => a._id), ['daily-auto', 'manual']);
eq('an editor-set scheduledAt still wins over publishedAt',
  articleSortDate({ scheduledAt: at(20), publishedAt: at(9), createdAt: at(8) }), new Date(at(20)).getTime());
eq('a draft (no publishedAt) falls back to createdAt', articleSortDate({ createdAt: at(8) }), new Date(at(8)).getTime());
eq('manual drag order still beats date', [art('dated', 'sports', at(15)), art('pinned', 'sports', at(1), { order: -1 })].sort(byFeedOrder).map(a => a._id), ['pinned', 'dated']);

// --- starred (featured) articles are unchanged ---
w = place([...base, art('starred-gaming', 'gaming', at(9), { featured: true, tags: [] })]);
eq('a starred gaming article still reaches the Top Area', w['starred-gaming'], 'BOGXERS');

console.log(failed ? `\n${failed} FAILED` : '\nall ok');
process.exit(failed ? 1 : 0);
