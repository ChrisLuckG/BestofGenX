const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Article = mongoose.model('Article', new mongoose.Schema({}, { strict: false }));
  
  const art = await Article.findOne({ title: /August 7.*Skyward/i }).lean();
  
  if (!art) {
    console.log('Article not found');
    process.exit(1);
  }
  
  console.log('Inspecting:', art.title);
  console.log('\nField sizes:');
  
  for (const [key, value] of Object.entries(art)) {
    const size = JSON.stringify(value)?.length || 0;
    const sizeKB = (size / 1024).toFixed(2);
    if (size > 1000) {
      console.log(`  ${key}: ${sizeKB} KB`);
      if (typeof value === 'string' && size > 10000) {
        console.log(`    Preview: ${value.substring(0, 100)}...`);
      }
    }
  }
  
  process.exit(0);
});
