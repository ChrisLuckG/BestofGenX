import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * POST /api/battles/[id]/round
 *
 * Per-round persistence, so a reload can neither replay a question nor escape one.
 *
 * Three actions:
 *  - `start`  the player is now looking at round N. Recorded BEFORE the question is
 *             answered, because that record is the only thing that distinguishes
 *             "never reached this round" from "saw it and walked away".
 *  - `answer` the player answered round N.
 *  - `resume` the player is coming back to the battle. Any round that was started
 *             but never answered is closed as wrong (`abandoned`), and the
 *             authoritative next round is returned.
 *
 * A round left open counts as lost, not as "not played". Anything else pays for
 * refreshing: see a hard question, reload, get it again.
 */

const MAX_POINTS_PER_ROUND = 0.30;

type StoredResult = {
  round: number;
  correct: boolean;
  timeMs: number;
  points: number;
  answerIndex: number;
  abandoned?: boolean;
  answeredAt: Date;
};

/**
 * Close every round that was started but never answered.
 * Returns the results array as it now stands on the server.
 */
function closeAbandonedRounds(
  results: StoredResult[],
  roundsStarted: number,
  totalRounds: number
): { results: StoredResult[]; added: StoredResult[] } {
  const upTo = Math.min(roundsStarted, totalRounds);
  const added: StoredResult[] = [];
  for (let round = results.length; round < upTo; round++) {
    added.push({
      round,
      correct: false,
      timeMs: 10000,
      points: 0,
      answerIndex: -1,
      abandoned: true,
      answeredAt: new Date(),
    });
  }
  return { results: [...results, ...added], added };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, action = 'answer', round, correct, timeMs, points, answerIndex } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: "Missing userId" }, { status: 400 });
    }
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid battle id" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const battles = db.collection("battles");

    const battle = await battles.findOne({ _id: new ObjectId(id) });
    if (!battle) {
      return NextResponse.json({ success: false, error: "Battle not found" }, { status: 404 });
    }

    const creatorId = battle.creator?._id?.toString() || battle.creator?.toString();
    const opponentId = battle.opponent?._id?.toString() || battle.opponent?.toString();
    const isCreator = creatorId === userId;
    const isOpponent = opponentId === userId;
    if (!isCreator && !isOpponent) {
      return NextResponse.json({ success: false, error: "You are not part of this battle" }, { status: 403 });
    }

    const resultsField = isCreator ? "creatorResults" : "opponentResults";
    const totalField = isCreator ? "creatorTotalPoints" : "opponentTotalPoints";
    const startedField = isCreator ? "creatorRoundsStarted" : "opponentRoundsStarted";

    const totalRounds = battle.rounds || 0;
    const stored: StoredResult[] = battle[resultsField] || [];
    const roundsStarted: number = battle[startedField] || 0;

    // ── resume ──────────────────────────────────────────────────────────────
    if (action === 'resume') {
      const { results, added } = closeAbandonedRounds(stored, roundsStarted, totalRounds);
      if (added.length > 0) {
        await battles.updateOne(
          { _id: new ObjectId(id) },
          { $set: { [resultsField]: results } }
        );
      }
      return NextResponse.json({
        success: true,
        results,
        nextRound: results.length,
        abandonedRounds: added.map(r => r.round),
        totalPoints: battle[totalField] || 0,
        finished: results.length >= totalRounds,
      });
    }

    // ── start ───────────────────────────────────────────────────────────────
    if (action === 'start') {
      if (typeof round !== 'number' || round < 0 || round >= totalRounds) {
        return NextResponse.json({ success: false, error: "Invalid round" }, { status: 400 });
      }
      // The only round a player may open is the one after their last answer.
      if (round !== stored.length) {
        return NextResponse.json({
          success: false,
          error: "Not the current round",
          expectedRound: stored.length,
        }, { status: 409 });
      }
      if (roundsStarted < round + 1) {
        await battles.updateOne(
          { _id: new ObjectId(id) },
          { $set: { [startedField]: round + 1 } }
        );
      }
      return NextResponse.json({ success: true, round });
    }

    // ── answer ──────────────────────────────────────────────────────────────
    if (typeof round !== 'number' || round < 0 || round >= totalRounds) {
      return NextResponse.json({ success: false, error: "Invalid round" }, { status: 400 });
    }
    if (stored.length > round) {
      // Already recorded - either a duplicate send or an attempt to redo a round
      // that was closed as abandoned. The stored result stands.
      return NextResponse.json({
        success: false,
        error: "Round already recorded",
        storedResult: stored[round],
      }, { status: 409 });
    }
    if (stored.length < round) {
      return NextResponse.json({
        success: false,
        error: "Cannot skip rounds",
        expectedRound: stored.length,
      }, { status: 400 });
    }

    const isCorrect = !!correct;
    const result: StoredResult = {
      round,
      correct: isCorrect,
      timeMs: Math.min(Math.max(0, Number(timeMs) || 0), 10000),
      points: isCorrect
        ? Math.min(Math.max(0, Number(points) || 0), MAX_POINTS_PER_ROUND)
        : 0,
      answerIndex: typeof answerIndex === 'number' ? answerIndex : -1,
      answeredAt: new Date(),
    };

    const newTotal = (battle[totalField] || 0) + result.points;
    await battles.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          [resultsField]: [...stored, result],
          [totalField]: newTotal,
          [startedField]: Math.max(roundsStarted, round + 1),
        },
      }
    );

    return NextResponse.json({
      success: true,
      round,
      roundsAnswered: stored.length + 1,
      totalPoints: newTotal,
    });
  } catch (error) {
    console.error("Error saving round:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
