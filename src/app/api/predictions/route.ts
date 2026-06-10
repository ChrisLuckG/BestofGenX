import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Prediction from '@/models/Prediction';
import UserPrediction from '@/models/UserPrediction';
import User from '@/models/User';

// GET - List predictions for users:
// - Active predictions that are still open (next 3 days)
// - Resolved predictions from the last 7 days (with results)
// If userId is provided, include the user's existing pick per prediction.
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch active (still open) predictions
    const activePredictions = await Prediction.find({
      status: 'active',
      closesAt: { $gt: now },
    })
      .sort({ closesAt: 1 })
      .limit(50)
      .lean();

    // Fetch resolved predictions from the last 7 days
    const resolvedPredictions = await Prediction.find({
      status: 'resolved',
      closesAt: { $gte: sevenDaysAgo },
    })
      .sort({ closesAt: -1 })
      .limit(30)
      .lean();

    const allPredictions = [...activePredictions, ...resolvedPredictions];

    let picksMap: Record<string, string> = {};
    if (userId && allPredictions.length > 0) {
      const ids = allPredictions.map((p) => p._id);
      const picks = await UserPrediction.find({
        userId,
        predictionId: { $in: ids },
      })
        .select('predictionId optionId')
        .lean();
      picksMap = picks.reduce((acc, pick) => {
        acc[String(pick.predictionId)] = pick.optionId;
        return acc;
      }, {} as Record<string, string>);
    }

    const result = allPredictions.map((p: any) => ({
      _id: p._id,
      question: p.question,
      category: p.category,
      options: p.options,
      pointsReward: p.pointsReward,
      closesAt: p.closesAt,
      genXRelated: p.genXRelated,
      status: p.status,
      correctOptionId: p.correctOptionId || null,
      myPick: picksMap[String(p._id)] || null,
    }));

    return NextResponse.json({ success: true, predictions: result });
  } catch (error: any) {
    console.error('predictions list error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Submit (or change) a prediction for the current user.
// First-time predictions deduct points as a wager; changing picks is free.
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const { userId, predictionId, optionId } = await request.json();

    if (!userId || !predictionId || !optionId) {
      return NextResponse.json(
        { success: false, error: 'userId, predictionId and optionId are required' },
        { status: 400 }
      );
    }

    const prediction = await Prediction.findById(predictionId);
    if (!prediction) {
      return NextResponse.json({ success: false, error: 'Prediction not found' }, { status: 404 });
    }
    if (prediction.status !== 'active') {
      return NextResponse.json({ success: false, error: 'Prediction is not active' }, { status: 400 });
    }
    if (new Date(prediction.closesAt) <= new Date()) {
      return NextResponse.json({ success: false, error: 'Prediction is closed' }, { status: 400 });
    }
    if (!prediction.options.some((o) => o.id === optionId)) {
      return NextResponse.json({ success: false, error: 'Invalid option' }, { status: 400 });
    }

    const wager = prediction.pointsReward; // The wager equals the potential reward

    // Check if user already has a prediction (changing pick is free)
    const existing = await UserPrediction.findOne({ predictionId, userId });
    if (existing) {
      // Just change the pick, no additional cost
      existing.optionId = optionId;
      await existing.save();
      return NextResponse.json({ success: true, changed: true });
    }

    // New prediction: check if user has enough points
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    if (user.points < wager) {
      return NextResponse.json(
        { success: false, error: 'Not enough points', required: wager, available: user.points },
        { status: 400 }
      );
    }

    // Deduct points and create prediction
    await User.findByIdAndUpdate(userId, { $inc: { points: -wager } });
    await UserPrediction.create({ predictionId, userId, optionId, wager });
    await Prediction.findByIdAndUpdate(predictionId, { $inc: { totalPredictions: 1 } });

    return NextResponse.json({ success: true, wagerDeducted: wager });
  } catch (error: any) {
    console.error('predictions submit error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
