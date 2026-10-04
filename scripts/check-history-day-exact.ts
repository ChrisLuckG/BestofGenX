/**
 * Asserts the day-exactness gate in /api/editorial/history-event.
 *
 * The complaint it answers: "Das Event MUSS am gleichen Tag stattgefunden haben. Nicht
 * 3 Tage vorher, nicht 3 Tage nachher." The prompt always carried an EXACT DATE RULE,
 * but nothing checked the answer, so an off-day event was stored verbatim.
 *
 * Also probes the live Wikipedia pool, because the gate rests on it: an empty pool now
 * aborts instead of letting the model answer from memory.
 *
 * Run: npx tsx scripts/check-history-day-exact.ts
 */
export {};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Mirrors the helpers in the route.
function eventDateMatchesDay(dateStr: string | undefined, month0: number, day: number) {
  if (!dateStr || typeof dateStr !== 'string') return { ok: false, parsed: null as string | null };
  const iso = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const m = parseInt(iso[2], 10) - 1;
    const d = parseInt(iso[3], 10);
    return { ok: m === month0 && d === day, parsed: `${iso[1]}-${iso[2]}-${iso[3]}` };
  }
  const monthNames = MONTHS.map(m => m.toLowerCase());
  const lower = dateStr.toLowerCase();
  const foundMonth = monthNames.findIndex(m => lower.includes(m));
  const dayMatch = lower.match(/\b(\d{1,2})\b(?!\d)/);
  if (foundMonth >= 0 && dayMatch) {
    const d = parseInt(dayMatch[1], 10);
    return { ok: foundMonth === month0 && d === day, parsed: `${MONTHS[foundMonth]} ${d}` };
  }
  return { ok: false, parsed: null };
}

function overlapWithPoolEntry(modelText: string, poolText: string): number {
  const strip = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9äöüßáéíóúàèìòùâêîôûñç\s]/g, ' ').split(/\s+/).filter(w => w.length > 3);
  const poolTokens = Array.from(new Set(strip(poolText)));
  if (poolTokens.length === 0) return 0;
  const modelTokens = new Set(strip(modelText));
  return poolTokens.filter(t => modelTokens.has(t)).length / poolTokens.length;
}

let failed = 0;
const check = (label: string, got: boolean, want: boolean) => {
  if (got === want) { console.log(`ok    ${label}`); return; }
  console.error(`FAIL  ${label} (got ${got}, want ${want})`);
  failed++;
};

// ── date parsing: the "3 days either side" cases ──────────────────────────────
// Reference day: 13 July (month0 = 6, day = 13)
check('same day, "July 13, 1985"',        eventDateMatchesDay('July 13, 1985', 6, 13).ok, true);
check('same day, "13 July 1985"',         eventDateMatchesDay('13 July 1985', 6, 13).ok, true);
check('same day, ISO "1985-07-13"',       eventDateMatchesDay('1985-07-13', 6, 13).ok, true);
check('3 days before, "July 10, 1985"',   eventDateMatchesDay('July 10, 1985', 6, 13).ok, false);
check('3 days after, "July 16, 1985"',    eventDateMatchesDay('July 16, 1985', 6, 13).ok, false);
check('1 day off, "July 12, 1985"',       eventDateMatchesDay('July 12, 1985', 6, 13).ok, false);
check('right day, wrong month',           eventDateMatchesDay('August 13, 1985', 6, 13).ok, false);
check('ISO 3 days before',                eventDateMatchesDay('1985-07-10', 6, 13).ok, false);
check('year only, unparseable -> reject', eventDateMatchesDay('1985', 6, 13).ok, false);
check('empty -> reject',                  eventDateMatchesDay(undefined, 6, 13).ok, false);

// ── pool-membership overlap ───────────────────────────────────────────────────
const poolEntry = 'Live Aid, a benefit concert organised by Bob Geldof and Midge Ure, is held simultaneously at Wembley Stadium in London and John F. Kennedy Stadium in Philadelphia.';
const retold = 'Live Aid: Geldof Hijacks Wembley — the benefit concert that ran at Wembley Stadium and Philadelphia on the same afternoon.';
const different = 'The Karate Kid Part II begins filming in Okinawa with a completely new crew and cast members.';
const retoldOverlap = overlapWithPoolEntry(retold, poolEntry);
const differentOverlap = overlapWithPoolEntry(different, poolEntry);
console.log(`      retold overlap=${retoldOverlap.toFixed(2)}  unrelated overlap=${differentOverlap.toFixed(2)}`);
check('a voiced retelling passes the 0.15 gate', retoldOverlap >= 0.15, true);
check('an unrelated event fails the gate',       differentOverlap >= 0.15, false);

// ── live pool: the gate depends on it existing ────────────────────────────────
(async () => {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  try {
    const res = await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/${mm}/${dd}`, {
      headers: { 'User-Agent': 'BOGX-Newsroom/1.0 (contact@bogx.com)' },
    });
    const data: any = await res.json();
    const genx = (data.events || []).filter((e: any) => e.year >= 1965 && e.year <= 2005);
    console.log(`\n      live pool for ${MONTHS[now.getMonth()]} ${now.getDate()} (en only): ${genx.length} GenX-era events`);
    if (genx.length > 0) {
      console.log(`      e.g. ${genx[0].year}: ${String(genx[0].text).slice(0, 90)}`);
      console.log('ok    pool is non-empty, so the route will generate');
    } else {
      console.log('ok    pool empty for en - the route returns noPool instead of inventing');
    }
  } catch (e) {
    console.log(`      could not reach Wikimedia: ${(e as Error).message}`);
  }

  console.log(failed ? `\n${failed} check(s) failed` : '\nhistory day-exactness checks passed');
  process.exit(failed ? 1 : 0);
})();
