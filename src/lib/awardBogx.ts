import User from '@/models/User';
import GameResult from '@/models/GameResult';

// ============================================================
// CENTRAL BOGX EARNING HELPER
// Single source of truth for crediting users with BOGX coins.
//
// Use this for ALL coin-earning actions (articles, voting, song
// requests, referrals, etc.) so that every earning automatically:
//   1. Increments the user's bogxCoins wallet
//   2. Creates a GameResult entry → counts in the rankings
//
// This guarantees the rankings + online/invite lists stay in sync
// with what the user actually earned today.
//
// NOTE: Only use for POSITIVE earnings that should appear in the
// ranking. Do NOT use for refunds, wager deductions, or spending.
// ============================================================

interface AwardBogxOptions {
  userId: string;
  amount: number;          // positive BOGX amount earned
  source: string;          // e.g. 'vote', 'article', 'song-request', 'referral'
  description?: string;    // human-readable description for the GameResult
}

export async function awardBogx({ userId, amount, source, description }: AwardBogxOptions): Promise<number | null> {
  if (!userId || !amount || amount <= 0) return null;

  // 1. Credit the wallet
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { bogxCoins: amount } },
    { new: true }
  );
  if (!updatedUser) return null;

  const afterBogx = updatedUser.bogxCoins || 0;

  // 2. Create GameResult so it counts in the rankings (single source of truth)
  try {
    const today = new Date().toLocaleString('en-CA', {
      timeZone: 'Europe/Berlin',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).split(',')[0];

    await GameResult.create({
      userId,
      username: updatedUser.username || 'Unknown',
      cardId: source,
      question: description || 'BOGX earned',
      userAnswer: null,
      correctAnswer: '-',
      isCorrect: true,
      pointsChange: amount,
      pointsBefore: afterBogx - amount,
      pointsAfter: afterBogx,
      timeUsed: 0,
      difficulty: 1,
      skipped: false,
      timedOut: false,
      gameDate: today,
    });
  } catch (e) {
    console.error(`awardBogx: failed to create GameResult for source=${source}:`, e);
  }

  return afterBogx;
}
