import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import GameResult from '@/models/GameResult';
import Battle from '@/models/Battle';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    
    const user = await User.findById(params.id).select('-password');
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userId = String(user._id);

    // Get user's rank (by BOGX balance — single source of truth)
    const higherRanked = await User.countDocuments({ bogxCoins: { $gt: user.bogxCoins || 0 } });
    const rank = higherRanked + 1;

    // ===========================================================
    // REAL STATS, computed from authoritative records.
    //  - Solo trivia: each GameResult (cardId != 'quizzbattle') is one
    //    answered question with real isCorrect + timeUsed (seconds).
    //  - QuizzBattle: per-round correctness/time live on the Battle doc.
    //    GameResult 'quizzbattle' rows are battle-level (win/loss), so we
    //    DON'T use them for question accuracy.
    // ===========================================================

    // Solo questions (exclude battle marker rows and skipped questions)
    const soloResults = await GameResult.find({
      userId,
      cardId: { $ne: 'quizzbattle' },
      skipped: { $ne: true },
    }).select('isCorrect timeUsed').lean();

    let questionsAnswered = soloResults.length;
    let questionsCorrect = soloResults.filter(r => r.isCorrect).length;
    let totalTimeMs = soloResults.reduce((sum, r) => sum + (r.timeUsed || 0) * 1000, 0);

    // QuizzBattle: completed battles the user took part in.
    const battles = await Battle.find({
      status: 'completed',
      $or: [{ creator: userId }, { opponent: userId }],
    }).select('creator opponent winner creatorResults opponentResults').lean();

    let quizzWins = 0;
    let quizzLosses = 0;

    for (const b of battles) {
      const isCreator = String(b.creator) === userId;
      const myResults = (isCreator ? b.creatorResults : b.opponentResults) || [];

      // Per-round accuracy + time (timeMs is in milliseconds)
      for (const r of myResults) {
        questionsAnswered += 1;
        if (r.correct) questionsCorrect += 1;
        totalTimeMs += r.timeMs || 0;
      }

      // Win/Loss (ties — no winner — are excluded from both)
      if (b.winner) {
        if (String(b.winner) === userId) quizzWins += 1;
        else quizzLosses += 1;
      }
    }

    const accuracy = questionsAnswered > 0
      ? (questionsCorrect / questionsAnswered) * 100
      : null;

    const avgAnswerTime = questionsAnswered > 0
      ? totalTimeMs / questionsAnswered // milliseconds
      : null;

    // Win rate based on actual quizzbattle outcomes
    const totalBattles = quizzWins + quizzLosses;
    const winRate = totalBattles > 0 ? (quizzWins / totalBattles) * 100 : 0;

    return NextResponse.json({
      _id: user._id,
      username: user.username,
      avatar: user.avatar,
      country: user.country,
      countryFlag: user.countryFlag,
      points: user.bogxCoins || 0,
      bogxCoins: user.bogxCoins || 0,
      wins: user.wins,
      gamesPlayed: user.gamesPlayed,
      createdAt: user.createdAt,
      rank,
      // Real quizzbattle record
      quizzWins,
      quizzLosses,
      // Real question-level stats (solo + quizzbattle rounds)
      questionsAnswered,
      questionsCorrect,
      winRate,
      avgAnswerTime, // milliseconds
      accuracy,      // 0-100
      currentStreak: null, // TODO: Implement streak tracking
      bestStreak: null,    // TODO: Implement streak tracking
    });

  } catch (error: any) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user stats' },
      { status: 500 }
    );
  }
}
