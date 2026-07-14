import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Prediction from '@/models/Prediction';
import UserPrediction from '@/models/UserPrediction';
import User from '@/models/User';
import Notification from '@/models/Notification';
import { sendPushNotification } from '@/lib/webpush';
import { savePredictionGameResult } from '@/lib/predictionGameResult';

// GET - List predictions for admin (optionally filtered by status)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const filter: Record<string, unknown> = {};
    if (status && status !== 'all') filter.status = status;

    const predictions = await Prediction.find(filter)
      .sort({ closesAt: 1, createdAt: -1 })
      .limit(300)
      .lean();

    // Aggregate vote counts per option for each prediction
    const predictionIds = predictions.map((p) => p._id);
    const counts = await UserPrediction.aggregate([
      { $match: { predictionId: { $in: predictionIds } } },
      { $group: { _id: { predictionId: '$predictionId', optionId: '$optionId' }, count: { $sum: 1 } } },
    ]);

    // Build a lookup: predictionId -> { optionId -> count }
    const statsByPrediction: Record<string, Record<string, number>> = {};
    for (const c of counts) {
      const pid = String(c._id.predictionId);
      if (!statsByPrediction[pid]) statsByPrediction[pid] = {};
      statsByPrediction[pid][c._id.optionId] = c.count;
    }

    // Attach per-option vote count + percent (of total votes for that prediction)
    const withStats = predictions.map((p) => {
      const optionCounts = statsByPrediction[String(p._id)] || {};
      const total = Object.values(optionCounts).reduce((sum, n) => sum + n, 0);
      const optionStats = p.options.map((o) => {
        const votes = optionCounts[o.id] || 0;
        const percent = total > 0 ? Math.round((votes / total) * 100) : 0;
        return { id: o.id, votes, percent };
      });
      return { ...p, optionStats, totalVotes: total };
    });

    return NextResponse.json({ success: true, predictions: withStats });
  } catch (error: any) {
    console.error('admin predictions list error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Create a manual prediction
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    const { question, category, options, closesAt, eventDate, pointsReward, genXRelated } = body;

    if (!question || !Array.isArray(options) || options.length < 2 || !closesAt) {
      return NextResponse.json(
        { success: false, error: 'question, at least 2 options and closesAt are required' },
        { status: 400 }
      );
    }

    const normalizedOptions = options
      .map((o: any, i: number) => ({
        id: o.id || String.fromCharCode(97 + i),
        label: typeof o === 'string' ? o : o.label,
      }))
      .filter((o: any) => o.label);

    const created = await Prediction.create({
      question,
      category: category || 'other',
      options: normalizedOptions,
      closesAt: new Date(closesAt),
      eventDate: eventDate ? new Date(eventDate) : new Date(closesAt),
      pointsReward: Number(pointsReward) || 100,
      genXRelated: Boolean(genXRelated),
      source: 'manual',
      status: 'active',
    });

    return NextResponse.json({ success: true, prediction: created });
  } catch (error: any) {
    console.error('admin predictions create error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH - Update status, approve (draft->active), edit, or resolve a prediction.
// Resolving with a correctOptionId awards flat points to correct predictors.
export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    const { id, status, correctOptionId, question, options, closesAt, pointsReward } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
    }

    const prediction = await Prediction.findById(id);
    if (!prediction) {
      return NextResponse.json({ success: false, error: 'Prediction not found' }, { status: 404 });
    }

    // Inline edits (only while not resolved)
    if (prediction.status !== 'resolved') {
      if (typeof question === 'string') prediction.question = question;
      if (Array.isArray(options) && options.length >= 2) {
        prediction.options = options.map((o: any, i: number) => ({
          id: o.id || String.fromCharCode(97 + i),
          label: typeof o === 'string' ? o : o.label,
        }));
      }
      if (closesAt) prediction.closesAt = new Date(closesAt);
      if (pointsReward !== undefined) prediction.pointsReward = Number(pointsReward) || prediction.pointsReward;
    }

    // Status transition
    if (status && ['draft', 'active', 'cancelled'].includes(status)) {
      prediction.status = status;
    }

    // Resolution: set correct option and award points
    let awarded = 0;
    if (correctOptionId) {
      const valid = prediction.options.some((o) => o.id === correctOptionId);
      if (!valid) {
        return NextResponse.json({ success: false, error: 'correctOptionId is not a valid option' }, { status: 400 });
      }

      prediction.correctOptionId = correctOptionId;
      prediction.status = 'resolved';
      prediction.resolvedAt = new Date();
      await prediction.save();

      // Grade all user predictions and push a result notification to each user
      // Winners get 2x their wager (wager was already deducted, so they get wager + winnings)
      const userPredictions = await UserPrediction.find({ predictionId: prediction._id, isCorrect: null });
      const correctOption = prediction.options.find((o) => o.id === correctOptionId);
      const winAmount = prediction.pointsReward * 2; // Double the wager for winners
      
      for (const up of userPredictions) {
        const correct = up.optionId === correctOptionId;
        up.isCorrect = correct;
        up.pointsAwarded = correct ? winAmount : 0;
        await up.save();

        const userDoc = await User.findByIdAndUpdate(
          up.userId,
          correct
            ? { $inc: { bogxCoins: winAmount, gamesPlayed: 1, wins: 1 } }
            : { $inc: { gamesPlayed: 1 } },
          { new: true }
        ).select('pushSubscription notifyBattleResults');

        if (correct) awarded++;

        // Track net wager effect for ranking ledger (win: +wager, loss: -wager)
        await savePredictionGameResult(
          String(up.userId),
          prediction.question,
          correct ? prediction.pointsReward : -prediction.pointsReward,
          correct
        );

        // Create in-app notification
        try {
          await Notification.create({
            userId: up.userId,
            type: 'prediction_result',
            title: correct ? 'Prediction Won!' : 'Prediction Lost',
            message: correct
              ? `You called "${prediction.question}" right! +${winAmount}P earned!`
              : `"${prediction.question}" was "${correctOption?.label || 'revealed'}". You lost ${prediction.pointsReward}P.`,
            read: false,
            // Store prediction data for the result modal
            predictionId: prediction._id,
            predictionQuestion: prediction.question,
            predictionOptions: prediction.options,
            predictionCorrectOptionId: correctOptionId,
            userOptionId: up.optionId,
            pointsAwarded: correct ? winAmount : 0,
            pointsReward: prediction.pointsReward,
            won: correct,
          });
        } catch (notifError) {
          console.error('prediction in-app notification failed:', notifError);
        }

        // Fire a push if the user opted in (mirrors battle-result behaviour)
        if (userDoc?.pushSubscription && userDoc.notifyBattleResults !== false) {
          sendPushNotification(
            userDoc.pushSubscription,
            {
              title: correct ? 'Prediction Won!' : 'Prediction Lost',
              body: correct
                ? `You called "${prediction.question}" right! +${winAmount}P earned!`
                : `"${prediction.question}" was "${correctOption?.label || 'revealed'}". You lost ${prediction.pointsReward}P.`,
              tag: `prediction-result-${prediction._id}`,
              url: '/mobile?tab=notifications',
            },
            String(up.userId)
          ).catch((err) => console.error('prediction push failed:', err));
        }
      }

      return NextResponse.json({ success: true, prediction, awarded });
    }

    await prediction.save();
    return NextResponse.json({ success: true, prediction });
  } catch (error: any) {
    console.error('admin predictions update error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Remove a prediction and its user predictions
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
    }

    await Prediction.findByIdAndDelete(id);
    await UserPrediction.deleteMany({ predictionId: id });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('admin predictions delete error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
