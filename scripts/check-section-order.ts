/**
 * Asserts the chronological re-ordering of article sections.
 *
 * The observed failure: an article about Mike Hampton placed the Colorado Rockies
 * contract of 9 December 2000 BEFORE his October 2000 NLCS MVP run with the Mets, and
 * bridged them with "Fast-forward to 2000" - a transition claiming forward movement
 * while the text moved backwards. The prompt asked for a forward-running life; asking
 * was not enough, so the order is now enforced in code.
 *
 * Run: npx tsx scripts/check-section-order.ts
 */
export {};

type ArticleSection = {
  heading: string | null;
  text: string;
  youtubeSearch?: string;
  year?: number | null;
  month?: number | null;
};

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function monthFromText(text: string): number | null {
  const lower = text.toLowerCase();
  let best: { idx: number; month: number } | null = null;
  for (let m = 0; m < MONTH_NAMES.length; m++) {
    const at = lower.indexOf(MONTH_NAMES[m]);
    if (at >= 0 && (!best || at < best.idx)) best = { idx: at, month: m + 1 };
  }
  return best ? best.month : null;
}

// Mirrors orderSectionsChronologically() in /api/almanac/article.
function orderSectionsChronologically(sections: ArticleSection[]): ArticleSection[] {
  if (sections.length < 3) return sections;
  const introCount = sections[0] && !sections[0].heading ? 1 : 0;
  const intro = sections.slice(0, introCount);
  const rest = sections.slice(introCount);

  const withIndex = rest.map((s, i) => {
    const blob = `${s.heading || ''} ${s.text || ''}`;
    let year = typeof s.year === 'number' && s.year > 1900 ? s.year : null;
    if (year === null) {
      const m = blob.match(/\b(19|20)\d{2}\b/);
      if (m) year = parseInt(m[0], 10);
    }
    let month = typeof s.month === 'number' && s.month >= 1 && s.month <= 12 ? s.month : null;
    if (month === null) month = monthFromText(blob);
    return { s, i, year, month };
  });

  if (!withIndex.some(x => x.year !== null)) return sections;

  const sorted = [...withIndex].sort((a, b) => {
    if (a.year === null && b.year === null) return a.i - b.i;
    if (a.year === null) return a.i - b.i;
    if (b.year === null) return b.i - a.i;
    if (a.year !== b.year) return a.year - b.year;
    if (a.month !== null && b.month !== null && a.month !== b.month) return a.month - b.month;
    return a.i - b.i;
  });

  return [...intro, ...sorted.map(x => x.s)];
}

let failed = 0;
const check = (label: string, got: string, want: string) => {
  if (got === want) { console.log(`ok    ${label}`); return; }
  console.error(`FAIL  ${label}\n        got:  ${got}\n        want: ${want}`);
  failed++;
};
const headings = (s: ArticleSection[]) => s.map(x => x.heading ?? 'INTRO').join(' | ');

// ── the reported case: both sections are the year 2000 ────────────────────────
// December (Rockies contract) was printed BEFORE October (Mets NLCS MVP). A year-only
// sort cannot separate them, which is why `month` exists.
const hampton: ArticleSection[] = [
  { heading: null, year: null, month: null, text: '<p>Hook out of order, on purpose.</p>' },
  { heading: 'The $121 Million Gamble Nobody Saw Coming', year: 2000, month: 12, text: '<p>The Rockies splash out.</p>' },
  { heading: 'NLCS MVP', year: 2000, month: 10, text: '<p>With the Mets.</p>' },
];
check('same year, month decides: October before December',
  headings(orderSectionsChronologically(hampton)),
  'INTRO | NLCS MVP | The $121 Million Gamble Nobody Saw Coming');

// Even with the month field omitted, the month named in the prose recovers the order.
const hamptonNoMonthField: ArticleSection[] = [
  { heading: null, year: null, text: '<p>Hook.</p>' },
  { heading: 'The $121 Million Gamble', year: 2000, text: '<p>December 9, 2000, the Rockies splash out.</p>' },
  { heading: 'NLCS MVP', year: 2000, text: '<p>October 2000 with the Mets.</p>' },
];
check('month recovered from prose when the field is missing',
  headings(orderSectionsChronologically(hamptonNoMonthField)),
  'INTRO | NLCS MVP | The $121 Million Gamble');

// Different years still sort on the year alone.
const hamptonDated: ArticleSection[] = [
  { heading: null, year: null, text: '<p>Hook.</p>' },
  { heading: 'The $121 Million Gamble', year: 2001, text: '<p>The Rockies deal takes effect.</p>' },
  { heading: 'NLCS MVP', year: 2000, text: '<p>The Mets playoff run.</p>' },
];
check('out-of-order years are sorted forwards',
  headings(orderSectionsChronologically(hamptonDated)),
  'INTRO | NLCS MVP | The $121 Million Gamble');

// Same year, no month information anywhere: the model's order stands. Honest limit.
const sameYearNoMonth: ArticleSection[] = [
  { heading: null, year: null, text: '<p>Hook.</p>' },
  { heading: 'Second thing', year: 2000, text: '<p>no month named</p>' },
  { heading: 'First thing', year: 2000, text: '<p>none here either</p>' },
];
check('same year, no months -> model order kept (limit of the sort)',
  headings(orderSectionsChronologically(sameYearNoMonth)),
  'INTRO | Second thing | First thing');

// ── general behaviour ─────────────────────────────────────────────────────────
const scrambled: ArticleSection[] = [
  { heading: null, year: null, text: '<p>Hook.</p>' },
  { heading: 'Late', year: 2007, text: '<p>x</p>' },
  { heading: 'Early', year: 1996, text: '<p>x</p>' },
  { heading: 'Middle', year: 2001, text: '<p>x</p>' },
];
check('intro stays first, rest ascending',
  headings(orderSectionsChronologically(scrambled)),
  'INTRO | Early | Middle | Late');

// Missing year field: fall back to the first year in heading/text.
const missingYear: ArticleSection[] = [
  { heading: null, year: null, text: '<p>Hook.</p>' },
  { heading: 'Later', year: 2005, text: '<p>x</p>' },
  { heading: 'The 1996 draft', text: '<p>He was drafted in 1996.</p>' },
];
check('a missing year is recovered from the text',
  headings(orderSectionsChronologically(missingYear)),
  'INTRO | The 1996 draft | Later');

// No years anywhere: leave the article exactly as written.
const noYears: ArticleSection[] = [
  { heading: null, year: null, text: '<p>Hook.</p>' },
  { heading: 'B', text: '<p>no dates here</p>' },
  { heading: 'A', text: '<p>none here either</p>' },
];
check('no years at all -> untouched', headings(orderSectionsChronologically(noYears)), 'INTRO | B | A');

// An article with a heading on the first section must not lose it to the intro slot.
const noIntro: ArticleSection[] = [
  { heading: 'Second', year: 2004, text: '<p>x</p>' },
  { heading: 'First', year: 1999, text: '<p>x</p>' },
  { heading: 'Third', year: 2010, text: '<p>x</p>' },
];
check('no intro section -> all sorted', headings(orderSectionsChronologically(noIntro)), 'First | Second | Third');

// Too short to reorder meaningfully.
const short: ArticleSection[] = [
  { heading: null, year: null, text: '<p>Hook.</p>' },
  { heading: 'Only one', year: 2001, text: '<p>x</p>' },
];
check('under 3 sections -> untouched', headings(orderSectionsChronologically(short)), 'INTRO | Only one');

console.log(failed ? `\n${failed} check(s) failed` : '\nsection-order checks passed');
process.exit(failed ? 1 : 0);
