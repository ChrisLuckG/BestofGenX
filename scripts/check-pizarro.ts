import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
  console.log('Connected to sporttock');
  
  const bestofgenxConn = await mongoose.createConnection(uri.replace(/\/[^\/\?]+(\?|$)/, '/bestofgenx$1')).asPromise();
  console.log('Connected to bestofgenx');
  
  const bestofgenxDb = bestofgenxConn.db!;
  const sporttockDb = mongoose.connection.db!;
  
  // Check Pizarro in bestofgenx
  const pizarro = await bestofgenxDb.collection('people').findOne({ 
    firstname: { $regex: /claudio/i }, 
    lastname: { $regex: /pizarro/i } 
  });
  console.log('\nPizarro in bestofgenx:', pizarro ? { profession: pizarro.profession, subcat: pizarro.subcat } : 'NOT FOUND');
  
  // Check in sporttock
  const pizarroSporttock = await sporttockDb.collection('people').findOne({ 
    firstname: { $regex: /claudio/i }, 
    lastname: { $regex: /pizarro/i } 
  });
  console.log('Pizarro in sporttock:', pizarroSporttock ? { profession: pizarroSporttock.profession, subcat: pizarroSporttock.subcat, knownfor: pizarroSporttock.knownfor } : 'NOT FOUND');
  
  await bestofgenxConn.close();
  await mongoose.disconnect();
}
check();
