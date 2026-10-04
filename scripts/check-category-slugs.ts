// Diagnostic for the dynamic-category slug contract.
//
// Two things have to hold, or renaming a container creates a DUPLICATE
// category that shadows a static one:
//   1. slugify() must transliterate umlauts ("Fußball" and "Fussball" -> same)
//   2. a label whose slug matches a static category's slug, its slugified
//      LABEL, or one of its aliases must resolve to that static category
import { CATEGORIES, slugify } from '../src/lib/categories';

console.log('--- 1. slugify ---');
const pairs: [string, string][] = [
  ['EisHockey', 'eishockey'],
  ['Fussball', 'fussball'],
  ['Fußball', 'fussball'],
  ['Eis Hockey', 'eis-hockey'],
  ['Tischtennis', 'tischtennis'],
  ['März Cup', 'maerz-cup'],
  ['Grüne Hölle', 'gruene-hoelle'],
  ['  Padel  ', 'padel'],
];
let bad = 0;
for (const [input, want] of pairs) {
  const got = slugify(input);
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? '  ok  ' : ' FAIL '}${JSON.stringify(input).padEnd(16)} -> ${JSON.stringify(got).padEnd(18)}${ok ? '' : 'want ' + JSON.stringify(want)}`);
}

console.log('\n--- 2. static entries where slug !== slugify(label) ---');
console.log('(each of these can be duplicated by a container rename)');
let mismatches = 0;
for (const c of CATEGORIES) {
  const ls = slugify(c.label);
  if (ls !== c.slug) {
    mismatches++;
    console.log(`  slug=${c.slug.padEnd(12)} label=${JSON.stringify(c.label).padEnd(22)} slugify(label)=${ls}`);
  }
}

console.log(`\n${bad} slugify failure(s), ${mismatches} slug/label mismatch(es).`);
