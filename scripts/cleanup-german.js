// Script to delete all German questions from the database
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

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
  /ß/,
  /ä|ö|ü/i,
];

function isGerman(text) {
  if (!text) return false;
  let matches = 0;
  for (const pattern of GERMAN_PATTERNS) {
    if (pattern.test(text)) {
      matches++;
      if (matches >= 2) return true;
    }
  }
  if (/ß/.test(text)) return true;
  return false;
}

function checkCardForGerman(card) {
  const reasons = [];
  
  if (isGerman(card.topic)) {
    reasons.push(`Topic: "${card.topic}"`);
  }
  
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
  
  if (card.question && isGerman(card.question)) {
    reasons.push(`Question (old format): "${card.question}"`);
  }
  
  return { isGerman: reasons.length > 0, reasons };
}

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!');
  
  const Card = mongoose.connection.collection('cards');
  
  const allCards = await Card.find({}).toArray();
  console.log(`Found ${allCards.length} total cards`);
  
  const germanCards = [];
  for (const card of allCards) {
    const check = checkCardForGerman(card);
    if (check.isGerman) {
      germanCards.push({ id: card._id, topic: card.topic, reasons: check.reasons });
    }
  }
  
  console.log(`Found ${germanCards.length} German cards`);
  
  if (germanCards.length === 0) {
    console.log('No German cards to delete!');
    await mongoose.disconnect();
    return;
  }
  
  console.log('German cards:');
  germanCards.forEach(c => console.log(`  - ${c.topic}: ${c.reasons[0]}`));
  
  console.log('\nDeleting...');
  const idsToDelete = germanCards.map(c => c.id);
  const result = await Card.deleteMany({ _id: { $in: idsToDelete } });
  
  console.log(`Deleted ${result.deletedCount} German cards!`);
  
  await mongoose.disconnect();
  console.log('Done!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
