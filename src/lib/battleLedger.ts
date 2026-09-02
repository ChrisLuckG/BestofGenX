import User from '@/models/User';
import GameResult from '@/models/GameResult';

// ============================================================
// QUIZZBATTLE LEDGER ENTRY
//
// Ledger-only counterpart to awardBogx. The battle routes move the wallet
// themselves (wager escrow on create/accept, pot payout on settle), so this
// writes ONLY the GameResult entry that the rankings sum up.
//
// `pointsChange` is the NET outcome for that player — +wager on a win,
// -wager on a loss, 0 on a tie — NOT the pot. The stake already left the
// wallet when the battle was created or accepted, and that escrow is
// deliberately not journaled; booking the pot here would double-count it.
//
// Every settlement path (submit, complete, forfeit) must call this, otherwise
// the wallet and the ranking drift apart permanently: forfeits used to pay out
// the pot without any ledger entry, which is why a yearly ranking could show
// 103.00 while the coin pill showed 101.07.
// ============================================================

export async function saveBattleGameResult(
  userId: string,
  opponentName: string,
  pointsChange: number,
  won: boolean
) {
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
      cardId: 'quizzbattle',
      question: `QuizzBattle vs ${opponentName}`,
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
    console.error('Failed to save battle GameResult:', e);
  }
}
