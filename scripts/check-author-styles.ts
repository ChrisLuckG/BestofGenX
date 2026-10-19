/**
 * Asserts that the author-style lists cannot drift apart again.
 *
 * They already did, three times over: the dropdowns offered 16 names, the reporter
 * prompts defined 16 different ones, /api/generate-ranking-article had its own 7 keyed
 * 'hunter-thompson' against the UI's 'hunter-s-thompson', and /api/almanac/article
 * resolved nothing at all. Every mismatch failed SILENTLY - the article was still
 * produced, just in the fallback voice, which is exactly the failure mode nobody
 * notices until the output reads generic.
 *
 * Run: npx tsx scripts/check-author-styles.ts
 */
import { AUTHOR_STYLES, DEFAULT_AUTHOR_STYLE } from '../src/config/authorStyles';
import { AUTHOR_STYLE_PROMPTS, styleInstructionFor, isAuthorVoice } from '../src/lib/authorStylePrompts';

let failed = 0;
const fail = (msg: string) => { console.error(`FAIL  ${msg}`); failed++; };
const pass = (msg: string) => console.log(`ok    ${msg}`);

const offered = AUTHOR_STYLES.map(s => s.id);
const briefed = Object.keys(AUTHOR_STYLE_PROMPTS);

// 1. Every id offered in the UI must have a brief, or it silently writes house voice.
for (const id of offered) {
  if (!AUTHOR_STYLE_PROMPTS[id]) fail(`"${id}" is offered in AUTHOR_STYLES but has no brief`);
}
// 2. And nothing may be briefed that cannot be selected - dead weight that looks live.
for (const id of briefed) {
  if (!offered.includes(id as typeof offered[number])) fail(`"${id}" has a brief but is not selectable`);
}
if (!failed) pass(`${offered.length} styles offered, all briefed, none orphaned`);

// 3. Exactly four author voices plus the neutral baseline.
const voices = offered.filter(id => id !== 'informative');
if (voices.length !== 4) fail(`expected 4 author voices, found ${voices.length}: ${voices.join(', ')}`);
else pass(`4 author voices: ${voices.join(', ')}`);

// 4. The default must exist and must be the neutral one.
if (!offered.includes(DEFAULT_AUTHOR_STYLE)) fail(`DEFAULT_AUTHOR_STYLE "${DEFAULT_AUTHOR_STYLE}" is not in the list`);
else if (isAuthorVoice(DEFAULT_AUTHOR_STYLE)) fail(`DEFAULT_AUTHOR_STYLE "${DEFAULT_AUTHOR_STYLE}" should be the neutral baseline`);
else pass(`default is "${DEFAULT_AUTHOR_STYLE}"`);

// 5. Humour is the selection criterion - a voice without it is why Didion was dropped.
for (const id of voices) {
  if (!/MUST BE FUNNY/.test(AUTHOR_STYLE_PROMPTS[id])) fail(`"${id}" has no MUST BE FUNNY clause`);
}
// 6. Every voice must name what it forbids, otherwise the model drifts back to
//    press-release prose regardless of the positive instructions.
for (const id of voices) {
  if (!/FORBIDDEN/.test(AUTHOR_STYLE_PROMPTS[id])) fail(`"${id}" has no FORBIDDEN list`);
}
// 7. A brief that is only a couple of lines does not survive the house prompt.
for (const id of voices) {
  const len = AUTHOR_STYLE_PROMPTS[id].length;
  if (len < 600) fail(`"${id}" brief is only ${len} chars - too thin to move the model`);
}
// 8. Every voice must carry the closing stance - grudging respect, "one of us GenX".
//    It is the site's stance towards its subjects, so a voice without it would end on
//    either a tribute or a hatchet job.
for (const id of voices) {
  if (!/GRUDGING RESPECT/.test(AUTHOR_STYLE_PROMPTS[id])) fail(`"${id}" has no closing stance`);
}
// 9. The neutral baseline must NOT carry it - it would contradict "no inspirational
//    summing-up".
if (/GRUDGING RESPECT/.test(AUTHOR_STYLE_PROMPTS.informative)) {
  fail('the informative baseline should not carry the grudging-respect ending');
}
if (!failed) pass('every voice is funny, forbids something, is substantial and lands on grudging respect');

// 8. Unknown ids must resolve, not throw - old drafts still carry retired styles.
const legacy = styleInstructionFor('murakami');
if (legacy !== AUTHOR_STYLE_PROMPTS.informative) fail('a retired style id must fall back to informative');
else pass('retired style ids fall back to informative');
if (styleInstructionFor(undefined) !== AUTHOR_STYLE_PROMPTS.informative) fail('undefined must fall back to informative');
if (isAuthorVoice('murakami')) fail('a retired id must not count as an author voice');

// 9. The article editor's "Generate" (/api/generate-article). It looked the Style id up in an old local map that
//    knew none of the voices (always "nostalgic"), and the house prompt carried its own old author list plus
//    "check your reporter profile" - the chosen voice was never applied (19.10.2026).
{
  const fs = require('fs') as typeof import('fs');
  const tab = fs.readFileSync('src/components/admin/ArticlesTab.tsx', 'utf8');
  const gen = fs.readFileSync('src/app/api/generate-article/route.ts', 'utf8');
  if (/toneMap\[tone\]/.test(tab) || !/styleId,/.test(tab)) fail('ArticlesTab must send the Style id as styleId (no local tone map)');
  else pass('the editor sends the chosen Style as styleId');
  if (!/styleInstructionFor\(styleId/.test(gen) || !/hasVoice \? 0\.95 : 0\.7/.test(gen)) fail('/api/generate-article must put the brief in the system prompt (0.95 for a voice)');
  else pass('/api/generate-article uses the brief and the voice temperature');
  const { promptForStyle } = require('../src/lib/articlePromptStyle') as typeof import('../src/lib/articlePromptStyle');
  const raw = fs.readFileSync('src/prompts/article-prompt.txt', 'utf8');
  const voiced = promptForStyle(raw, true), plain = promptForStyle(raw, false);
  if (/DAVID SEDARIS|reporter profile/i.test(voiced) || !/OUTPUT FORMAT/.test(voiced)) fail('the house prompt must lose its old author list, keep its output format');
  else pass('the house prompt keeps its format but not its old author list');
  if (/LAUGH or at least SMIRK/.test(plain)) fail('"informative" must not carry the house prompt\'s "must be funny" rules');
  else pass('"informative" is not told to be funny');
  if (!/aiTone:\s*\{/.test(fs.readFileSync('src/models/Article.ts', 'utf8'))) fail('the Article model must store aiTone (the editor shows it)');
  else pass('the article stores the style it was written in (aiTone)');
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall author-style checks passed');
process.exit(failed ? 1 : 0);
