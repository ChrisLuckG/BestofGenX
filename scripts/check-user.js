const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function checkUser() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const user = await mongoose.connection.db.collection('users').findOne(
    { email: 'contact@bestofgenx.com' }
  );
  
  if (user) {
    console.log('User found:');
    console.log('- Email:', user.email);
    console.log('- Username:', user.username);
    console.log('- isAdmin:', user.isAdmin);
    console.log('- emailVerified:', user.emailVerified);
    console.log('- Has password:', !!user.password);
  } else {
    console.log('User NOT found with email: contact@bestofgenx.com');
  }
  
  await mongoose.disconnect();
}

checkUser();
