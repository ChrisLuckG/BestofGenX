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

// Map movies to their primary genre
const movieGenres: Record<string, string> = {
  'Heat': 'Crime',
  'Casino': 'Crime',
  'Goodfellas': 'Crime',
  'Ronin': 'Action',
  "Carlito's Way": 'Crime',
  'The Usual Suspects': 'Thriller',
  'True Romance': 'Crime',
  'L.A. Confidential': 'Crime',
  'The Fugitive': 'Thriller',
  'Training Day': 'Crime',
  'Point Break': 'Action',
  'Speed': 'Action',
  'Falling Down': 'Drama',
  'Demolition Man': 'Sci-Fi',
  'The Crow': 'Action',
  'Blade': 'Action',
  'Dark City': 'Sci-Fi',
  'The Game': 'Thriller',
  'Enemy of the State': 'Thriller',
  'Last Action Hero': 'Action',
  'Total Recall': 'Sci-Fi',
  'Face/Off': 'Action',
  'Con Air': 'Action',
  'The Rock': 'Action',
  'Executive Decision': 'Action',
  'Tombstone': 'Western',
  'Leon: The Professional': 'Crime',
  'Seven': 'Thriller',
  'Fight Club': 'Drama',
  'The Matrix': 'Sci-Fi',
  'Hackers': 'Sci-Fi',
  'Johnny Mnemonic': 'Sci-Fi',
  'Strange Days': 'Sci-Fi',
  '12 Monkeys': 'Sci-Fi',
  'Gattaca': 'Sci-Fi',
  'The Fifth Element': 'Sci-Fi',
  'Boogie Nights': 'Drama',
  'Donnie Brasco': 'Crime',
  'A Bronx Tale': 'Crime',
  'Natural Born Killers': 'Crime',
  'Sleepers': 'Drama',
  'The Basketball Diaries': 'Drama',
  'American History X': 'Drama',
  'Rounders': 'Drama',
  'Payback': 'Action',
  'The Negotiator': 'Thriller',
  'The Saint': 'Action',
  'Cop Land': 'Crime',
  'Judgment Night': 'Thriller',
};

async function updateGenres() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  const videos = await TVVideo.find({ category: 'Movies' });
  console.log(`Found ${videos.length} movies`);

  for (const video of videos) {
    // Extract movie name from title like "Heat (1995)"
    const match = video.title.match(/^(.+?)\s*\(/);
    const movieName = match ? match[1].trim() : video.title;
    
    const genre = movieGenres[movieName];
    if (genre) {
      video.category = genre;
      await video.save();
      console.log(`${movieName} -> ${genre}`);
    } else {
      console.log(`No genre for: ${movieName}`);
    }
  }

  console.log('Done!');
  await mongoose.disconnect();
}

updateGenres().catch(console.error);
