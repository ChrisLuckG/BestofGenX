/**
 * Asserts the flag lookup for the country names the people import actually stores.
 * Wikidata gives the country AT BIRTH, so a GenXer born in Prague in 1979 is
 * "Czechoslovakia" - the article about Robert Pelikán (18.10.2026) had no flag.
 *
 * Run: npx tsx scripts/check-country-flags.ts
 */
import { countryCodeFor, countryNameToCode } from '../src/lib/countryFlags';

let failed = 0;
const eq = (label: string, got: string, want: string) => {
  if (got !== want) { console.error(`FAIL  ${label}: got "${got}", want "${want}"`); failed++; }
  else console.log(`ok    ${label} -> ${want || '(none)'}`);
};

// one successor: the name alone is enough
eq('Kingdom of the Netherlands', countryNameToCode('Kingdom of the Netherlands'), 'NL');
eq('German Democratic Republic', countryNameToCode('German Democratic Republic'), 'DE');
eq("People's Republic of China", countryNameToCode("People's Republic of China"), 'CN');
eq('Germany unchanged', countryNameToCode('Germany'), 'DE');

// split states: the birth city decides
eq('Czechoslovakia + Prague', countryCodeFor('Czechoslovakia', 'Prague'), 'CZ');
eq('Czechoslovakia + Košice', countryCodeFor('Czechoslovakia', 'Košice'), 'SK');
eq('Soviet Union + Yerevan', countryCodeFor('Soviet Union', 'Yerevan'), 'AM');
eq('Soviet Union + Moscow', countryCodeFor('Soviet Union', 'Moscow'), 'RU');
eq('SFR Yugoslavia + Zagreb', countryCodeFor('Socialist Federal Republic of Yugoslavia', 'Zagreb'), 'HR');
eq('Serbia and Montenegro + Podgorica', countryCodeFor('Serbia and Montenegro', 'Podgorica'), 'ME');
eq('district suffix', countryCodeFor('Czechoslovakia', 'Jablonec nad Nisou District'), 'CZ');

// a split state without a known city must give NO flag rather than a guessed one
eq('Czechoslovakia, no city', countryCodeFor('Czechoslovakia', ''), '');
eq('Soviet Union, unknown city', countryCodeFor('Soviet Union', 'Atlantis'), '');
// and the name-only lookup must not guess for a split state either
eq('Czechoslovakia name only', countryNameToCode('Czechoslovakia'), '');

console.log(failed ? `\n${failed} check(s) failed` : '\nall country-flag checks passed');
process.exit(failed ? 1 : 0);
