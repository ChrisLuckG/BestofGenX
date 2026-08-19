import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import UserQuestionHistory from '@/models/UserQuestionHistory';
import Question from '@/models/Question';
import mongoose from 'mongoose';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { userId, questionId, questionText, correct, context = 'game', battleId } = await request.json();

    if (!userId || !questionText) {
      return NextResponse.json({ success: false, error: 'Missing userId or questionText' }, { status: 400 });
    }

    // Generate question hash
    const questionHash = crypto.createHash('md5')
      .update(questionText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim())
      .digest('hex');

    // Find question by ID or text
    let actualQuestionId = questionId;
    if (!actualQuestionId) {
      const question = await Question.findOne({ question: questionText }).select('_id');
      actualQuestionId = question?._id?.toString();
    }

    if (!actualQuestionId) {
      console.log('No question found, skipping history record');
      return NextResponse.json({ success: true, skipped: true });
    }

    // Record the answer
    await UserQuestionHistory.create({
      userId: new mongoose.Types.ObjectId(userId),
      questionId: new mongoose.Types.ObjectId(actualQuestionId),
      questionHash,
      correct: !!correct,
      context,
      battleId: battleId ? new mongoose.Types.ObjectId(battleId) : undefined,
      answeredAt: new Date(),
    });

    // Update question stats
    await Question.findByIdAndUpdate(actualQuestionId, {
      $inc: {
        timesPlayed: 1,
        timesCorrect: correct ? 1 : 0,
      }
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Record answer error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
