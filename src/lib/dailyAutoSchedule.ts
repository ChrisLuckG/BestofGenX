// Daily Auto: the slot definitions and the "what is due right now" decision.
//
// Pure logic, no database and no network, so it can be unit-checked
// (scripts/check-daily-auto.ts) and imported from anywhere. Everything that
// touches Mongo or generates content lives in dailyAuto.ts.
//
// Slot times are Berlin WALL-CLOCK times. Vercel runs in UTC, so a "08:00" slot
// is 06:00 UTC in summer and 07:00 UTC in winter - the conversion goes through
// berlinOffsetMinutes() so the DST switch does not shift the schedule.
import { berlinOffsetMinutes } from './berlinTime';

export type SlotKind = 'bogx' | 'bogx-rankroll' | 'winners' | 'history' | 'radio' | 'rip';

export interface SlotConfig {
  id: string;
  kind: SlotKind;
  /** Berlin wall-clock start, "HH:MM". The article is LIVE from this moment. */
  start: string;
  enabled: boolean;
}

export type RunPhase = 'generating' | 'ready' | 'published' | 'error';

export interface RunState {
  phase: RunPhase;
  claimedAt?: Date | string;
  /** A finished run WITHOUT an article means "nothing to make": skipped */
  articleId?: string;
}

/**
 * `leadMin` = how long before `start` generation begins, so the article is ready
 * (draft) and goes live exactly at `start`.
 *  - bogx / bogx-rankroll: 60. Wikipedia + YouTube + (rankroll) generation.
 *  - history: 120. The cover image alone takes ~2 minutes at quality "high".
 *  - winners: 0. It reports the ranking day that ends at 10:00 Berlin, so there is
 *    nothing to write about before that moment.
 */
export const KIND_META: Record<SlotKind, { label: string; leadMin: number; estSec: number }> = {
  bogx: { label: 'Bogx Article', leadMin: 60, estSec: 60 },
  'bogx-rankroll': { label: 'Bogx Article + Rankroll', leadMin: 60, estSec: 100 },
  winners: { label: 'Trivia Winner Article', leadMin: 0, estSec: 150 },
  history: { label: 'History Article', leadMin: 120, estSec: 220 },
  radio: { label: 'Radio Article', leadMin: 60, estSec: 90 },
  rip: { label: 'RIP Article', leadMin: 60, estSec: 60 },
};

/** `estSec` = how long a generation takes at most, measured (History: 188s for 4 events + banner +
 *  article) plus margin; it decides whether a tick still has time to start one. */
export const ALL_KINDS: SlotKind[] = ['bogx', 'bogx-rankroll', 'history', 'winners', 'radio', 'rip'];

/** Types that can sit on ONE slot only: a second one would repeat the first. (Radio is on top of
 *  that at most one article a week - lib/radioArticle.ts - so its slot may stay on every day. RIP
 *  is about the people who died on this day: two RIP slots would just remember two of them.) */
export const ONCE_A_DAY: SlotKind[] = ['winners', 'history', 'radio', 'rip'];

/** The cron route's maxDuration is 300s; stay clear of it. */
export const TICK_LIMIT_MS = 270_000;

/** Is there still time in this tick to start generating a slot of this kind? A tick that holds two
 *  slots (e.g. History plus a Bogx article opening on the same hour) would otherwise be killed
 *  mid-generation; the one that does not fit waits for the next tick (its window is an hour+). */
export const canStartGeneration = (elapsedMs: number, kind: SlotKind): boolean =>
  elapsedMs + KIND_META[kind].estSec * 1000 <= TICK_LIMIT_MS;

/** Hourly slots: one per hour from FIRST_HOUR to LAST_HOUR. The kind can be changed per slot. */
export const FIRST_HOUR = 6;
export const LAST_HOUR = 23;

/** What the first schedule had: Winners and History were already automatic (their own Vercel
 *  crons), so they start ENABLED - switching the site over must not silently stop them. Every
 *  other hour is a Bogx article and starts disabled. */
const ORIGINAL: Record<string, { kind: SlotKind; enabled: boolean }> = {
  '1000': { kind: 'winners', enabled: true },
  '1100': { kind: 'history', enabled: true },
  '1200': { kind: 'bogx-rankroll', enabled: false },
};

export const DEFAULT_SLOTS: SlotConfig[] = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => {
  const hh = String(FIRST_HOUR + i).padStart(2, '0');
  const id = `${hh}00`;
  return { id, start: `${hh}:00`, kind: ORIGINAL[id]?.kind ?? 'bogx', enabled: ORIGINAL[id]?.enabled ?? false } as SlotConfig;
});

/**
 * Why `kind` cannot go on slot `slotId` (null = fine). History and Winners are once a day by
 * nature - a second one would only repeat the first - and Winners reports the ranking day that
 * ENDS at 10:00 Berlin, so before that there is nothing to report.
 */
export function kindProblem(slots: SlotConfig[], slotId: string, kind: SlotKind): string | null {
  const slot = slots.find(s => s.id === slotId);
  if (!slot) return `Unknown slot ${slotId}`;
  if (!ALL_KINDS.includes(kind)) return `Unknown type ${kind}`;
  if (ONCE_A_DAY.includes(kind)) {
    const other = slots.find(s => s.id !== slotId && s.kind === kind);
    if (other) return `${KIND_META[kind].label} is once a day and already sits at ${other.start}`;
  }
  if (kind === 'winners' && Number(slot.start.slice(0, 2)) < 10) {
    return 'Trivia Winner reports the day that ends at 10:00, so it cannot run before 10:00';
  }
  return null;
}

/** A slot owns one hour: it is the window the article is "the" current one. */
export const SLOT_WINDOW_MIN = 60;
/** A run that has been "generating" this long died mid-flight (maxDuration is 5 min). */
export const STALE_CLAIM_MIN = 10;

/** Berlin calendar date of a moment, `YYYY-MM-DD`. NOT rankingDayKey(): slots are
 *  wall-clock, and the ranking day only rolls over at 10:00. */
export function berlinCalendarDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

/** The instant a Berlin wall-clock time (`HH:MM`) occurs on a Berlin calendar day. */
export function berlinWallTime(dayKey: string, hhmm: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const provisional = new Date(Date.UTC(y, m - 1, d, h, mi, 0));
  return new Date(provisional.getTime() - berlinOffsetMinutes(provisional) * 60000);
}

export function slotTimes(slot: SlotConfig, dayKey: string) {
  const startAt = berlinWallTime(dayKey, slot.start);
  return {
    startAt,
    genAt: new Date(startAt.getTime() - KIND_META[slot.kind].leadMin * 60000),
    endAt: new Date(startAt.getTime() + SLOT_WINDOW_MIN * 60000),
  };
}

export type SlotAction = 'generate' | 'publish' | 'mark-stale' | 'wait' | 'none';

/**
 * What should happen to this slot right now?
 *  - generate:   no run today yet and we are inside [genAt, endAt)
 *  - publish:    the draft is ready and the start time has arrived
 *  - mark-stale: a claim that never finished; recorded as an error, NOT retried
 *                automatically (a retry could create a second article)
 *  - wait:       something is pending but it is not time yet
 *  - none:       disabled, finished, errored, or the window was missed
 *
 * A disabled slot does nothing at all - including publishing a draft that was
 * generated before it was switched off. Off means off.
 */
export function decideAction(slot: SlotConfig, run: RunState | null, now: Date, dayKey: string): SlotAction {
  if (!slot.enabled) return 'none';
  const { startAt, genAt, endAt } = slotTimes(slot, dayKey);
  if (!run) {
    if (now < genAt) return 'wait';
    return now < endAt ? 'generate' : 'none';
  }
  if (run.phase === 'ready') return now >= startAt ? 'publish' : 'wait';
  if (run.phase === 'generating') {
    const claimed = run.claimedAt ? new Date(run.claimedAt).getTime() : 0;
    return now.getTime() - claimed > STALE_CLAIM_MIN * 60000 ? 'mark-stale' : 'wait';
  }
  return 'none';
}

export type DisplayStatus = 'off' | 'waiting' | 'generating' | 'ready' | 'live' | 'error' | 'missed' | 'skipped';

/** One word for the admin window. */
export function displayStatus(slot: SlotConfig, run: RunState | null, now: Date, dayKey: string): DisplayStatus {
  // "published" without an article = the run decided there was nothing to make (e.g. no new songs)
  if (run?.phase === 'published') return run.articleId ? 'live' : 'skipped';
  if (run?.phase === 'error') return 'error';
  if (!slot.enabled) return run?.phase === 'ready' ? 'ready' : 'off';
  if (run?.phase === 'generating') return 'generating';
  if (run?.phase === 'ready') return 'ready';
  return now >= slotTimes(slot, dayKey).endAt ? 'missed' : 'waiting';
}

export function formatRange(slot: SlotConfig): string {
  const [h, m] = slot.start.split(':').map(Number);
  const end = `${String((h + SLOT_WINDOW_MIN / 60) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return `${slot.start} - ${end}`;
}
