import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Card from "@/models/Card";
import UserQuestionHistory from "@/models/UserQuestionHistory";
import mongoose from "mongoose";

// 6 months cooldown for questions
const QUESTION_COOLDOWN_DAYS = 180;

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { topic, count = 3, player1Id, player2Id } = await request.json();
    
    console.log(`Fetching ${count} battle questions from Card pool for topic: ${topic || 'random'}`);

    // Build query - get active cards, optionally filter by theme
    const query: Record<string, unknown> = { active: true };
    if (topic && topic !== 'random' && topic !== 'MIX') {
      query.theme = topic.toUpperCase();
    }

    // Get cards both players have seen in the last 6 months
    const excludeCardIds: Set<string> = new Set();
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() - QUESTION_COOLDOWN_DAYS);
    
    for (const playerId of [player1Id, player2Id].filter(Boolean)) {
      const seenHistory = await UserQuestionHistory.find({
        userId: new mongoose.Types.ObjectId(playerId),
        answeredAt: { $gte: cooldownDate }
      }).select('cardId').lean();
      
      seenHistory.forEach(h => excludeCardIds.add(h.cardId.toString()));
    }
    
    if (excludeCardIds.size > 0) {
      query._id = { $nin: Array.from(excludeCardIds).map(id => new mongoose.Types.ObjectId(id)) };
      console.log(`Excluding ${excludeCardIds.size} recently seen cards`);
    }

    // Get all matching cards from the pool
    const cards = await Card.find(query).lean();
    
    if (!cards || cards.length === 0) {
      console.error('No cards found in pool');
      return NextResponse.json({ success: false, error: "No cards in pool" }, { status: 500 });
    }

    // Flatten all questions from all cards
    interface QuestionFromCard {
      question: string;
      options: (string | number)[];
      correctAnswer: string | number;
      difficulty: number;
      difficultyText: string;
      maxReward: number;
    }
    
    const allQuestions: { card: typeof cards[0]; q: QuestionFromCard }[] = [];
    for (const card of cards) {
      if (card.questions && Array.isArray(card.questions)) {
        for (const q of card.questions as QuestionFromCard[]) {
          allQuestions.push({ card, q });
        }
      }
    }

    if (allQuestions.length < count) {
      console.error(`Not enough questions: have ${allQuestions.length}, need ${count}`);
      return NextResponse.json({ success: false, error: "Not enough questions in pool" }, { status: 500 });
    }

    // Shuffle and pick random questions
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    // Transform to battle format
    const questions = selected.map(({ q }) => {
      // Find correct answer index
      const correctIndex = q.options.findIndex(opt => String(opt) === String(q.correctAnswer));
      
      // Calculate points based on difficulty
      const points = q.difficulty === 1 ? 100 : q.difficulty === 3 ? 200 : 300;
      
      return {
        question: q.question,
        answers: q.options.map(String),
        correctIndex: correctIndex >= 0 ? correctIndex : 0,
        difficulty: q.difficultyText?.toLowerCase() || "medium",
        points
      };
    });

    console.log(`Successfully fetched ${questions.length} questions from Card pool`);

    return NextResponse.json({
      success: true,
      questions
    });

  } catch (error: unknown) {
    console.error("Generate battle questions error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
