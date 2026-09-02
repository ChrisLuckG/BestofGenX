import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  const collections = await mongoose.connection.db!.listCollections().toArray();
  console.log('Collections:');
  for (const c of collections) {
    const count = await mongoose.connection.collection(c.name).countDocuments();
    console.log(`  ${c.name}: ${count} documents`);
  }
  
  await mongoose.disconnect();
}

main();
