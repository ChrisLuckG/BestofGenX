/**
 * Asserts the occasion line (birthday / day of death) in buildOccasionBlock().
 *
 * The whole point is that it is CONDITIONAL. An unconditional "today on his birthday"
 * would land in obituaries and in articles about video games, and a wrong age would
 * repeat the mistake already seen in output ("a 19-year-old phenomenon" two sentences
 * before "the kid was a mere 20").
 *
 * Run: npx tsx scripts/check-occasion-block.ts
 */
import { buildOccasionBlock } from '../src/lib/authorStylePrompts';

let failed = 0;
const check = (label: string, got: boolean, want: boolean) => {
  if (got === want) { console.log(`ok    ${label}`); return; }
  console.error(`FAIL  ${label} (got ${got}, want ${want})`);
  failed++;
};

// Fixed reference so the test does not drift with the calendar.
// 09 September 2026, 12:00 Berlin.
const today = new Date('2026-09-09T10:00:00Z');
const has = (s: string, needle: string) => s.includes(needle);

// ── birthday today, alive (the Kyle Snyder case: born 9 Sept 1977) ────────────
const bday = buildOccasionBlock({ born: '1977-09-09', now: today });
check('birthday today produces a block', bday.length > 0, true);
check('  says BIRTHDAY', has(bday, 'BIRTHDAY'), true);
check('  computes age 49', has(bday, 'turn 49') || has(bday, 'turns 49'), true);
check('  insists on ONCE', has(bday, 'ONCE'), true);
check('  bans "Happy Birthday!"', has(bday, 'Happy Birthday'), true);

// German stored format must work identically - both are in this project.
const bdayDe = buildOccasionBlock({ born: '09.09.1977', now: today });
check('German DD.MM.YYYY parses the same', bdayDe === bday, true);

// ── not today ─────────────────────────────────────────────────────────────────
check('birthday 3 days later -> nothing', buildOccasionBlock({ born: '1977-09-12', now: today }).length === 0, true);
check('birthday 3 days earlier -> nothing', buildOccasionBlock({ born: '1977-09-06', now: today }).length === 0, true);
check('same day, other month -> nothing', buildOccasionBlock({ born: '1977-10-09', now: today }).length === 0, true);
check('no birth date -> nothing', buildOccasionBlock({ now: today }).length === 0, true);
check('unparseable date -> nothing', buildOccasionBlock({ born: '1977', now: today }).length === 0, true);

// ── items have no birthday ────────────────────────────────────────────────────
check('an item never gets an occasion', buildOccasionBlock({ born: '1977-09-09', isItem: true, now: today }).length === 0, true);

// ── dead people ───────────────────────────────────────────────────────────────
const wouldHave = buildOccasionBlock({ born: '1977-09-09', died: '2020-03-01', now: today });
check('dead + birthday today -> "would have turned"', has(wouldHave, 'would have turned 49'), true);

const anniversary = buildOccasionBlock({ born: '1977-04-04', died: '2020-09-09', now: today });
check('day of death -> remembrance block', has(anniversary, 'REMEMBRANCE'), true);
// Not "does it contain the word birthday" - it deliberately does, in order to forbid
// it. What must be absent is the birthday INSTRUCTION: the age line and the greeting.
check('  carries no age/greeting instruction', /turns? \d+ today/.test(anniversary), false);
check('  explicitly forbids birthday language', has(anniversary, 'No birthday language'), true);
check('  explicitly forbids wishing', has(anniversary, 'Do NOT wish'), true);

// Death anniversary wins over an unrelated birthday date - an obituary must never
// carry a birthday greeting.
const both = buildOccasionBlock({ born: '1977-09-09', died: '2015-09-09', now: today });
check('both fall today -> remembrance, not birthday', has(both, 'REMEMBRANCE'), true);

// A dead person on a day that is neither -> silence.
check('dead, neither date today -> nothing', buildOccasionBlock({ born: '1977-01-02', died: '2015-05-06', now: today }).length === 0, true);

console.log(failed ? `\n${failed} check(s) failed` : '\noccasion-block checks passed');
process.exit(failed ? 1 : 0);
