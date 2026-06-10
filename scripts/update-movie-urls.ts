import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const TVVideoSchema = new mongoose.Schema({
  title: String,
  description: String,
  youtubeUrl: String,
  youtubeId: String,
  thumbnail: String,
  category: String,
  duration: String,
  featured: Boolean,
  active: Boolean,
}, { timestamps: true });

const TVVideo = mongoose.models.TVVideo || mongoose.model('TVVideo', TVVideoSchema);

const movieUrls: Record<string, string> = {
  'Heat': 'https://www.youtube.com/results?search_query=Heat+1995+full+movie',
  'Casino': 'https://www.youtube.com/results?search_query=Casino+1995+full+movie',
  'Goodfellas': 'https://www.youtube.com/results?search_query=Goodfellas+full+movie',
  'Ronin': 'https://www.youtube.com/results?search_query=Ronin+1998+full+movie',
  "Carlito's Way": 'https://www.youtube.com/results?search_query=Carlitos+Way+full+movie',
  'The Usual Suspects': 'https://www.youtube.com/results?search_query=The+Usual+Suspects+full+movie',
  'True Romance': 'https://www.youtube.com/results?search_query=True+Romance+full+movie',
  'L.A. Confidential': 'https://www.youtube.com/results?search_query=LA+Confidential+full+movie',
  'The Fugitive': 'https://www.youtube.com/results?search_query=The+Fugitive+1993+full+movie',
  'Training Day': 'https://www.youtube.com/results?search_query=Training+Day+full+movie',
  'Point Break': 'https://www.youtube.com/results?search_query=Point+Break+1991+full+movie',
  'Speed': 'https://www.youtube.com/results?search_query=Speed+1994+full+movie',
  'Falling Down': 'https://www.youtube.com/results?search_query=Falling+Down+full+movie',
  'Demolition Man': 'https://www.youtube.com/results?search_query=Demolition+Man+full+movie',
  'The Crow': 'https://www.youtube.com/results?search_query=The+Crow+1994+full+movie',
  'Blade': 'https://www.youtube.com/results?search_query=Blade+1998+full+movie',
  'Dark City': 'https://www.youtube.com/results?search_query=Dark+City+1998+full+movie',
  'The Game': 'https://www.youtube.com/results?search_query=The+Game+1997+full+movie',
  'Enemy of the State': 'https://www.youtube.com/results?search_query=Enemy+of+the+State+full+movie',
  'Last Action Hero': 'https://www.youtube.com/results?search_query=Last+Action+Hero+full+movie',
  'Total Recall': 'https://www.youtube.com/results?search_query=Total+Recall+1990+full+movie',
  'Face/Off': 'https://www.youtube.com/results?search_query=Face+Off+1997+full+movie',
  'Con Air': 'https://www.youtube.com/results?search_query=Con+Air+full+movie',
  'The Rock': 'https://www.youtube.com/results?search_query=The+Rock+1996+full+movie',
  'Executive Decision': 'https://www.youtube.com/results?search_query=Executive+Decision+full+movie',
  'Tombstone': 'https://www.youtube.com/results?search_query=Tombstone+1993+full+movie',
  'Leon: The Professional': 'https://www.youtube.com/results?search_query=Leon+The+Professional+full+movie',
  'Seven': 'https://www.youtube.com/results?search_query=Seven+1995+full+movie',
  'Fight Club': 'https://www.youtube.com/results?search_query=Fight+Club+full+movie',
  'The Matrix': 'https://www.youtube.com/results?search_query=The+Matrix+1999+full+movie',
  'Hackers': 'https://www.youtube.com/results?search_query=Hackers+1995+full+movie',
  'Johnny Mnemonic': 'https://www.youtube.com/results?search_query=Johnny+Mnemonic+full+movie',
  'Strange Days': 'https://www.youtube.com/results?search_query=Strange+Days+1995+full+movie',
  '12 Monkeys': 'https://www.youtube.com/results?search_query=12+Monkeys+full+movie',
  'Gattaca': 'https://www.youtube.com/results?search_query=Gattaca+1997+full+movie',
  'The Fifth Element': 'https://www.youtube.com/results?search_query=The+Fifth+Element+full+movie',
  'Boogie Nights': 'https://www.youtube.com/results?search_query=Boogie+Nights+full+movie',
  'Donnie Brasco': 'https://www.youtube.com/results?search_query=Donnie+Brasco+full+movie',
  'A Bronx Tale': 'https://www.youtube.com/results?search_query=A+Bronx+Tale+full+movie',
  'Natural Born Killers': 'https://www.youtube.com/results?search_query=Natural+Born+Killers+full+movie',
  'Sleepers': 'https://www.youtube.com/results?search_query=Sleepers+1996+full+movie',
  'The Basketball Diaries': 'https://www.youtube.com/results?search_query=Basketball+Diaries+full+movie',
  'American History X': 'https://www.youtube.com/results?search_query=American+History+X+full+movie',
  'Rounders': 'https://www.youtube.com/results?search_query=Rounders+1998+full+movie',
  'Payback': 'https://www.youtube.com/results?search_query=Payback+1999+full+movie',
  'The Negotiator': 'https://www.youtube.com/results?search_query=The+Negotiator+1998+full+movie',
  'The Saint': 'https://www.youtube.com/results?search_query=The+Saint+1997+full+movie',
  'Cop Land': 'https://www.youtube.com/results?search_query=Cop+Land+1997+full+movie',
  'Judgment Night': 'https://www.youtube.com/results?search_query=Judgment+Night+1993+full+movie',
};

async function updateUrls() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  const videos = await TVVideo.find({ category: 'Movies' });
  console.log(`Found ${videos.length} movies`);

  for (const video of videos) {
    // Extract movie name from title like "Heat (1995)"
    const match = video.title.match(/^(.+?)\s*\(/);
    const movieName = match ? match[1].trim() : video.title;
    
    const url = movieUrls[movieName];
    if (url) {
      video.youtubeUrl = url;
      await video.save();
      console.log(`Updated: ${movieName} -> ${url}`);
    } else {
      console.log(`No URL found for: ${movieName}`);
    }
  }

  console.log('Done!');
  await mongoose.disconnect();
}

updateUrls().catch(console.error);
