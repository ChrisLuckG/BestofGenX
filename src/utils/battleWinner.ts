// Shared QuizzBattle outcome logic — used by both the server (source of truth)
// and the client (display + animations) so the winner is always consistent.
//
// Priority rules:
//   1. The player with MORE correct answers wins.
//   2. If both have the same number of correct answers, the FASTER player
//      (lower total answer time) wins.
//   3. If correct answers AND total time are identical, it's a true tie.

export interface BattleRound {
  correct: boolean;
  timeMs?: number;
}

/**
 * Compare two players' battle results.
 * @returns 1 if side A wins, -1 if side B wins, 0 if tie.
 */
export function compareBattleResults(a: BattleRound[], b: BattleRound[]): 1 | -1 | 0 {
  const aCorrect = a.filter(r => r.correct).length;
  const bCorrect = b.filter(r => r.correct).length;
  if (aCorrect !== bCorrect) return aCorrect > bCorrect ? 1 : -1;

  // Tie on correct answers → the faster player (less total time) wins.
  const aTime = a.reduce((sum, r) => sum + (r.timeMs || 0), 0);
  const bTime = b.reduce((sum, r) => sum + (r.timeMs || 0), 0);
  if (aTime !== bTime) return aTime < bTime ? 1 : -1;

  return 0;
}
