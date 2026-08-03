import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function diagnose() {
  await mongoose.connect(process.env.MONGODB_URI || '');

  const shadowHunter = await mongoose.connection.collection('users').findOne({
    username: { $regex: /^shadowhunter$/i },
  });

  if (!shadowHunter) {
    console.log('ShadowHunter bot not found!');
    await mongoose.disconnect();
    return;
  }

  console.log('ShadowHunter _id:', shadowHunter._id.toString());
  console.log('ShadowHunter isBot:', shadowHunter.isBot);

  // Find all battles involving ShadowHunter as creator OR opponent, status active/open
  const battles = await mongoose.connection.collection('battles').find({
    $or: [
      { creator: shadowHunter._id },
      { opponent: shadowHunter._id },
    ],
    status: { $in: ['open', 'active'] },
  }).sort({ createdAt: -1 }).limit(20).toArray();

  console.log(`\nFound ${battles.length} open/active battles involving ShadowHunter:\n`);

  for (const b of battles) {
    console.log('---');
    console.log('battle _id:', b._id.toString());
    console.log('status:', b.status);
    console.log('topic:', b.topic, '| wager:', b.wager);
    console.log('creator:', b.creator?.toString(), b.creator?.toString() === shadowHunter._id.toString() ? '(ShadowHunter)' : '(OTHER)');
    console.log('opponent:', b.opponent?.toString(), b.opponent ? (b.opponent.toString() === shadowHunter._id.toString() ? '(ShadowHunter)' : '(OTHER)') : '(none)');
    console.log('challengedUser:', b.challengedUser?.toString() || '(none)');
    console.log('createdAt:', b.createdAt);
    console.log('acceptedAt:', b.acceptedAt || '(none)');
    console.log('creatorResults count:', b.creatorResults?.length || 0);
    console.log('opponentResults count:', b.opponentResults?.length || 0);
  }

  await mongoose.disconnect();
}

diagnose().catch(console.error);
