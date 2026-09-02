import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  const articles = mongoose.connection.collection('articles');
  
  // Ricardo Antonio Chavira - American actor (born in San Antonio, Texas)
  const ricardo = await articles.findOne({ title: { $regex: /Ricardo Antonio Chavira/i } });
  if (ricardo) {
    console.log('Found Ricardo:', ricardo.title);
    console.log('Current country:', ricardo.personCountry, ricardo.personCountryCode);
    
    await articles.updateOne(
      { _id: ricardo._id },
      { $set: { 
        personCountry: 'USA',
        personCountryCode: 'US',
        personName: 'Ricardo Antonio Chavira'
      }}
    );
    console.log('✅ Updated Ricardo to USA (US)');
  }
  
  // David James - English footballer
  const david = await articles.findOne({ title: { $regex: /David James.*English Football/i } });
  if (david) {
    console.log('\nFound David:', david.title);
    console.log('Current country:', david.personCountry, david.personCountryCode);
    
    await articles.updateOne(
      { _id: david._id },
      { $set: { 
        personCountry: 'England',
        personCountryCode: 'GB',
        personName: 'David James'
      }}
    );
    console.log('✅ Updated David to England (GB)');
  }
  
  await mongoose.disconnect();
}

main();
