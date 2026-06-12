import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import UserQuestionHistory from '@/models/UserQuestionHistory';
import Card from '@/models/Card';
import mongoose from 'mongoose';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { userId, cardId, questionText, correct, context = 'game', battleId } = await request.json();

    if (!userId || !questionText) {
      return NextResponse.json({ success: false, error: 'Missing userId or questionText' }, { status: 400 });
    }

    // Generate question hash
    const questionHash = crypto.createHash('md5')
      .update(questionText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim())
      .digest('hex');

    // Find card by question if cardId not provided
    let actualCardId = cardId;
    if (!actualCardId) {
      const card = await Card.findOne({ 'questions.question': questionText }).select('_id');
      actualCardId = card?._id?.toString();
    }

    if (!actualCardId) {
      // Create a placeholder - question might be from AI generation
      console.log('No card found for question, skipping history record');
      return NextResponse.json({ success: true, skipped: true });
    }

    // Record the answer
    await UserQuestionHistory.create({
      userId: new mongoose.Types.ObjectId(userId),
      cardId: new mongoose.Types.ObjectId(actualCardId),
      questionHash,
      correct: !!correct,
      context,
      battleId: battleId ? new mongoose.Types.ObjectId(battleId) : undefined,
      answeredAt: new Date(),
    });

    // Update card stats
    await Card.findByIdAndUpdate(actualCardId, {
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
