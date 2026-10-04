/**
 * Check what sportler exist in the database
 * 
 * Usage: npx tsx scripts/check-sportler.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Sport categories
const SPORT_CATEGORIES = [
  'football', 'tennis', 'basketball', 'ice-hockey', 'american-football',
  'baseball', 'golf', 'motorsport', 'rugby', 'cricket', 'handball',
  'boxing', 'volleyball', 'table-tennis', 'badminton', 'darts',
  'snooker', 'esports', 'others', 'history', 'rip'
];

// Legacy professions
const LEGACY_PROFESSIONS = ['Music', 'Actor', 'Sport', 'Politik', 'Art', 'Tech', 'Comedy', 'Model', 'Other'];

async function checkSportler() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('❌ MONGODB_URI not set in .env.local');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected');

  const db = mongoose.connection.db;
  if (!db) {
    console.error('❌ Database connection not established');
    process.exit(1);
  }
  
  const peopleCollection = db.collection('people');

  // Count total
  const total = await peopleCollection.countDocuments();
  console.log(`\n📊 Total people in database: ${total}`);

  // Count by profession
  console.log('\n📊 By profession:');
  
  // Sport categories
  console.log('\n  Sports:');
  for (const cat of SPORT_CATEGORIES) {
    const count = await peopleCollection.countDocuments({ profession: cat });
    if (count > 0) {
      console.log(`    ${cat}: ${count}`);
    }
  }

  // Legacy professions
  console.log('\n  Legacy:');
  for (const prof of LEGACY_PROFESSIONS) {
    const count = await peopleCollection.countDocuments({ profession: prof });
    if (count > 0) {
      console.log(`    ${prof}: ${count}`);
    }
  }

  // Other professions
  const allProfessions = await peopleCollection.distinct('profession');
  const otherProfessions = allProfessions.filter(
    p => !SPORT_CATEGORIES.includes(p) && !LEGACY_PROFESSIONS.includes(p)
  );
  if (otherProfessions.length > 0) {
    console.log('\n  Other professions found:');
    for (const prof of otherProfessions) {
      const count = await peopleCollection.countDocuments({ profession: prof });
      console.log(`    ${prof}: ${count}`);
    }
  }

  // Sample some sportler
  console.log('\n📋 Sample sportler (first 5 football):');
  const sample = await peopleCollection.find({ profession: 'football' }).limit(5).toArray();
  for (const p of sample) {
    console.log(`  - ${p.firstname} ${p.lastname} (${p.countryBorn || '?'}, born ${p.born || '?'})`);
  }

  await mongoose.disconnect();
  console.log('\n✅ Done!');
}

checkSportler().catch(console.error);
