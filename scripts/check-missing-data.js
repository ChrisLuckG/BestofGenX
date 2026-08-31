const mongoose = require('mongoose');
require('dotenv').config({path:'.env.local'});

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db.collection('people');
  
  const total = await db.countDocuments();
  const noCity = await db.countDocuments({$or: [{cityBorn: null}, {cityBorn: ''}, {cityBorn: {$exists: false}}]});
  const noCountry = await db.countDocuments({$or: [{countryBorn: null}, {countryBorn: ''}, {countryBorn: 'Unknown'}, {countryBorn: {$exists: false}}]});
  const deceased = await db.countDocuments({died: {$exists: true, $nin: [null, '']}});
  const deceasedNoCause = await db.countDocuments({died: {$exists: true, $nin: [null, '']}, $or: [{causeOfDeath: null}, {causeOfDeath: ''}, {causeOfDeath: {$exists: false}}]});
  
  console.log('=== MISSING DATA STATS ===');
  console.log('Total people:', total);
  console.log('Missing cityBorn:', noCity);
  console.log('Missing countryBorn:', noCountry);
  console.log('Deceased total:', deceased);
  console.log('Deceased without causeOfDeath:', deceasedNoCause);
  
  process.exit(0);
});
