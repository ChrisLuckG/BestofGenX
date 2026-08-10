const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Article = mongoose.model('Article', new mongoose.Schema({}, { strict: false }));
  
  // Get a sample of articles and measure field sizes
  const articles = await Article.find().limit(10).lean();
  
  console.log('Field sizes for sample articles:\n');
  
  for (const art of articles) {
    console.log('📄', art.title?.substring(0, 40));
    const sizes = {};
    for (const [key, value] of Object.entries(art)) {
      const size = JSON.stringify(value)?.length || 0;
      if (size > 100) {
        sizes[key] = (size / 1024).toFixed(2) + ' KB';
      }
    }
    console.log('   Large fields:', sizes);
    console.log('   Total:', (JSON.stringify(art).length / 1024).toFixed(2), 'KB\n');
  }
  
  process.exit(0);
});
