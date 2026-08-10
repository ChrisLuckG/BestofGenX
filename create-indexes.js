const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  
  console.log('Creating indexes for articles collection...');
  
  // Index for sorting - this allows MongoDB to sort without loading all docs into memory
  await db.collection('articles').createIndex({ createdAt: -1 });
  await db.collection('articles').createIndex({ status: 1, createdAt: -1 });
  await db.collection('articles').createIndex({ order: 1, createdAt: -1 });
  
  console.log('✓ Indexes created!');
  
  // Show current indexes
  const indexes = await db.collection('articles').indexes();
  console.log('\nCurrent indexes:');
  indexes.forEach(idx => console.log('-', idx.name, ':', JSON.stringify(idx.key)));
  
  process.exit(0);
});
