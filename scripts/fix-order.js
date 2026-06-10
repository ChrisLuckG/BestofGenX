const mongoose = require('mongoose');

async function fixOrder() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sporttock');
  
  // Set "Mein erster Artikel" to order 0
  await mongoose.connection.db.collection('articles').updateOne(
    { _id: new mongoose.Types.ObjectId('6a0eed35bfac80ee76f41807') },
    { $set: { order: 0 } }
  );
  
  // Set "Mein zweiter Artikel" to order 1
  await mongoose.connection.db.collection('articles').updateOne(
    { _id: new mongoose.Types.ObjectId('6a0ef3e2bfac80ee76f41812') },
    { $set: { order: 1 } }
  );
  
  console.log('Order fixed!');
  
  // Verify
  const articles = await mongoose.connection.db.collection('articles').find({}).toArray();
  articles.forEach(a => console.log(`${a.title}: order ${a.order}`));
  
  process.exit(0);
}

fixOrder().catch(console.error);
