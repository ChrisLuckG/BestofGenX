// Asserts the Daily Auto timing rules, including the CET/CEST switch.
//   npx tsx scripts/check-daily-auto.ts
import {
  DEFAULT_SLOTS, ALL_KINDS, KIND_META, berlinCalendarDay, berlinWallTime, canStartGeneration, decideAction, displayStatus,
  kindProblem, slotTimes, formatRange,
  type SlotConfig, type RunState,
} from '../src/lib/dailyAutoSchedule';

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};
const slot = (id: string, patch: Partial<SlotConfig> = {}): SlotConfig => ({ ...DEFAULT_SLOTS.find(s => s.id === id)!, enabled: true, ...patch });
const iso = (s: string) => new Date(s);

// --- Berlin wall clock -> UTC, both sides of the DST switch ---
eq('08:00 Berlin in summer = 06:00Z', berlinWallTime('2026-07-15', '08:00').toISOString(), '2026-07-15T06:00:00.000Z');
eq('08:00 Berlin in winter = 07:00Z', berlinWallTime('2026-01-15', '08:00').toISOString(), '2026-01-15T07:00:00.000Z');
eq('last Sunday of March 2026 (29th) 08:00 = 06:00Z', berlinWallTime('2026-03-29', '08:00').toISOString(), '2026-03-29T06:00:00.000Z');
eq('day before the switch (28th) 08:00 = 07:00Z', berlinWallTime('2026-03-28', '08:00').toISOString(), '2026-03-28T07:00:00.000Z');
eq('calendar day at 23:30Z in summer is already tomorrow in Berlin', berlinCalendarDay(iso('2026-07-15T23:30:00Z')), '2026-07-16');
eq('calendar day at 21:59Z in summer is still today in Berlin', berlinCalendarDay(iso('2026-07-15T21:59:00Z')), '2026-07-15');

const D = '2026-07-15'; // CEST: 12:00 Berlin = 10:00Z
// --- bogx slot 12:00 (lead 60): generate window opens 11:00, live at 12:00, closes 13:00 ---
const noon = slot('1200');
eq('before genAt -> wait', decideAction(noon, null, iso('2026-07-15T08:59:00Z'), D), 'wait');
eq('at genAt (11:00 Berlin) -> generate', decideAction(noon, null, iso('2026-07-15T09:00:00Z'), D), 'generate');
eq('inside the lead hour -> generate', decideAction(noon, null, iso('2026-07-15T09:40:00Z'), D), 'generate');
eq('after the window closed -> none (missed)', decideAction(noon, null, iso('2026-07-15T11:00:00Z'), D), 'none');
const ready: RunState = { phase: 'ready' };
eq('ready but before start -> wait', decideAction(noon, ready, iso('2026-07-15T09:59:00Z'), D), 'wait');
eq('ready and start reached -> publish', decideAction(noon, ready, iso('2026-07-15T10:00:00Z'), D), 'publish');
eq('ready, long after start -> still publish', decideAction(noon, ready, iso('2026-07-15T13:00:00Z'), D), 'publish');
eq('published -> none', decideAction(noon, { phase: 'published' }, iso('2026-07-15T10:30:00Z'), D), 'none');
eq('error is NOT retried automatically', decideAction(noon, { phase: 'error' }, iso('2026-07-15T10:30:00Z'), D), 'none');
eq('fresh claim -> wait', decideAction(noon, { phase: 'generating', claimedAt: iso('2026-07-15T09:05:00Z') }, iso('2026-07-15T09:10:00Z'), D), 'wait');
eq('11-minute-old claim -> mark-stale', decideAction(noon, { phase: 'generating', claimedAt: iso('2026-07-15T09:00:00Z') }, iso('2026-07-15T09:11:00Z'), D), 'mark-stale');

// --- disabled means disabled, even for a finished draft ---
const off = slot('1200', { enabled: false });
eq('disabled never generates', decideAction(off, null, iso('2026-07-15T09:30:00Z'), D), 'none');
eq('disabled never publishes a ready draft', decideAction(off, ready, iso('2026-07-15T10:30:00Z'), D), 'none');

// --- winners: lead 0, nothing to report before 10:00 Berlin (= 08:00Z in summer) ---
const win = slot('1000');
eq('winners wait until 10:00', decideAction(win, null, iso('2026-07-15T07:59:00Z'), D), 'wait');
eq('winners generate at 10:00', decideAction(win, null, iso('2026-07-15T08:00:00Z'), D), 'generate');
// --- history: lead 120 -> opens 09:00 Berlin ---
const hist = slot('1100');
eq('history genAt = 09:00 Berlin (07:00Z)', slotTimes(hist, D).genAt.toISOString(), '2026-07-15T07:00:00.000Z');
eq('history live at 11:00 Berlin (09:00Z)', slotTimes(hist, D).startAt.toISOString(), '2026-07-15T09:00:00.000Z');

// --- in normal operation the hourly cron never has to do two generations at once:
//     no two slots may open their generation window on the same tick. (After a missed
//     tick two slots can be due together; the runner's time budget covers that.)
const genTicks = DEFAULT_SLOTS.map(s => slotTimes(s, D).genAt.toISOString());
eq('every slot opens generation on its own tick', new Set(genTicks).size, DEFAULT_SLOTS.length);
eq('generation always opens on a full hour (cron runs at :00)', genTicks.every(t => t.endsWith(':00:00.000Z')), true);

// --- display ---
eq('status: live (published WITH an article)', displayStatus(noon, { phase: 'published', articleId: 'a1' }, iso('2026-07-15T10:30:00Z'), D), 'live');
eq('status: skipped (finished without an article = nothing to make)', displayStatus(noon, { phase: 'published' }, iso('2026-07-15T10:30:00Z'), D), 'skipped');
eq('status: off', displayStatus(off, null, iso('2026-07-15T09:30:00Z'), D), 'off');
eq('status: missed', displayStatus(noon, null, iso('2026-07-15T12:00:00Z'), D), 'missed');
eq('range label', formatRange(noon), '12:00 - 13:00');
eq('13:00 range ends at 14:00', formatRange(slot('1300')), '13:00 - 14:00');

// --- hourly slots ---
eq('18 hourly slots, 06:00 to 23:00', [DEFAULT_SLOTS.length, DEFAULT_SLOTS[0].start, DEFAULT_SLOTS[DEFAULT_SLOTS.length - 1].start], [18, '06:00', '23:00']);
eq('one slot per hour, ids are HHMM', DEFAULT_SLOTS.every((s, i) => s.id === String(6 + i).padStart(2, '0') + '00' && s.start === String(6 + i).padStart(2, '0') + ':00'), true);
eq('the first schedule survives: 10 Winners, 11 History, 12 Bogx + Rankroll',
  ['1000', '1100', '1200'].map(id => DEFAULT_SLOTS.find(s => s.id === id)!.kind), ['winners', 'history', 'bogx-rankroll']);
eq('Winners and History start ON (they ran by themselves before), everything else OFF',
  DEFAULT_SLOTS.filter(s => s.enabled).map(s => s.id), ['1000', '1100']);
eq('every other hour is a Bogx article', DEFAULT_SLOTS.filter(s => !['1000', '1100', '1200'].includes(s.id)).every(s => s.kind === 'bogx'), true);
eq('exactly one Winners and one History slot by default', [DEFAULT_SLOTS.filter(s => s.kind === 'winners').length, DEFAULT_SLOTS.filter(s => s.kind === 'history').length], [1, 1]);
eq('generation of the default slots never crosses midnight', DEFAULT_SLOTS.every(s => slotTimes(s, D).genAt >= berlinWallTime(D, '00:00')), true);

// --- which type may go where ---
const slots = DEFAULT_SLOTS.map(s => ({ ...s }));
eq('Bogx fits anywhere', slots.every(s => kindProblem(slots, s.id, 'bogx') === null), true);
eq('Bogx + Rankroll fits anywhere', slots.every(s => kindProblem(slots, s.id, 'bogx-rankroll') === null), true);
eq('a slot may keep its own type', [kindProblem(slots, '1100', 'history'), kindProblem(slots, '1000', 'winners')], [null, null]);
eq('a second History is refused and names the first', kindProblem(slots, '1500', 'history')?.includes('11:00'), true);
eq('a second Winners is refused', kindProblem(slots, '1500', 'winners')?.includes('10:00'), true);
const noWinners = slots.map(s => (s.id === '1000' ? { ...s, kind: 'bogx' as const } : s));
eq('Winners cannot go before 10:00 (the day it reports has not ended)', kindProblem(noWinners, '0800', 'winners')?.includes('before 10:00'), true);
eq('Winners at 10:00 is fine once the old one is gone', kindProblem(noWinners, '1000', 'winners'), null);
eq('Winners later in the day is fine too', kindProblem(noWinners, '1500', 'winners'), null);
// --- the Radio article: once a day like History/Winners, but any hour ---
eq('Radio is a type of its own, with a label and an estimate', [ALL_KINDS.includes('radio'), KIND_META.radio.label], [true, 'Radio Article']);
eq('no slot is Radio until someone picks it', DEFAULT_SLOTS.filter(s => s.kind === 'radio').length, 0);
eq('Radio can go on any hour while none exists', slots.every(s => kindProblem(slots, s.id, 'radio') === null), true);
const withRadio = slots.map(s => (s.id === '1500' ? { ...s, kind: 'radio' as const } : s));
eq('a second Radio slot is refused and names the first', kindProblem(withRadio, '1800', 'radio')?.includes('15:00'), true);
eq('the Radio slot may keep its own type', kindProblem(withRadio, '1500', 'radio'), null);
eq('Radio does not block Bogx elsewhere', kindProblem(withRadio, '1800', 'bogx'), null);
eq('Radio generation never crosses midnight from 06:00', slotTimes({ ...slots[0], kind: 'radio' }, D).genAt >= berlinWallTime(D, '00:00'), true);

eq('unknown slot', kindProblem(slots, '9999', 'bogx'), 'Unknown slot 9999');
eq('unknown type', kindProblem(slots, '1500', 'banana' as never), 'Unknown type banana');
eq('every type has a label and a time estimate', ALL_KINDS.every(k => KIND_META[k].label && KIND_META[k].estSec > 0), true);

// --- time budget of one cron tick (maxDuration 300s) ---
eq('an idle tick can start any type', ALL_KINDS.every(k => canStartGeneration(0, k)), true);
eq('History needs ~220s: it fits at 50s, not at 60s', [canStartGeneration(50_000, 'history'), canStartGeneration(60_000, 'history')], [true, false]);
eq('after a History run (220s) nothing else fits', ALL_KINDS.every(k => !canStartGeneration(220_000, k)), true);
eq('two Bogx articles fit into one tick', canStartGeneration(60_000, 'bogx'), true);
eq('a Bogx article then History: History waits for the next tick', canStartGeneration(60_000, 'history'), false);

console.log(failed ? `\n${failed} FAILED` : '\nall ok');
process.exit(failed ? 1 : 0);
