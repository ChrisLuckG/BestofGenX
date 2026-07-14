import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Card from '@/models/Card';

// Patterns that indicate ambiguous questions (missing year/event)
const AMBIGUOUS_PATTERNS = [
  // Sports championships without year
  /who won the (nba|nfl|mlb|nhl|world cup|super bowl|championship|title|gold medal|olympics?)/i,
  /which (country|team|player) won (the )?(gold|silver|bronze|medal|championship|title)/i,
  /winner of the (nba|nfl|mlb|nhl|world cup|super bowl)/i,
  
  // Awards without year
  /who won (the )?(oscar|grammy|emmy|tony|golden globe|academy award)/i,
  /best (actor|actress|picture|album|song) winner/i,
  
  // Generic "who won" without specifics
  /^who won (?!.*\d{4})(?!.*in \d).*\?$/i,
  
  // "Which country/team won" without year
  /which (country|team) won (?!.*\d{4})(?!.*in \d)/i,
  
  // "For which team/band did X play" - players often played for multiple teams!
  /for which (team|band|club) (did|does|was)/i,
  /which (team|band|club) did .* play for/i,
  /what team did .* play for/i,
  
  // "Where did X play" without timeframe
  /where did .* play(?! in \d)/i,
  
  // "Who played for" without year
  /who played for (?!.*\d{4})(?!.*in \d)/i,
  
  // "Which album" without specifics (artists have many albums)
  /which album (?!.*first|.*debut|.*\d{4})/i,
  
  // "How many" questions that change over time
  /how many (championships|titles|medals|awards|grammys|oscars) (did|does|has)/i,
  
  // "Who scored" without specific game/year
  /who scored (?!.*\d{4})(?!.*in the \d)(?!.*final)(?!.*against)/i,
  
  // "Who was the coach/manager" without year
  /who was the (coach|manager|captain) of (?!.*\d{4})(?!.*in \d)/i,
  
  // "What number did X wear" - players often change numbers
  /what (number|jersey) did .* wear(?! in \d| at | with the)/i,
  
  // "Who is/was married to" - people divorce and remarry
  /who (is|was) .* married to/i,
  
  // "What record label" - artists change labels
  /what (record label|label) (did|does|was)/i,
];

// Check if a question is potentially ambiguous
function isAmbiguous(question: string): { ambiguous: boolean; reason: string } {
  const q = question.toLowerCase();
  
  // Check for year in question (1900-2099)
  const hasYear = /\b(19|20)\d{2}\b/.test(question);
  
  // Check for specific event mentions
  const hasSpecificEvent = /\b(barcelona|atlanta|sydney|athens|beijing|london|rio|tokyo|paris)\b/i.test(question) ||
                          /\b(world cup \d{4}|olympics \d{4}|super bowl [IVXLCDM]+|\d{4} (finals|championship))\b/i.test(question);
  
  // If has year or specific event, likely not ambiguous
  if (hasYear || hasSpecificEvent) {
    return { ambiguous: false, reason: '' };
  }
  
  // Check against ambiguous patterns
  for (const pattern of AMBIGUOUS_PATTERNS) {
    if (pattern.test(question)) {
      return { 
        ambiguous: true, 
        reason: `Matches pattern: ${pattern.toString().slice(0, 50)}...` 
      };
    }
  }
  
  return { ambiguous: false, reason: '' };
}

// GET - Audit all questions for ambiguity
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const fix = searchParams.get('fix') === 'true'; // If true, deactivate ambiguous cards
    
    // Get all active cards
    const cards = await Card.find({ active: true }).lean();
    
    const ambiguousQuestions: Array<{
      cardId: string;
      theme: string;
      question: string;
      reason: string;
      options: string[];
      correctAnswer: string;
    }> = [];
    
    for (const card of cards) {
      if (!card.questions || !Array.isArray(card.questions)) continue;
      
      for (const q of card.questions as any[]) {
        const check = isAmbiguous(q.question || '');
        if (check.ambiguous) {
          ambiguousQuestions.push({
            cardId: (card._id as any).toString(),
            theme: card.theme || 'Unknown',
            question: q.question,
            reason: check.reason,
            options: q.options || [],
            correctAnswer: q.correctAnswer || '',
          });
        }
      }
    }
    
    // Optionally deactivate ambiguous cards
    let deactivated = 0;
    if (fix && ambiguousQuestions.length > 0) {
      const cardIds = Array.from(new Set(ambiguousQuestions.map(q => q.cardId)));
      const result = await Card.updateMany(
        { _id: { $in: cardIds } },
        { $set: { active: false } }
      );
      deactivated = result.modifiedCount;
    }
    
    return NextResponse.json({
      success: true,
      totalCards: cards.length,
      ambiguousCount: ambiguousQuestions.length,
      deactivated: fix ? deactivated : 0,
      ambiguousQuestions,
      hint: ambiguousQuestions.length > 0 
        ? 'Add ?fix=true to deactivate these cards' 
        : 'All questions look good!'
    });
    
  } catch (error: any) {
    console.error('Audit questions error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
