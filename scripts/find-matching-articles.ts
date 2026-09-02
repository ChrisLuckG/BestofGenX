import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  const persons = mongoose.connection.collection('persons');
  const articles = mongoose.connection.collection('articles');
  
  // Get persons with country
  const peopleWithCountry = await persons.find({ 
    countryBorn: { $exists: true, $ne: '' } 
  }).limit(20).toArray();
  
  console.log('People with country in DB:', peopleWithCountry.length);
  
  let fixed = 0;
  const dry = process.argv.includes('--dry');
  
  for (const p of peopleWithCountry) {
    // Check if there's an article about them
    const article = await articles.findOne({
      title: { $regex: new RegExp(`${p.firstname}.*${p.lastname}`, 'i') },
      $or: [
        { personCountryCode: { $exists: false } },
        { personCountryCode: '' },
        { personCountryCode: null },
      ]
    });
    
    if (article) {
      console.log(`\n✅ ${p.firstname} ${p.lastname}: ${p.countryBorn} (${p.countryCode || 'no code'})`);
      console.log(`   Article: ${article.title}`);
      
      if (!dry) {
        await articles.updateOne(
          { _id: article._id },
          { 
            $set: { 
              personCountry: p.countryBorn,
              personCountryCode: p.countryCode || '',
              personName: `${p.firstname} ${p.lastname}`,
            } 
          }
        );
        fixed++;
      }
    }
  }
  
  console.log(`\n${dry ? 'Would fix' : 'Fixed'}: ${fixed} articles`);
  
  await mongoose.disconnect();
}

main();
