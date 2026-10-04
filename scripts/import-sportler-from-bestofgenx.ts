/**
 * Import Sportler from bestofgenx database to sporttock
 * 
 * bestofgenx uses its own database 'bestofgenx' with sport-specific professions
 * (football, tennis, etc.) while sporttock uses generic 'Sport' profession.
 * 
 * This script copies sportler from bestofgenx to sporttock.
 * 
 * Usage: npx tsx scripts/import-sportler-from-bestofgenx.ts
 * 
 * Note: Both projects likely share the same MongoDB cluster but different databases.
 * The script assumes MONGODB_URI points to the cluster and accesses both databases.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Sport categories that exist in bestofgenx
const SPORT_CATEGORIES = [
  'football', 'tennis', 'basketball', 'ice-hockey', 'american-football',
  'baseball', 'golf', 'motorsport', 'rugby', 'cricket', 'handball',
  'boxing', 'volleyball', 'table-tennis', 'badminton', 'darts',
  'snooker', 'esports', 'others', 'history', 'rip'
];

interface PersonDoc {
  _id: any;
  firstname: string;
  lastname: string;
  born?: string;
  died?: string;
  causeOfDeath?: string;
  profession?: string;
  subcat?: string;
  knownfor?: string;
  countryBorn?: string;
  cityBorn?: string;
  countryDied?: string;
  cityDied?: string;
  nationality?: string;
  parents?: string;
  siblings?: number;
  image?: string;
  social?: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
    website?: string;
  };
}

async function importSportler() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('❌ MONGODB_URI not set in .env.local');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB...');
  
  // Connect to MongoDB cluster
  const client = await mongoose.connect(mongoUri);
  console.log('✅ Connected');

  // Get both databases
  const connection = mongoose.connection;
  
  // Extract base URI without database name
  const baseUri = mongoUri.replace(/\/[^\/\?]+(\?|$)/, '/$1');
  
  // Connect to bestofgenx database
  const bestofgenxConn = await mongoose.createConnection(mongoUri.replace(/\/[^\/\?]+(\?|$)/, '/bestofgenx$1')).asPromise();
  console.log('✅ Connected to bestofgenx database');
  
  const bestofgenxDb = bestofgenxConn.db;
  const sporttockDb = connection.db;
  
  if (!bestofgenxDb || !sporttockDb) {
    console.error('❌ Could not access databases');
    process.exit(1);
  }

  const sourceCollection = bestofgenxDb.collection('people');
  const targetCollection = sporttockDb.collection('people');

  // Count sportler in bestofgenx
  const sportlerCount = await sourceCollection.countDocuments({
    profession: { $in: SPORT_CATEGORIES }
  });
  console.log(`\n📊 Sportler in bestofgenx: ${sportlerCount}`);

  if (sportlerCount === 0) {
    console.log('ℹ️ No sportler found in bestofgenx');
    await bestofgenxConn.close();
    await mongoose.disconnect();
    return;
  }

  // Show breakdown by sport
  console.log('\n📊 By sport:');
  for (const cat of SPORT_CATEGORIES) {
    const count = await sourceCollection.countDocuments({ profession: cat });
    if (count > 0) {
      console.log(`   ${cat}: ${count}`);
    }
  }

  // Fetch all sportler from bestofgenx
  console.log('\n📥 Fetching sportler...');
  const sportler = await sourceCollection.find({
    profession: { $in: SPORT_CATEGORIES }
  }).toArray() as PersonDoc[];

  // Import sportler
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  console.log('\n📥 Importing...');
  
  for (const person of sportler) {
    try {
      // Check if person already exists (by firstname + lastname)
      const existing = await targetCollection.findOne({
        firstname: person.firstname,
        lastname: person.lastname,
      });

      if (existing) {
        // Update existing record with sport profession if:
        // - it was generic "Sport", OR
        // - it has a wrong profession (not a sport category) but bestofgenx has sport data
        const existingIsSport = SPORT_CATEGORIES.includes(existing.profession);
        const shouldUpdate = !existingIsSport && person.profession && SPORT_CATEGORIES.includes(person.profession);
        
        if (shouldUpdate) {
          await targetCollection.updateOne(
            { _id: existing._id },
            { 
              $set: { 
                profession: person.profession,
                subcat: person.subcat || existing.subcat,
                knownfor: person.knownfor || existing.knownfor,
                image: person.image || existing.image,
              } 
            }
          );
          updated++;
          if (updated <= 50) {
            console.log(`  🔄 Updated: ${person.firstname} ${person.lastname} (${existing.profession} → ${person.profession})`);
          }
        } else {
          skipped++;
        }
        continue;
      }

      // Calculate birth year for isGenX check
      let birthYear: number | undefined;
      if (person.born) {
        // Try DD.MM.YYYY format
        const match = person.born.match(/(\d{4})$/);
        if (match) {
          birthYear = parseInt(match[1]);
        }
        // Try YYYY-MM-DD format
        const isoMatch = person.born.match(/^(\d{4})/);
        if (isoMatch) {
          birthYear = parseInt(isoMatch[1]);
        }
      }

      // Create new person
      await targetCollection.insertOne({
        firstname: person.firstname,
        lastname: person.lastname,
        born: person.born,
        died: person.died,
        causeOfDeath: person.causeOfDeath,
        profession: person.profession,
        subcat: person.subcat,
        category: 'sports',
        knownfor: person.knownfor,
        countryBorn: person.countryBorn,
        cityBorn: person.cityBorn,
        countryDied: person.countryDied,
        cityDied: person.cityDied,
        nationality: person.nationality,
        parents: person.parents,
        siblings: person.siblings,
        image: person.image,
        social: person.social,
        isGenX: birthYear ? (birthYear >= 1965 && birthYear <= 1980) : true,
        birthYear,
        isVerified: false,
        hasArticle: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      imported++;
      if (imported % 500 === 0) {
        console.log(`  📥 Imported ${imported}/${sportler.length}...`);
      }
    } catch (err: any) {
      if (err.code === 11000) {
        // Duplicate key error - person already exists
        skipped++;
      } else {
        console.error(`  ❌ Error importing ${person.firstname} ${person.lastname}:`, err.message);
        errors++;
      }
    }
  }

  console.log('\n📊 Import Summary:');
  console.log(`   ✅ New imports: ${imported}`);
  console.log(`   🔄 Updated (Sport → specific): ${updated}`);
  console.log(`   ⏭️ Skipped (already exists): ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);

  // Close connections
  await bestofgenxConn.close();
  await mongoose.disconnect();
  console.log('\n✅ Done!');
}

importSportler().catch(console.error);
