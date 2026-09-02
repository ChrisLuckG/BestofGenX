import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  const articles = mongoose.connection.collection('articles');
  const persons = mongoose.connection.collection('persons');
  
  // Find articles with personRef (created from Menschen tab)
  const withRef = await articles.find({ personRef: { $exists: true } })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();
  
  console.log('Articles with personRef:', withRef.length);
  
  for (const a of withRef) {
    console.log('\n---');
    console.log('Title:', a.title);
    console.log('personCountry:', a.personCountry || '(missing)');
    console.log('personCountryCode:', a.personCountryCode || '(missing)');
    
    // Look up the person
    if (a.personRef) {
      const person = await persons.findOne({ _id: new mongoose.Types.ObjectId(a.personRef) });
      if (person) {
        console.log('Person found:', person.firstname, person.lastname);
        console.log('Person countryBorn:', person.countryBorn || '(missing)');
        console.log('Person countryCode:', person.countryCode || '(missing)');
      }
    }
  }
  
  await mongoose.disconnect();
}

main();
