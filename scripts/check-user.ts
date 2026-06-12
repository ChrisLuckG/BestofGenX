import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkPolls() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  // Check polls
  const polls = await mongoose.connection.collection('polls').find({}).toArray();
  console.log('=== ALL POLLS ===');
  console.log('Total:', polls.length);
  polls.forEach((p: any) => {
    console.log(`- ${p.title?.substring(0, 40)}... | votes: ${p.totalVotes} | status: ${p.status} | type: ${p.type}`);
    if (p.items) {
      console.log(`  Items: ${p.items.length}, Total item votes: ${p.items.reduce((s: number, i: any) => s + (i.upvotes || 0) + (i.downvotes || 0), 0)}`);
    }
  });
  
  // Check poll rewards
  const rewards = await mongoose.connection.collection('pollrewards').countDocuments();
  console.log('\nPoll Rewards:', rewards);
  
  // Check user votes
  const votes = await mongoose.connection.collection('uservotes').countDocuments();
  console.log('User Votes:', votes);
  
  await mongoose.disconnect();
}
checkPolls();
