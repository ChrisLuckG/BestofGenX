/**
 * Probes the Wikipedia source lookup used by the article routes.
 *
 * The regression it guards: without source text the routes invented specifics, and
 * "Marco Sturm (ice hockey) played for Schalke 04" is what that looks like. The
 * corroboration step matters as much as the fetch - accepting the WRONG page would make
 * invented facts look sourced, which is strictly worse than having no source.
 *
 * Imports the real implementation rather than restating it: an earlier version of this
 * script kept its own copy of the profession hints, which is how the two drifted (and
 * collided in the global scope).
 *
 * Run: npx tsx scripts/check-wikipedia-source.ts
 */
import { fetchWikipediaSource } from '../src/lib/wikipediaSource';

let failed = 0;
const fail = (m: string) => { console.error(`FAIL  ${m}`); failed++; };
const pass = (m: string) => console.log(`ok    ${m}`);

(async () => {
  // The reported case: an ice hockey player who was given a football club.
  const sturm = await fetchWikipediaSource('Marco Sturm', { birthYear: '1978', profession: 'Sport' });
  if (!sturm) {
    fail('no page accepted for Marco Sturm - the article would be written without a source');
  } else {
    console.log(`      accepted: ${sturm.title} (${sturm.extract.length} chars)`);
    const lower = sturm.extract.toLowerCase();
    if (!lower.includes('hockey')) fail('accepted page never mentions hockey - wrong person');
    else pass('accepted page is the ice hockey player');
    if (/schalke/i.test(sturm.extract)) fail('accepted extract mentions Schalke - wrong person');
    else pass('accepted extract contains no football club');
    // The facts the model previously invented must be present and correct.
    if (!/San Jose Sharks/i.test(sturm.extract)) fail('extract lacks the real draft team');
    else pass('extract contains the real draft team (San Jose Sharks)');
  }

  // Two athletes share this name. The Menschen record is the MLB pitcher (born 1977,
  // GenX); the wrestler (born 1995) ranks FIRST in Wikipedia's search and shares the
  // Sport profession words, and a disambiguation page sits between them. This case
  // produced a complete, fluent, entirely wrong article about the wrestler.
  const snyder = await fetchWikipediaSource('Kyle Snyder', { birthYear: '1977', profession: 'Sport' });
  if (!snyder) {
    fail('no page accepted for Kyle Snyder (1977)');
  } else if (/wrestler/i.test(snyder.title)) {
    fail(`accepted "${snyder.title}" - that is the 1995 wrestler, not the 1977 pitcher`);
  } else if (/may refer to/i.test(snyder.extract.slice(0, 200))) {
    fail('accepted the disambiguation page as a source');
  } else if (!/1977/.test(snyder.extract) || !/baseball|pitcher/i.test(snyder.extract)) {
    fail(`accepted "${snyder.title}" but it is not the baseball player`);
  } else {
    pass(`same-name athletes are told apart: accepted "${snyder.title}"`);
  }

  // A birth year that cannot corroborate, and no profession hint to fall back on.
  const bogus = await fetchWikipediaSource('Marco Sturm', { birthYear: '1899' });
  if (bogus) fail(`uncorroborated candidate "${bogus.title}" was accepted - it should be rejected`);
  else pass('an uncorroborated candidate is rejected rather than guessed');

  // Nonsense name must not resolve to a random page.
  const nonsense = await fetchWikipediaSource('Qwertzuiop Asdfghjkl', { birthYear: '1975', profession: 'Sport' });
  if (nonsense) fail(`nonsense name resolved to "${nonsense.title}"`);
  else pass('a name with no article yields no source');

  // Too-short input must not even be looked up.
  const tooShort = await fetchWikipediaSource('X', { profession: 'Sport' });
  if (tooShort) fail('a one-character name was looked up');
  else pass('a too-short name is refused without a request');

  console.log(failed ? `\n${failed} check(s) failed` : '\nwikipedia source checks passed');
  process.exit(failed ? 1 : 0);
})();
