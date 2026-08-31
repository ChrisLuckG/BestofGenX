/**
 * Backfill Author Earnings
 * 
 * Goes through all users' readArticles and credits authors with earnings
 * for articles that were read before the earnings system was properly set up.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI!;

// Schemas
const UserSchema = new mongoose.Schema({
  username: String,
  displayName: String,
  readArticles: [String],
  authorEarnings: { type: Number, default: 0 },
});

const ArticleSchema = new mongoose.Schema({
  title: String,
  author: mongoose.Schema.Types.ObjectId,
  authorName: String,
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Article = mongoose.models.Article || mongoose.model('Article', ArticleSchema);

async function backfillAuthorEarnings() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // Get all users with readArticles
  const users = await User.find({ 
    readArticles: { $exists: true, $ne: [] } 
  }).select('username readArticles').lean();

  console.log(`Found ${users.length} users with read articles`);

  // Track earnings per author
  const authorEarnings: Record<string, number> = {};
  const authorNames: Record<string, string> = {};

  for (const user of users) {
    const readArticles = user.readArticles || [];
    console.log(`\nUser ${user.username}: ${readArticles.length} articles read`);

    for (const articleId of readArticles) {
      try {
        const article = await Article.findById(articleId).select('title author authorName').lean();
        if (!article) continue;

        let authorId = article.author?.toString();

        // If no author ID, try to find by authorName
        if (!authorId && article.authorName) {
          const authorUser = await User.findOne({
            $or: [
              { username: article.authorName },
              { displayName: article.authorName }
            ]
          }).select('_id username').lean();
          
          if (authorUser) {
            authorId = authorUser._id.toString();
            // Update article with correct author ID
            await Article.findByIdAndUpdate(articleId, { author: authorUser._id });
            console.log(`  Fixed article "${article.title}" - set author to ${authorUser.username}`);
          }
        }

        if (authorId && authorId !== user._id.toString()) {
          // Don't credit author for reading their own article
          authorEarnings[authorId] = (authorEarnings[authorId] || 0) + 0.02;
          authorNames[authorId] = article.authorName || 'Unknown';
        }
      } catch (e) {
        // Skip invalid article IDs
      }
    }
  }

  // Apply earnings
  console.log('\n--- Applying Author Earnings ---');
  for (const [authorId, earnings] of Object.entries(authorEarnings)) {
    const result = await User.findByIdAndUpdate(
      authorId,
      { $inc: { authorEarnings: earnings } },
      { new: true }
    );
    console.log(`${authorNames[authorId]}: +${earnings.toFixed(2)} BOGX (total: ${result?.authorEarnings?.toFixed(2) || 0})`);
  }

  console.log('\n✅ Done!');
  await mongoose.disconnect();
}

backfillAuthorEarnings().catch(console.error);
