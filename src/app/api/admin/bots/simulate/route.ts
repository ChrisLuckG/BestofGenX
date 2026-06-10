import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import Card from '@/models/Card';

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

    // Get today's active cards (same logic as mobile page)
    const today = new Date().toISOString().split('T')[0];
    const todaysCards = await Card.find({
      active: true,
      guestCard: false, // Bots play logged-in cards
      $or: [{ gameDate: today }, { gameDate: { $exists: false } }, { gameDate: '' }]
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
      // Each bot plays all cards once, with varying skill levels
      const botSkill = 0.4 + Math.random() * 0.5; // 40-90% accuracy
      let totalPoints = 0;
      let wins = 0;
      
      for (let i = 0; i < totalQuestions; i++) {
        // Bot picks random difficulty: 1=Easy(50pts), 2=Medium(100pts), 3=Hard(150pts)
        const difficulty = Math.random() < 0.5 ? 1 : Math.random() < 0.7 ? 2 : 3;
        const maxReward = difficulty === 1 ? 50 : difficulty === 2 ? 100 : 150;
        const penalty = difficulty === 1 ? 10 : difficulty === 2 ? 50 : 100;
        
        // Did bot answer correctly?
        const correct = Math.random() < botSkill;
        
        if (correct) {
          // Points based on "time" - faster = more points (50-100% of max)
          const timeBonus = 0.5 + Math.random() * 0.5;
          totalPoints += Math.floor(maxReward * timeBonus);
          wins++;
        } else {
          totalPoints -= penalty;
        }
      }
      
      // Ensure points don't go below 0
      const newPoints = Math.max(0, bot.points + totalPoints);
      
      await User.findByIdAndUpdate(bot._id, {
        points: newPoints,
        wins: bot.wins + wins,
        gamesPlayed: bot.gamesPlayed + totalQuestions,
      });
      
      updates.push({
        username: bot.username,
        questionsPlayed: totalQuestions,
        correct: wins,
        pointsChange: totalPoints,
        newPoints,
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
