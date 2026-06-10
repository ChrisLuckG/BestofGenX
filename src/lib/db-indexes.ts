import { getDatabase } from './mongodb';

// Helper to safely create index (ignores if already exists)
async function safeCreateIndex(collection: any, keys: any, options: any = {}) {
  try {
    await collection.createIndex(keys, { ...options, background: true });
    return true;
  } catch (error: any) {
    // Ignore if index already exists with different options
    if (error.code === 86 || error.code === 85) {
      console.log(`⚠️ Index already exists, skipping:`, keys);
      return true;
    }
    throw error;
  }
}

// Create indexes for better query performance
export async function ensureIndexes() {
  try {
    const db = await getDatabase();
    
    console.log('📊 Creating database indexes...');

    // Users collection
    const users = db.collection('users');
    await safeCreateIndex(users, { odooId: 1 });
    await safeCreateIndex(users, { email: 1 });
    await safeCreateIndex(users, { points: -1 }); // For rankings
    await safeCreateIndex(users, { createdAt: -1 });
    console.log('✅ Users indexes created');

    // Articles collection
    const articles = db.collection('articles');
    await safeCreateIndex(articles, { status: 1, publishedAt: -1 });
    await safeCreateIndex(articles, { mainCategory: 1 });
    await safeCreateIndex(articles, { createdAt: -1 });
    await safeCreateIndex(articles, { featured: 1 });
    console.log('✅ Articles indexes created');

    // Battles collection
    const battles = db.collection('battles');
    await safeCreateIndex(battles, { status: 1, createdAt: -1 });
    await safeCreateIndex(battles, { 'creator.odooId': 1 });
    await safeCreateIndex(battles, { 'opponent.odooId': 1 });
    await safeCreateIndex(battles, { challengedUser: 1 });
    await safeCreateIndex(battles, { topic: 1 });
    console.log('✅ Battles indexes created');

    // Notifications collection
    const notifications = db.collection('notifications');
    await safeCreateIndex(notifications, { odooId: 1, createdAt: -1 });
    await safeCreateIndex(notifications, { odooId: 1, read: 1 });
    await safeCreateIndex(notifications, { odooId: 1, dismissed: 1 });
    console.log('✅ Notifications indexes created');

    // Cards/Feed collection
    const cards = db.collection('cards');
    await safeCreateIndex(cards, { date: 1 });
    await safeCreateIndex(cards, { createdAt: -1 });
    console.log('✅ Cards indexes created');

    // Rankings snapshots
    const rankings = db.collection('rankings_snapshots');
    await safeCreateIndex(rankings, { period: 1, date: -1 });
    await safeCreateIndex(rankings, { 'rankings.odooId': 1 });
    console.log('✅ Rankings indexes created');

    // Polls collection
    const polls = db.collection('polls');
    await safeCreateIndex(polls, { status: 1, createdAt: -1 });
    await safeCreateIndex(polls, { endDate: 1 });
    console.log('✅ Polls indexes created');

    // User reads (for article tracking)
    const userReads = db.collection('user_reads');
    await safeCreateIndex(userReads, { odooId: 1, articleId: 1 });
    await safeCreateIndex(userReads, { odooId: 1 });
    console.log('✅ User reads indexes created');

    // Point transactions
    const pointTransactions = db.collection('point_transactions');
    await safeCreateIndex(pointTransactions, { odooId: 1, createdAt: -1 });
    await safeCreateIndex(pointTransactions, { type: 1 });
    console.log('✅ Point transactions indexes created');

    console.log('🎉 All indexes created successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    return false;
  }
}
