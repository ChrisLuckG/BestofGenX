const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

console.log('Connecting to MongoDB...');
console.log('URI:', process.env.MONGODB_URI?.substring(0, 40) + '...');

mongoose.connect(process.env.MONGODB_URI, { 
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 10000,
}).then(async () => {
  console.log('✓ Connected!');
  
  const Article = mongoose.model('Article', new mongoose.Schema({}, { strict: false }));
  
  // Check DB stats
  const db = mongoose.connection.db;
  const stats = await db.stats();
  console.log('\nDB Stats:');
  console.log('- Storage:', (stats.storageSize / 1024 / 1024).toFixed(2), 'MB');
  console.log('- Data:', (stats.dataSize / 1024 / 1024).toFixed(2), 'MB');
  console.log('- Collections:', stats.collections);
  console.log('- Objects:', stats.objects);
  
  // Count articles
  const count = await Article.countDocuments();
  console.log('\nArticles:', count);
  
  process.exit(0);
}).catch(err => {
  console.error('✗ Connection failed:', err.message);
  process.exit(1);
});
