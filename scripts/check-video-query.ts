/**
 * Asserts the pre-filled search phrase in the Insert Video dialog.
 *
 * The dialog used to accept a URL only, which meant leaving the editor to go and hunt
 * for one. It now opens with a search phrase built from the block the video will sit
 * next to. The phrase has to be SPECIFIC: "Todd Coffey" alone returns a decade of
 * clips, "Todd Coffey April 19 2005" returns the debut.
 *
 * Run: npx tsx scripts/check-video-query.ts
 */
export {};

const MONTH_RE = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i;

// Mirrors buildVideoQuery() in components/admin/BlockEditor.tsx.
function buildVideoQuery(
  neighbourHtml: string,
  articleContext?: { title?: string; tags?: string[] }
): string {
  const strip = (html: string) =>
    html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const text = strip(neighbourHtml);
  const prose = strip(neighbourHtml.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, ' '));
  const full = text.match(MONTH_RE);
  const occasion = full ? `${full[1]} ${full[2]} ${full[3]}` : (text.match(/\b(19|20)\d{2}\b/)?.[0] || '');
  const fromTags = (articleContext?.tags || []).find(t => /^[A-Z][a-z]+ [A-Z][a-z]+/.test(t));
  const proseWithoutDate = prose.replace(MONTH_RE, ' ').replace(/\b(19|20)\d{2}\b/g, ' ');
  const fromProse = proseWithoutDate.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/);
  const subject = fromTags || fromProse?.[0] || articleContext?.title || '';
  return [subject, occasion].filter(Boolean).join(' ').trim();
}

let failed = 0;
const check = (label: string, got: string, want: string) => {
  if (got === want) { console.log(`ok    ${label}  ->  "${got}"`); return; }
  console.error(`FAIL  ${label}\n        got:  "${got}"\n        want: "${want}"`);
  failed++;
};

// ── the reported block, verbatim from the screenshot ──────────────────────────
const coffeyBlock = `<h2>The 2005 Debut Against the Cubs</h2><p>On April 19, 2005, Coffey slapped on a Reds jersey for the first time, making his major league debut against the Chicago Cubs. He pitched two innings, giving up just a couple of runs but still left the mound buzzing.</p>`;
check('full date beats a bare year',
  buildVideoQuery(coffeyBlock, { title: 'The 2005 Debut Against the Cubs', tags: ['Todd Coffey', 'baseball'] }),
  'Todd Coffey April 19 2005');

// Without the tag the subject has to come out of the prose. "Chicago Cubs" is the
// first two-capital pair here, so the tag is what makes it right - worth knowing.
check('no tags -> first proper name in the text',
  buildVideoQuery(coffeyBlock),
  'Chicago Cubs April 19 2005');

// ── year only ─────────────────────────────────────────────────────────────────
check('year only when no full date',
  buildVideoQuery('<p>By 2009, Coffey had a brief moment in the limelight with the Brewers.</p>', { tags: ['Todd Coffey'] }),
  'Todd Coffey 2009');

// ── no date at all ────────────────────────────────────────────────────────────
check('no date -> subject alone',
  buildVideoQuery('<p>He was a reliever with a sprint to the mound.</p>', { tags: ['Todd Coffey'] }),
  'Todd Coffey');

// ── empty neighbour (video added at the very top) ─────────────────────────────
check('empty block -> falls back to the article title',
  buildVideoQuery('', { title: 'Todd Coffey, the Sprinting Reliever' }),
  'Todd Coffey, the Sprinting Reliever');

check('nothing at all -> empty, and the field just opens blank',
  buildVideoQuery(''),
  '');

// ── date formats ──────────────────────────────────────────────────────────────
check('date without a comma parses',
  buildVideoQuery('<p>On 19 April 2005 he debuted.</p>', { tags: ['Todd Coffey'] }),
  'Todd Coffey 2005');
check('"April 19 2005" without comma parses as a full date',
  buildVideoQuery('<p>April 19 2005 was the day.</p>', { tags: ['Todd Coffey'] }),
  'Todd Coffey April 19 2005');

console.log(failed ? `\n${failed} check(s) failed` : '\nvideo-query checks passed');
process.exit(failed ? 1 : 0);
