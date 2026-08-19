import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Card from '@/models/Card';
import Question from '@/models/Question';
import crypto from 'crypto';

/**
 * Migration: Cards (mit verschachtelten questions[]) → Questions (flach)
 * 
 * Jede Card hat ~3 Fragen (Easy/Medium/Hard), diese werden zu 3 einzelnen
 * Question-Dokumenten.
 */

function difficultyNumToText(num: number): 'Easy' | 'Medium' | 'Hard' {
  if (num <= 1) return 'Easy';
  if (num <= 3) return 'Medium';
  return 'Hard';
}

function getMaxReward(difficulty: 'Easy' | 'Medium' | 'Hard'): number {
  switch (difficulty) {
    case 'Easy': return 0.05;
    case 'Medium': return 0.10;
    case 'Hard': return 0.15;
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { dryRun = true } = await request.json();
    
    // Hole alle Cards
    const cards = await Card.find({}).lean();
    
    const stats = {
      totalCards: cards.length,
      totalQuestionsInCards: 0,
      questionsCreated: 0,
      duplicatesSkipped: 0,
      errors: 0,
      samples: [] as any[],
    };
    
    // Zähle existierende Questions
    const existingQuestions = await Question.countDocuments({});
    
    for (const card of cards) {
      const questions = card.questions || [];
      stats.totalQuestionsInCards += questions.length;
      
      for (const q of questions) {
        // Validiere
        if (!q.question || !q.options || q.options.length !== 4 || !q.correctAnswer) {
          stats.errors++;
          continue;
        }
        
        // Konvertiere options zu strings
        const options = q.options.map((o: any) => String(o));
        const correctAnswer = String(q.correctAnswer);
        
        // Prüfe ob correctAnswer in options ist
        if (!options.includes(correctAnswer)) {
          stats.errors++;
          continue;
        }
        
        // Difficulty
        const difficulty = q.difficultyText as 'Easy' | 'Medium' | 'Hard' 
          || difficultyNumToText(q.difficulty || 3);
        
        // Hash für Duplikat-Check
        const questionHash = crypto.createHash('md5')
          .update(q.question.toLowerCase().trim())
          .digest('hex');
        
        // Theme validieren
        const validThemes = ['MUSIC', 'SPORTS', 'TV & MOVIES', 'GAMING', 'POLITIK'] as const;
        type ValidTheme = typeof validThemes[number];
        let theme: ValidTheme = 'TV & MOVIES';
        if (card.theme === 'MOVIES') theme = 'TV & MOVIES';
        else if (validThemes.includes(card.theme as ValidTheme)) theme = card.theme as ValidTheme;
        
        const questionDoc = {
          question: q.question,
          options,
          correctAnswer,
          theme,
          subCategory: card.subCategory || '',
          topic: card.topic || '',
          difficulty,
          maxReward: getMaxReward(difficulty),
          timesPlayed: Math.floor((card.timesPlayed || 0) / (questions.length || 1)),
          timesCorrect: Math.floor((card.timesCorrect || 0) / (questions.length || 1)),
          active: card.active !== false,
          questionHash,
          image: card.previewImage || card.playerImage || '',
          source: card.source || 'generated',
        };
        
        // Sample für Preview
        if (stats.samples.length < 5) {
          stats.samples.push({
            question: questionDoc.question.slice(0, 60) + '...',
            theme: questionDoc.theme,
            difficulty: questionDoc.difficulty,
          });
        }
        
        if (!dryRun) {
          // Prüfe auf Duplikat
          const existing = await Question.findOne({ questionHash });
          if (existing) {
            stats.duplicatesSkipped++;
            continue;
          }
          
          await Question.create(questionDoc);
          stats.questionsCreated++;
        } else {
          stats.questionsCreated++;
        }
      }
    }
    
    // Neue Zählung
    const newQuestionCount = dryRun 
      ? existingQuestions + stats.questionsCreated 
      : await Question.countDocuments({});
    
    return NextResponse.json({
      success: true,
      dryRun,
      existingQuestionsBefore: existingQuestions,
      ...stats,
      newQuestionCount,
      message: dryRun 
        ? `Would create ${stats.questionsCreated} questions from ${stats.totalCards} cards`
        : `Created ${stats.questionsCreated} questions from ${stats.totalCards} cards`,
    });
    
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET: Status der Migration
export async function GET() {
  try {
    await dbConnect();
    
    const cardCount = await Card.countDocuments({});
    const questionCount = await Question.countDocuments({});
    
    // Zähle Fragen in Cards
    const cards = await Card.find({}).select('questions').lean();
    const questionsInCards = cards.reduce((sum, c) => sum + (c.questions?.length || 0), 0);
    
    // Zähle nach Theme
    const questionsByTheme = await Question.aggregate([
      { $group: { _id: '$theme', count: { $sum: 1 } } }
    ]);
    
    const cardsByTheme = await Card.aggregate([
      { $group: { _id: '$theme', count: { $sum: 1 } } }
    ]);
    
    return NextResponse.json({
      success: true,
      cards: {
        count: cardCount,
        questionsInside: questionsInCards,
        byTheme: Object.fromEntries(cardsByTheme.map(t => [t._id, t.count])),
      },
      questions: {
        count: questionCount,
        byTheme: Object.fromEntries(questionsByTheme.map(t => [t._id, t.count])),
      },
      migrationNeeded: questionCount < questionsInCards,
    });
    
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
