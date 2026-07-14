import User from '@/models/User';
import GameResult from '@/models/GameResult';

// ============================================================
// Ledger helper for Prediction wins/losses.
//
// Wagers are deducted (no GameResult) when a user places a
// prediction, and winnings are credited (no GameResult) when a
// prediction resolves. This helper records the NET effect of a
// resolved prediction (win: +wager, loss: -wager) as a single
// GameResult so the wallet (bogxCoins) and the ranking ledger
// (sum of GameResult.pointsChange) stay in sync.
// ============================================================

export async function savePredictionGameResult(
  userId: string,
  questionText: string,
  pointsChange: number,
  won: boolean
): Promise<void> {
  try {
    const user = await User.findById(userId).select('username bogxCoins');
    if (!user) return;

    const today = new Date().toLocaleString('en-CA', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).split(',')[0];

    await GameResult.create({
      userId,
      username: user.username,
      cardId: 'prediction',
      question: `Prediction: ${questionText}`,
      userAnswer: null,
      correctAnswer: '-',
      isCorrect: won,
      pointsChange,
      pointsBefore: (user.bogxCoins || 0) - pointsChange,
      pointsAfter: user.bogxCoins || 0,
      timeUsed: 0,
      difficulty: 1,
      skipped: false,
      timedOut: false,
      gameDate: today,
    });
  } catch (e) {
    console.error('Failed to save prediction GameResult:', e);
  }
}
