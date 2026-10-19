// The dates in the people collection come in TWO shapes, from two imports:
//   "1969-10-18"  (49,637 people)      and      "18.10.1969"  (92,845 people),
// plus a few garbage values (a death date of "http://www"). Anything that asks "who was born / who
// died on this day or in this month" has to understand both, or it silently sees only a third of the
// data: the birthday pick missed 41% of the people who qualify, the Menschen month filter ("-10-")
// missed every "18.10.1969", and a death-month filter would have missed two thirds of the deceased.
//
// This is the ONE place that knows the shapes. Dependency-free: server and client import it.

export interface DateParts { year: number; month: number; day: number }

/** "1969-10-18" (optionally with a time) or "18.10.1969" -> parts; anything else (or an impossible date) -> null. */
export function parseDateShape(value?: string | null): DateParts | null {
  if (!value || typeof value !== 'string') return null;
  const s = value.trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const parts = iso ? { year: +iso[1], month: +iso[2], day: +iso[3] } : de ? { year: +de[3], month: +de[2], day: +de[1] } : null;
  if (!parts || parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31) return null;
  return parts;
}

/** Gen X = born 1965 to 1980. The whole site is about them, and every automatic pick (birthday, RIP)
 *  checks it explicitly - today the collection holds nobody else, but an import must not change that. */
export const GENX_FIRST_YEAR = 1965;
export const GENX_LAST_YEAR = 1980;
export function isGenXBirth(born?: string | null): boolean {
  const p = parseDateShape(born);
  return !!p && p.year >= GENX_FIRST_YEAR && p.year <= GENX_LAST_YEAR;
}

/** Patterns for "this day of the year" and "this month" (either shape, with or without a leading zero). */
export function dayMatchers(dayKey: string): { day: RegExp; month: RegExp } {
  const [, mm, dd] = dayKey.split('-');
  const m = String(Number(mm)), d = String(Number(dd));
  return {
    day: new RegExp(`^(?:\\d{4}-${mm}-${dd}(?:T.*)?|0?${d}\\.0?${m}\\.\\d{4})$`),
    month: monthMatcher(Number(mm)),
  };
}

/** Pattern for "any day of month 1-12", either shape. */
export function monthMatcher(month: number): RegExp {
  const mm = String(month).padStart(2, '0');
  return new RegExp(`^(?:\\d{4}-${mm}-\\d{2}(?:T.*)?|\\d{1,2}\\.0?${month}\\.\\d{4})$`);
}
