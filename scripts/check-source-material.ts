/**
 * Shows what story material the Wikipedia source actually yields, so "read Wikipedia and
 * build a story" can be judged instead of assumed.
 *
 * The prompt asks the model to mine the source for surprising SPECIFICS. If the extract
 * contains no numbers, clubs, years or transfers, the story instruction cannot be met and
 * the honest outcome is a short article - not an invented one.
 *
 * Run: npx tsx scripts/check-source-material.ts "Marco Sturm" 1978 Sport
 */
import { fetchWikipediaSource } from '../src/lib/wikipediaSource';

const [, , nameArg, yearArg, professionArg] = process.argv;
const personName = nameArg || 'Marco Sturm';
const birthYear = yearArg || '1978';
const profession = professionArg || 'Sport';

(async () => {
  const source = await fetchWikipediaSource(personName, { birthYear, profession });

  if (!source) {
    console.log(`no corroborated source for "${personName}" - the route would write the short, no-source version`);
    process.exit(0);
  }

  const sent = source.extract;
  console.log(`source page:      ${source.title}`);
  console.log(`source url:       ${source.url}`);
  console.log(`extract sent:     ${sent.length} chars`);

  // Density probes for the kind of detail the story instruction depends on.
  // Array.from, not [...set]: tsconfig targets es5 without downlevelIteration.
  const years = Array.from(new Set(sent.match(/\b(19|20)\d{2}\b/g) || []));
  const numbers = (sent.match(/\b\d+([.,]\d+)?\b/g) || []).length;
  const propers = Array.from(new Set(sent.match(/\b[A-Z][a-z]+(?: [A-Z][a-z]+)+\b/g) || []));

  console.log(`distinct years:   ${years.length}  ${years.slice(0, 12).join(', ')}`);
  console.log(`numeric tokens:   ${numbers}`);
  console.log(`proper nouns:     ${propers.length}  e.g. ${propers.slice(0, 10).join(', ')}`);

  const thin = years.length < 3 || propers.length < 5;
  console.log(thin
    ? '\nVERDICT: thin source - expect (and accept) a short article'
    : '\nVERDICT: rich source - there is real material to build a story from');

  console.log('\nfirst 700 chars of what the model receives:\n');
  console.log(sent.slice(0, 700).replace(/\n{2,}/g, '\n'));
})();
