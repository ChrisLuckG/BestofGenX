/**
 * Script to clean up Menschen entries with bad format
 * Run with: npx ts-node scripts/cleanup-bad-menschen.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || '';

async function cleanup() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  if (!db) {
    console.error('No database connection');
    process.exit(1);
  }

  const collection = db.collection('people');

  // Find entries with bad format (firstname contains description words)
  const badWords = [
    'american', 'british', 'german', 'french', 'english', 'irish', 'scottish', 'welsh',
    'australian', 'canadian', 'japanese', 'korean', 'chinese', 'indian', 'brazilian',
    'mexican', 'spanish', 'italian', 'dutch', 'swedish', 'norwegian', 'danish', 'polish',
    'russian', 'ukrainian', 'austrian', 'swiss', 'belgian', 'portuguese', 'greek',
    'barbadian', 'latvian', 'icelandic', 'colombian', 'uruguayan', 'european',
    'singer', 'actor', 'actress', 'wrestler', 'driver', 'executive', 'politician',
    'died', 'born', 'insurance', 'race car', 'footballer', 'coach', 'journalist',
    'author', 'skier', 'mountaineer', 'princess', 'prince', 'soprano', 'sculptor',
    'producer', 'director', 'writer', 'musician', 'guitarist', 'drummer', 'bassist',
    'pianist', 'keyboard', 'dancer', 'model', 'designer', 'businessman', 'lawyer',
    'educator', 'golfer', 'baseball', 'basketball', 'hockey', 'tennis', 'boxer',
    'presenter', 'television', 'radio', 'impact', 'influence', 'legacy', 'enduring',
    'political'
  ];
  
  // Build regex pattern
  const pattern = badWords.join('|');
  
  // Find bad entries
  const badEntries = await collection.find({
    $or: [
      { firstname: { $regex: pattern, $options: 'i' } },
      { lastname: { $regex: pattern, $options: 'i' } },
      { firstname: { $regex: /\(.*\)/, $options: 'i' } }, // Contains parentheses
      { firstname: { $regex: /,/, $options: 'i' } }, // Contains comma
      // Entries that are not real names (like "The Political Impact")
      { firstname: { $regex: /^The\s/i } },
      // Entries with very long firstnames (likely full descriptions)
      { $expr: { $gt: [{ $strLenCP: '$firstname' }, 50] } },
    ]
  }).toArray();

  console.log(`Found ${badEntries.length} entries with bad format:`);
  badEntries.forEach(e => {
    console.log(`  - ${e.firstname} ${e.lastname}`);
  });

  if (badEntries.length === 0) {
    console.log('No bad entries found!');
    await mongoose.disconnect();
    return;
  }

  // Delete bad entries
  const result = await collection.deleteMany({
    _id: { $in: badEntries.map(e => e._id) }
  });

  console.log(`\nDeleted ${result.deletedCount} bad entries.`);

  // Also find and remove duplicates (keep first one)
  console.log('\nChecking for duplicates...');
  
  const pipeline = [
    {
      $group: {
        _id: { firstname: { $toLower: '$firstname' }, lastname: { $toLower: '$lastname' } },
        count: { $sum: 1 },
        ids: { $push: '$_id' }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ];

  const duplicates = await collection.aggregate(pipeline).toArray();
  
  let duplicatesDeleted = 0;
  for (const dup of duplicates) {
    // Keep first, delete rest
    const idsToDelete = dup.ids.slice(1);
    const delResult = await collection.deleteMany({ _id: { $in: idsToDelete } });
    duplicatesDeleted += delResult.deletedCount;
    console.log(`  - Removed ${delResult.deletedCount} duplicates of "${dup._id.firstname} ${dup._id.lastname}"`);
  }

  console.log(`\nTotal duplicates removed: ${duplicatesDeleted}`);

  await mongoose.disconnect();
  console.log('\nDone!');
}

cleanup().catch(console.error);
