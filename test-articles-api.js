const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Article = mongoose.model('Article', new mongoose.Schema({}, { strict: false }));
  
  console.log('Testing Article query...');
  
  try {
    const articles = await Article.aggregate([
      { $match: {} },
      { $addFields: { sortPriority: { $cond: [{ $eq: ['$status', 'archived'] }, 1, 0] } } },
      { $sort: { sortPriority: 1, order: 1, createdAt: -1 } },
      { $skip: 0 },
      { $limit: 5 },
      { $project: { content: 0, coverImage: 0 } }
    ]);
    
    console.log('Found', articles.length, 'articles');
    articles.forEach(a => console.log('-', a.title?.substring(0, 40), '| status:', a.status));
  } catch (err) {
    console.error('ERROR:', err);
  }
  
  process.exit(0);
});
