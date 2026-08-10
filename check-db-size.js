const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  
  // Get collection stats
  const stats = await db.command({ collStats: 'articles' });
  console.log('Articles Collection:');
  console.log('- Documents:', stats.count);
  console.log('- Storage:', (stats.storageSize / 1024 / 1024).toFixed(2), 'MB');
  console.log('- Avg doc size:', (stats.avgObjSize / 1024).toFixed(2), 'KB');
  
  // Check for base64 images
  const Article = mongoose.model('Article', new mongoose.Schema({}, { strict: false }));
  
  const withBase64Cover = await Article.countDocuments({ 
    coverImageBase64: { $exists: true, $ne: null, $ne: '' } 
  });
  
  const withBase64InContent = await Article.countDocuments({
    content: { $regex: 'data:image' }
  });
  
  console.log('\nBase64 images in DB:');
  console.log('- Articles with coverImageBase64:', withBase64Cover);
  console.log('- Articles with base64 in content:', withBase64InContent);
  
  // Sample a large article
  const largest = await Article.find({}, { title: 1, content: 1, coverImage: 1, coverImageBase64: 1 })
    .sort({ 'content.length': -1 })
    .limit(1)
    .lean();
  
  if (largest[0]) {
    const contentSize = largest[0].content?.length || 0;
    const coverSize = (largest[0].coverImage?.length || 0) + (largest[0].coverImageBase64?.length || 0);
    console.log('\nLargest article:', largest[0].title?.substring(0, 50));
    console.log('- Content size:', (contentSize / 1024).toFixed(2), 'KB');
    console.log('- Cover size:', (coverSize / 1024).toFixed(2), 'KB');
  }
  
  process.exit(0);
});
