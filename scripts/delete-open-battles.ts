import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function deleteOpenBattles() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  const result = await mongoose.connection.collection('battles').deleteMany({
    status: 'open'
  });
  
  console.log('Deleted', result.deletedCount, 'open battles');
  
  await mongoose.disconnect();
}

deleteOpenBattles();
