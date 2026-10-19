// "Goes to 11" - how loud do you turn this GenXer up? (Spinal Tap: "These go to eleven.")
// One vote per user and PERSON (not per article): every article about the same person feeds the same
// number, which is stored on the Person (volumeAvg, volumeCount) so lists can show and sort by it.
// Replaces the mood emojis under person articles - readers rate the person, not the article text.
//
// Dependency-free: the article page, the feed badge and the API all use it.

export const VOLUME_MIN = 1;
export const VOLUME_MAX = 11;

export const isVolume = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= VOLUME_MIN && (v as number) <= VOLUME_MAX;

/** "8.7" (one decimal), "11" for a clean eleven, "-" without votes */
export function formatVolume(avg: number | null | undefined, count = 1): string {
  if (!count || avg == null || !Number.isFinite(avg)) return '–';
  const r = Math.round(avg * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** The words for a level */
export function volumeLabel(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return 'Not turned up yet';
  if (v < 3.5) return 'Background noise';
  if (v < 6.5) return 'Easy listening';
  if (v < 9.5) return 'Cranked up';
  if (v < 10.75) return 'Full blast';
  return 'This one goes to 11';
}

/** Colour of segment n (1..11): green -> yellow -> orange -> red, 11 glows */
export function segmentColor(n: number): string {
  if (n >= 11) return '#dc2626';
  if (n >= 9) return '#ea580c';
  if (n >= 7) return '#E36B11';
  if (n >= 5) return '#eab308';
  return '#16a34a';
}

/** Mean of the votes, or null without any */
export function averageVolume(values: number[]): { avg: number | null; count: number } {
  const ok = values.filter(isVolume);
  return { avg: ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null, count: ok.length };
}
