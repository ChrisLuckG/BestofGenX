import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Card from "@/models/Card";

// GET: Check how many cards need splitting
export async function GET() {
  try {
    await dbConnect();
    
    const cardsWithMultipleQuestions = await Card.find({
      'questions.1': { $exists: true } // Has more than 1 question
    }).lean();
    
    const totalQuestions = cardsWithMultipleQuestions.reduce(
      (sum, card) => sum + (card.questions?.length || 0), 0
    );
    
    return NextResponse.json({
      success: true,
      cardsToSplit: cardsWithMultipleQuestions.length,
      totalQuestions,
      willCreate: totalQuestions - cardsWithMultipleQuestions.length // New cards to create
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST: Split all cards with multiple questions into individual cards
export async function POST() {
  try {
    await dbConnect();
    
    const cardsWithMultipleQuestions = await Card.find({
      'questions.1': { $exists: true }
    });
    
    let splitCount = 0;
    let createdCount = 0;
    
    for (const card of cardsWithMultipleQuestions) {
      const questions = card.questions || [];
      if (questions.length <= 1) continue;
      
      // Keep first question in original card
      const firstQuestion = questions[0];
      card.questions = [firstQuestion];
      await card.save();
      
      // Create new cards for remaining questions
      for (let i = 1; i < questions.length; i++) {
        const q = questions[i];
        await Card.create({
          type: card.type,
          theme: card.theme,
          topic: card.topic,
          questions: [q],
          timeLimit: card.timeLimit,
          previewImage: card.previewImage,
          playerImage: card.playerImage,
          active: card.active,
          guestCard: card.guestCard,
          gameDate: card.gameDate,
        });
        createdCount++;
      }
      splitCount++;
    }
    
    return NextResponse.json({
      success: true,
      cardsSplit: splitCount,
      newCardsCreated: createdCount,
      message: `Split ${splitCount} cards, created ${createdCount} new cards`
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
