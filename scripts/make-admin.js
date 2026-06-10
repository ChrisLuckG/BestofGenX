const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function makeAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const result = await mongoose.connection.db.collection('users').updateOne(
    { email: 'contact@bestofgenx.com' },
    { $set: { isAdmin: true } }
  );
  
  console.log('Updated:', result.modifiedCount);
  await mongoose.disconnect();
}

makeAdmin();
