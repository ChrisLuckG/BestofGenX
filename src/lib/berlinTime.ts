// Helpers for working with Europe/Berlin (CET/CEST) time without external libs.
// Vercel servers run in UTC, so we must convert explicitly to keep the
// 9:00 CET game/prediction break correct year-round (handles DST).

/** Returns the Europe/Berlin UTC offset in minutes for the given date. */
export function berlinOffsetMinutes(date: Date): number {
  // Format the date in Berlin and in UTC, then diff them.
  const tzName = 'Europe/Berlin';
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tzName,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  // Reconstruct the wall-clock time Berlin shows, as if it were UTC
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour === '24' ? '0' : map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

/** The ranking day starts at this Berlin wall-clock hour. */
export const RANKING_DAY_START_HOUR = 10;

/**
 * Key of the RANKING day a moment belongs to, as `YYYY-MM-DD`.
 *
 * The ranking day runs from 10:00 Berlin to the next 10:00, so anything before
 * 10:00 still belongs to the previous day. This is the ONLY correct way to ask
 * "which day does this count towards" - a UTC or browser-local midnight lands
 * inside the ranking day and rolls the key over halfway through it.
 *
 * Deliberately dependency-free so client components can import it too.
 */
export function rankingDayKey(date: Date = new Date()): string {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;

  const hour = Number(map.hour === '24' ? '0' : map.hour);
  // Build the Berlin calendar date, then step back a day before the cutoff.
  const d = new Date(Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day)));
  if (hour < RANKING_DAY_START_HOUR) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns a Date representing `hour:00` Berlin local time, `dayOffset` days
 * from today (0 = today, 1 = tomorrow, ...).
 */
export function berlinDateAt(dayOffset: number, hour: number, minute = 0): Date {
  const now = new Date();
  // Get today's Berlin calendar date
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [y, m, d] = dtf.format(now).split('-').map(Number);

  // Build a provisional UTC timestamp for that wall-clock time
  const provisional = new Date(Date.UTC(y, m - 1, d + dayOffset, hour, minute, 0));
  // Adjust by the Berlin offset for that moment
  const offset = berlinOffsetMinutes(provisional);
  return new Date(provisional.getTime() - offset * 60000);
}
