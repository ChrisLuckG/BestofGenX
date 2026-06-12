import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import Card from '@/models/Card';
import GameResult from '@/models/GameResult';

// POST - Simulate daily bot activity (realistic: play all today's cards once)
export async function POST() {
  try {
    await dbConnect();
    
    const bots = await User.find({ isBot: true });
    
    if (bots.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No bots found. Create bots first.' 
      }, { status: 400 });
    }

    // Get all active cards (no date filtering)
    const todaysCards = await Card.find({
      active: true,
      guestCard: false, // Bots play logged-in cards
    });

    // Count questions (each card has 3 difficulty variants, bot picks one)
    const totalQuestions = todaysCards.length;
    
    if (totalQuestions === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No cards for today',
        botsUpdated: 0 
      });
    }
    
    const updates = [];
    
    for (const bot of bots) {
      // Realistic: Bot plays 10-30 questions per day (not all!)
      const questionsToPlay = Math.min(
        Math.floor(10 + Math.random() * 20), // 10-30 questions
        totalQuestions
      );
      
      // Shuffle cards and pick random subset
      const shuffledCards = [...todaysCards].sort(() => Math.random() - 0.5);
      const cardsToPlay = shuffledCards.slice(0, questionsToPlay);
      
      const botSkill = 0.5 + Math.random() * 0.35; // 50-85% accuracy (realistic)
      let totalPoints = 0;
      let wins = 0;
      
      const today = new Date().toISOString().split('T')[0];
      
      for (let i = 0; i < cardsToPlay.length; i++) {
        const card = cardsToPlay[i];
        // Bot picks random difficulty: 1=Easy, 2=Medium, 3=Hard (BOGX rewards)
        const difficulty = Math.random() < 0.5 ? 1 : Math.random() < 0.7 ? 2 : 3;
        const maxReward = difficulty === 1 ? 0.05 : difficulty === 2 ? 0.10 : 0.15; // BOGX
        const penalty = difficulty === 1 ? 0.01 : difficulty === 2 ? 0.05 : 0.10; // BOGX
        
        // Did bot answer correctly?
        const correct = Math.random() < botSkill;
        
        let pointsChange = 0;
        if (correct) {
          // Points based on "time" - faster = more points (50-100% of max)
          const timeBonus = 0.5 + Math.random() * 0.5;
          pointsChange = Math.round(maxReward * timeBonus * 100) / 100; // BOGX
          totalPoints += pointsChange;
          wins++;
        } else {
          pointsChange = -penalty;
          totalPoints += pointsChange;
        }
        
        // Create GameResult entry so bot appears in rankings
        await GameResult.create({
          userId: bot._id,
          username: bot.username,
          cardId: card._id,
          question: card.questions?.[0]?.question || 'Bot question',
          userAnswer: correct ? 'correct' : 'wrong',
          correctAnswer: 'correct',
          isCorrect: correct,
          pointsChange,
          pointsBefore: bot.points + totalPoints - pointsChange,
          pointsAfter: bot.points + totalPoints,
          timeUsed: Math.floor(Math.random() * 8) + 2,
          difficulty,
          skipped: false,
          timedOut: false,
          gameDate: today,
        });
      }
      
      // Ensure points don't go below 0
      const newPoints = Math.max(0, bot.points + totalPoints);
      
      await User.findByIdAndUpdate(bot._id, {
        points: newPoints,
        wins: bot.wins + wins,
        gamesPlayed: bot.gamesPlayed + cardsToPlay.length,
      });
      
      updates.push({
        username: bot.username,
        questionsPlayed: cardsToPlay.length,
        correct: wins,
        pointsChange: Math.round(totalPoints * 100) / 100,
        newPoints: Math.round(newPoints * 100) / 100,
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      cardsToday: totalQuestions,
      botsUpdated: updates.length,
      updates 
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
