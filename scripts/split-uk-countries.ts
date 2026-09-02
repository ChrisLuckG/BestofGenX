import mongoose from 'mongoose';
import { Person } from '../src/models/Almanac';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Scottish cities/regions
const SCOTTISH_PLACES = [
  'Glasgow', 'Edinburgh', 'Aberdeen', 'Dundee', 'Inverness', 'Perth', 'Stirling',
  'Paisley', 'Kilmarnock', 'Ayr', 'Greenock', 'Falkirk', 'Livingston', 'Cumbernauld',
  'Hamilton', 'Dunfermline', 'Kirkcaldy', 'Coatbridge', 'Motherwell', 'Glenrothes',
  'Airdrie', 'East Kilbride', 'Irvine', 'Dumfries', 'Bellshill', 'Wishaw',
  'Scotland', 'Scottish', 'Fife', 'Lanarkshire', 'Lothian', 'Highlands',
];

// Welsh cities/regions
const WELSH_PLACES = [
  'Cardiff', 'Swansea', 'Newport', 'Wrexham', 'Barry', 'Neath', 'Cwmbran',
  'Bridgend', 'Llanelli', 'Pontypridd', 'Caerphilly', 'Colwyn Bay', 'Rhyl',
  'Merthyr Tydfil', 'Aberystwyth', 'Bangor', 'Carmarthen', 'Haverfordwest',
  'Wales', 'Welsh', 'Glamorgan', 'Gwynedd', 'Powys', 'Pembrokeshire',
];

// Northern Irish cities/regions
const NI_PLACES = [
  'Belfast', 'Derry', 'Londonderry', 'Lisburn', 'Newry', 'Bangor', 'Craigavon',
  'Newtownabbey', 'Ballymena', 'Newtownards', 'Carrickfergus', 'Coleraine',
  'Northern Ireland', 'Ulster', 'Antrim', 'Armagh', 'Down', 'Fermanagh', 'Tyrone',
];

function matchesPlace(cityBorn: string, places: string[]): boolean {
  if (!cityBorn) return false;
  const city = cityBorn.toLowerCase();
  return places.some(p => city.includes(p.toLowerCase()));
}

async function main() {
  const dry = process.argv.includes('--dry');
  
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  console.log('=== Splitting UK into England/Scotland/Wales/NI ===\n');
  
  // Get all UK people with a cityBorn
  const ukPeople = await Person.find({ 
    countryBorn: 'UK',
    cityBorn: { $exists: true, $ne: '' }
  }).lean();
  
  console.log(`UK people with cityBorn: ${ukPeople.length}\n`);
  
  let scotland = 0, wales = 0, ni = 0, england = 0;
  
  for (const p of ukPeople) {
    const city = p.cityBorn || '';
    let newCountry = 'England'; // Default for UK
    
    if (matchesPlace(city, SCOTTISH_PLACES)) {
      newCountry = 'Scotland';
      scotland++;
    } else if (matchesPlace(city, WELSH_PLACES)) {
      newCountry = 'Wales';
      wales++;
    } else if (matchesPlace(city, NI_PLACES)) {
      newCountry = 'Northern Ireland';
      ni++;
    } else {
      england++;
    }
    
    if (!dry && newCountry !== 'England') {
      await Person.updateOne({ _id: p._id }, { $set: { countryBorn: newCountry } });
    }
  }
  
  // Update remaining UK (without cityBorn) to England
  if (!dry) {
    const remaining = await Person.updateMany(
      { countryBorn: 'UK' },
      { $set: { countryBorn: 'England' } }
    );
    england += remaining.modifiedCount;
  }
  
  console.log('Results:');
  console.log(`  Scotland: ${scotland}`);
  console.log(`  Wales: ${wales}`);
  console.log(`  Northern Ireland: ${ni}`);
  console.log(`  England: ${england} (+ remaining UK without city)`);
  
  if (!dry) {
    console.log('\n=== Final Count ===');
    const scotlandCount = await Person.countDocuments({ countryBorn: 'Scotland' });
    const walesCount = await Person.countDocuments({ countryBorn: 'Wales' });
    const niCount = await Person.countDocuments({ countryBorn: 'Northern Ireland' });
    const englandCount = await Person.countDocuments({ countryBorn: 'England' });
    
    console.log(`  Scotland: ${scotlandCount}`);
    console.log(`  Wales: ${walesCount}`);
    console.log(`  Northern Ireland: ${niCount}`);
    console.log(`  England: ${englandCount}`);
  }
  
  await mongoose.disconnect();
}

main();
