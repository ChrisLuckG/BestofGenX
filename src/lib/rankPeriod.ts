/**
 * Wording for the ranking periods, shared by the mobile Header and the
 * DesktopRankWidget.
 *
 * Client-safe on purpose: no DB imports, so both client components can use it
 * (see the client/server bundling note in AGENTS.md).
 *
 * This lives in one place because the two widgets already drifted apart once -
 * the day showed an explained "?" while month and year showed a silent "—".
 */

export type RankPeriod = 'day' | 'month' | 'year';

/** "daily" / "monthly" / "yearly" */
export function rankPeriodAdjective(period: RankPeriod): string {
  return period === 'day' ? 'daily' : period === 'month' ? 'monthly' : 'yearly';
}

/** "today" / "this month" / "this year" */
export function rankPeriodWindow(period: RankPeriod): string {
  return period === 'day' ? 'today' : period === 'month' ? 'this month' : 'this year';
}

/**
 * Why a period can read "?" at all. A player whose net balance for the window is
 * <= 0 is dropped from that leaderboard entirely, so the three periods routinely
 * disagree - that surprises people, hence the explicit note.
 */
export function rankUnrankedTip(period: RankPeriod): string {
  return `You appear in the ${rankPeriodAdjective(period)} ranking once your balance for ${rankPeriodWindow(period)} is positive. Wrong answers and lost battles reduce it. Day, month and year each count only their own window, so they can differ - a positive day can sit inside a negative month.`;
}

/**
 * What an unranked period shows instead of a rank: the player's own net for the
 * window ("-0,37", or "0,00" before the first game) so they can see how far off a
 * rank they are. "?" only when the value is unknown (guest, still loading).
 */
export function formatUnrankedValue(points?: number): string {
  if (points === undefined || points > 0) return '?';
  if (Math.abs(points) < 0.005) return '0,00';
  return points.toFixed(2).replace('.', ',');
}

/** Same situation, but the visitor has no account yet. */
export function rankUnrankedGuestTip(period: RankPeriod): string {
  return ` to appear in the ${rankPeriodAdjective(period)} ranking and compete with other players.`;
}
