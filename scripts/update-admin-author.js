const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function updateAdminAuthors() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // First check what author names exist
    const authors = await mongoose.connection.db.collection('articles').distinct('authorName');
    console.log('Existing authors:', authors);
    
    // Update Admin (case insensitive)
    const result = await mongoose.connection.db.collection('articles').updateMany(
      { authorName: { $regex: /^admin$/i } },
      { $set: { authorName: 'Bacon77' } }
    );
    
    console.log('Updated:', result.modifiedCount, 'articles from Admin to Bacon77');
    
    await mongoose.disconnect();
    console.log('Done');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateAdminAuthors();
