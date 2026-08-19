import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Question from "@/models/Question";
import UserQuestionHistory from "@/models/UserQuestionHistory";
import { themeForTopic } from "@/lib/battleTopics";
import mongoose from "mongoose";

// 6 months cooldown for questions
const QUESTION_COOLDOWN_DAYS = 180;

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { topic, count = 3, player1Id, player2Id } = await request.json();
    
    console.log(`Fetching ${count} battle questions for topic: ${topic || 'random'}`);

    // Build query
    const query: Record<string, unknown> = { active: true };
    if (topic && topic !== 'random' && topic !== 'MIX') {
      const theme = themeForTopic(topic);
      if (!theme) {
        return NextResponse.json(
          { success: false, error: `Unknown topic: ${topic}` },
          { status: 400 }
        );
      }
      query.theme = theme;
    }

    // Get questions both players have seen
    const excludeIds: Set<string> = new Set();
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() - QUESTION_COOLDOWN_DAYS);
    
    for (const playerId of [player1Id, player2Id].filter(Boolean)) {
      const seenHistory = await UserQuestionHistory.find({
        userId: new mongoose.Types.ObjectId(playerId),
        answeredAt: { $gte: cooldownDate }
      }).select('questionId').lean();
      
      seenHistory
        .filter(h => h.questionId)
        .forEach(h => excludeIds.add(h.questionId.toString()));
    }
    
    if (excludeIds.size > 0) {
      query._id = { $nin: Array.from(excludeIds).map(id => new mongoose.Types.ObjectId(id)) };
      console.log(`Excluding ${excludeIds.size} recently seen questions`);
    }

    // Get random questions
    let questions = await Question.aggregate([
      { $match: query },
      { $sample: { size: count } }
    ]);

    // If not enough, include seen questions
    if (questions.length < count && excludeIds.size > 0) {
      console.log(`Not enough unseen (${questions.length}), including all`);
      delete query._id;
      questions = await Question.aggregate([
        { $match: query },
        { $sample: { size: count } }
      ]);
    }
    
    if (!questions || questions.length === 0) {
      console.error('No questions found');
      return NextResponse.json({ success: false, error: "No questions in pool" }, { status: 500 });
    }

    // Transform to battle format
    const result = questions.map(q => {
      const correctIndex = q.options.findIndex((opt: string) => opt === q.correctAnswer);
      
      // Points based on difficulty
      const points = q.difficulty === 'Easy' ? 100 : q.difficulty === 'Medium' ? 200 : 300;
      
      return {
        _id: q._id,
        question: q.question,
        answers: q.options,
        correctIndex: correctIndex >= 0 ? correctIndex : 0,
        difficulty: q.difficulty?.toLowerCase() || "medium",
        points
      };
    });

    console.log(`Successfully fetched ${result.length} questions`);

    return NextResponse.json({
      success: true,
      questions: result
    });

  } catch (error: unknown) {
    console.error("Generate battle questions error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
