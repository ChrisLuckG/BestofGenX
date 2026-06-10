import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Card from '@/models/Card';
import User from '@/models/User';

// German word patterns to detect
const GERMAN_PATTERNS = [
  /\bWer\b/i, /\bWas\b/i, /\bWie\b/i, /\bWo\b/i, /\bWann\b/i, /\bWarum\b/i,
  /\bWelche[rsmn]?\b/i, /\bist\b/i, /\bsind\b/i, /\bwar\b/i, /\bwaren\b/i,
  /\bhat\b/i, /\bhaben\b/i, /\bwird\b/i, /\bwurde\b/i, /\bkann\b/i,
  /\bder\b/i, /\bdie\b/i, /\bdas\b/i, /\bein\b/i, /\beine[rsmn]?\b/i,
  /\bund\b/i, /\boder\b/i, /\baber\b/i, /\bauch\b/i, /\bnicht\b/i,
  /\bmit\b/i, /\bvon\b/i, /\bfür\b/i, /\baus\b/i, /\bbei\b/i,
  /\bnach\b/i, /\büber\b/i, /\bunter\b/i, /\bzwischen\b/i,
  /\bJahr\b/i, /\bJahre\b/i, /\bFilm\b/i, /\bSong\b/i, /\bAlbum\b/i,
  /\bSänger\b/i, /\bSängerin\b/i, /\bSchauspieler\b/i,
  /\bspielt[e]?\b/i, /\bsang\b/i, /\bgesungen\b/i,
  /\bberühmt\b/i, /\bbekannt\b/i, /\berfolgreich\b/i,
  /ß/, // German ß character
  /ä|ö|ü/i, // German umlauts (but be careful - some English words have these)
];

function isGerman(text: string): boolean {
  if (!text) return false;
  // Check if text matches multiple German patterns
  let matches = 0;
  for (const pattern of GERMAN_PATTERNS) {
    if (pattern.test(text)) {
      matches++;
      if (matches >= 2) return true; // At least 2 German patterns = likely German
    }
  }
  // Special case: ß is always German
  if (/ß/.test(text)) return true;
  return false;
}

function checkCardForGerman(card: any): { isGerman: boolean; reasons: string[] } {
  const reasons: string[] = [];
  
  // Check topic
  if (isGerman(card.topic)) {
    reasons.push(`Topic: "${card.topic}"`);
  }
  
  // Check questions array
  if (card.questions && Array.isArray(card.questions)) {
    for (const q of card.questions) {
      if (isGerman(q.question)) {
        reasons.push(`Question: "${q.question}"`);
      }
      if (q.options && Array.isArray(q.options)) {
        for (const opt of q.options) {
          if (isGerman(opt)) {
            reasons.push(`Option: "${opt}"`);
          }
        }
      }
    }
  }
  
  // Check old format question
  if (card.question && isGerman(card.question)) {
    reasons.push(`Question (old format): "${card.question}"`);
  }
  
  return { isGerman: reasons.length > 0, reasons };
}

// DELETE - Remove all German questions
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const dryRun = searchParams.get('dryRun') === 'true';
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }
    
    // Verify admin
    const user = await User.findById(userId).select('isAdmin').lean();
    if (!user?.isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }
    
    // Find all cards
    const allCards = await Card.find({}).lean();
    
    const germanCards: { id: string; topic: string; reasons: string[] }[] = [];
    
    for (const card of allCards) {
      const check = checkCardForGerman(card);
      if (check.isGerman) {
        germanCards.push({
          id: (card as any)._id.toString(),
          topic: card.topic || 'Unknown',
          reasons: check.reasons
        });
      }
    }
    
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        found: germanCards.length,
        cards: germanCards
      });
    }
    
    // Actually delete
    const idsToDelete = germanCards.map(c => c.id);
    const result = await Card.deleteMany({ _id: { $in: idsToDelete } });
    
    return NextResponse.json({
      success: true,
      deleted: result.deletedCount,
      cards: germanCards
    });
    
  } catch (error: unknown) {
    console.error('Cleanup error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// GET - Check for German questions (dry run)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }
    
    // Verify admin
    const user = await User.findById(userId).select('isAdmin').lean();
    if (!user?.isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }
    
    // Find all cards
    const allCards = await Card.find({}).lean();
    
    const germanCards: { id: string; topic: string; reasons: string[] }[] = [];
    
    for (const card of allCards) {
      const check = checkCardForGerman(card);
      if (check.isGerman) {
        germanCards.push({
          id: (card as any)._id.toString(),
          topic: card.topic || 'Unknown',
          reasons: check.reasons
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      found: germanCards.length,
      total: allCards.length,
      cards: germanCards
    });
    
  } catch (error: unknown) {
    console.error('Cleanup check error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
