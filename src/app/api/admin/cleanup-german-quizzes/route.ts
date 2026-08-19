import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Card from '@/models/Card';

// Ambiguous question patterns - questions that don't make sense without context
// These are STRICT patterns for questions that are definitely broken
const AMBIGUOUS_PATTERNS = [
  // "Who won the gold/championship" without specifying year AND event
  /\bwho\s+won\s+(the\s+)?(gold|championship|title|cup|trophy)\b(?!.*\b(19|20)\d{2}\b)/i,
  // "Who scored the goal/winning" without context
  /\bwho\s+scored\s+(the|a)\s+(goal|winning|final)\b(?!.*\b(19|20)\d{2}\b)/i,
  // Pronouns at start without any named subject in question
  /^(what|where|when)\s+(did|was|were)\s+(he|she|they)\s/i,
  // "their hit/album" without naming artist anywhere
  /\btheir\s+(biggest|greatest|first|debut)\s+(hit|album|single)\b(?!.*(by|from|of)\s)/i,
  // Very short vague questions (under 30 chars often lack context)
  // Actually skip this - some short questions are fine
];

function isAmbiguous(text: string): boolean {
  if (!text) return false;
  for (const pattern of AMBIGUOUS_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

// German words commonly found in quiz questions
const GERMAN_PATTERNS = [
  // Question words
  /\bwelche[rs]?\b/i,
  /\bwas\b/i,
  /\bwer\b/i,
  /\bwie\b/i,
  /\bwo\b/i,
  /\bwann\b/i,
  /\bwarum\b/i,
  // Common words
  /\bist\b/i,
  /\bsind\b/i,
  /\bwar\b/i,
  /\bwaren\b/i,
  /\bwurde\b/i,
  /\bhat\b/i,
  /\bhatte\b/i,
  /\bder\b/i,
  /\bdie\b/i,
  /\bdas\b/i,
  /\bein\b/i,
  /\beine[rsnm]?\b/i,
  /\bund\b/i,
  /\boder\b/i,
  /\bmit\b/i,
  /\bvon\b/i,
  /\bfür\b/i,
  /\baus\b/i,
  /\bbei\b/i,
  /\bnach\b/i,
  /\büber\b/i,
  /\bunter\b/i,
  // Quiz-specific
  /\bfrage\b/i,
  /\bantwort\b/i,
  /\brichtig\b/i,
  /\bfalsch\b/i,
  /\bjahre?\b/i,
  /\bfilm\b/i, // German "Film" vs English "movie"
  /\bspiel\b/i,
  /\blied\b/i,
  /\bsänger\b/i,
  /\bband\b/i,
  /\bgewann\b/i,
  /\bgewonnen\b/i,
  /\bbekannt\b/i,
  /\bberühmt\b/i,
  // Umlauts (strong indicator)
  /[äöüß]/i,
];

function isGerman(text: string): boolean {
  if (!text) return false;
  // Check if text matches multiple German patterns (to avoid false positives)
  let matches = 0;
  for (const pattern of GERMAN_PATTERNS) {
    if (pattern.test(text)) {
      matches++;
      if (matches >= 2) return true; // At least 2 German words = German
    }
  }
  // Single umlaut is strong enough indicator
  if (/[äöüß]/i.test(text)) return true;
  return false;
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { dryRun = true, mode = 'all' } = await request.json();
    // mode: 'german' = only German, 'ambiguous' = only ambiguous, 'all' = both
    
    // Find all quiz cards
    const allCards = await Card.find({ type: 'quiz' }).lean();
    
    const germanCards: any[] = [];
    const ambiguousCards: any[] = [];
    
    for (const card of allCards) {
      const questions = card.questions || [];
      let hasGerman = false;
      let hasAmbiguous = false;
      
      for (const q of questions) {
        // Check for German
        if (mode !== 'ambiguous') {
          if (isGerman(q.question)) {
            hasGerman = true;
          }
          for (const opt of (q.options || [])) {
            if (isGerman(String(opt))) {
              hasGerman = true;
              break;
            }
          }
        }
        
        // Check for ambiguous questions
        if (mode !== 'german' && !hasGerman) {
          if (isAmbiguous(q.question)) {
            hasAmbiguous = true;
          }
        }
      }
      
      if (hasGerman) {
        germanCards.push({
          _id: card._id,
          topic: card.topic,
          question: questions[0]?.question?.slice(0, 100),
          reason: 'german',
        });
      } else if (hasAmbiguous) {
        ambiguousCards.push({
          _id: card._id,
          topic: card.topic,
          question: questions[0]?.question?.slice(0, 100),
          reason: 'ambiguous',
        });
      }
    }
    
    const toDelete = [...germanCards, ...ambiguousCards];
    
    let deleted = 0;
    if (!dryRun && toDelete.length > 0) {
      const ids = toDelete.map(c => c._id);
      const result = await Card.deleteMany({ _id: { $in: ids } });
      deleted = result.deletedCount;
    }
    
    return NextResponse.json({
      success: true,
      dryRun,
      mode,
      totalCards: allCards.length,
      germanCardsFound: germanCards.length,
      ambiguousCardsFound: ambiguousCards.length,
      totalToDelete: toDelete.length,
      deleted,
      germanSamples: germanCards.slice(0, 5),
      ambiguousSamples: ambiguousCards.slice(0, 10),
    });
    
  } catch (error: any) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
