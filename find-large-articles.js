const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Article = mongoose.model('Article', new mongoose.Schema({}, { strict: false }));
  
  const articles = await Article.find().lean();
  
  // Calculate sizes and sort
  const withSizes = articles.map(art => ({
    title: art.title?.substring(0, 50),
    size: JSON.stringify(art).length,
    contentSize: art.content?.length || 0,
    coverSize: (art.coverImage?.length || 0) + (art.thumbnailUrl?.length || 0),
  })).sort((a, b) => b.size - a.size);
  
  console.log('Top 20 largest articles:\n');
  withSizes.slice(0, 20).forEach((art, i) => {
    console.log(`${i+1}. ${art.title}`);
    console.log(`   Total: ${(art.size / 1024).toFixed(1)} KB | Content: ${(art.contentSize / 1024).toFixed(1)} KB`);
  });
  
  // Summary
  const totalSize = withSizes.reduce((sum, a) => sum + a.size, 0);
  const top10Size = withSizes.slice(0, 10).reduce((sum, a) => sum + a.size, 0);
  console.log('\n--- Summary ---');
  console.log('Total articles:', articles.length);
  console.log('Total size:', (totalSize / 1024 / 1024).toFixed(2), 'MB');
  console.log('Top 10 articles:', (top10Size / 1024 / 1024).toFixed(2), 'MB', `(${(top10Size/totalSize*100).toFixed(1)}%)`);
  
  process.exit(0);
});
