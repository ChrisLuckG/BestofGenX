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

const movies = [
  { name: "Heat", year: 1995, genre: "Crime/Thriller" },
  { name: "Casino", year: 1995, genre: "Crime" },
  { name: "Goodfellas", year: 1990, genre: "Crime" },
  { name: "Ronin", year: 1998, genre: "Action/Thriller" },
  { name: "Carlito's Way", year: 1993, genre: "Crime" },
  { name: "The Usual Suspects", year: 1995, genre: "Thriller" },
  { name: "True Romance", year: 1993, genre: "Crime/Romance" },
  { name: "L.A. Confidential", year: 1997, genre: "Crime/Mystery" },
  { name: "The Fugitive", year: 1993, genre: "Thriller" },
  { name: "Training Day", year: 2001, genre: "Crime" },
  { name: "Point Break", year: 1991, genre: "Action" },
  { name: "Speed", year: 1994, genre: "Action" },
  { name: "Falling Down", year: 1993, genre: "Drama/Thriller" },
  { name: "Demolition Man", year: 1993, genre: "Sci-Fi/Action" },
  { name: "The Crow", year: 1994, genre: "Dark Action" },
  { name: "Blade", year: 1998, genre: "Action/Horror" },
  { name: "Dark City", year: 1998, genre: "Sci-Fi" },
  { name: "The Game", year: 1997, genre: "Thriller" },
  { name: "Enemy of the State", year: 1998, genre: "Thriller" },
  { name: "Last Action Hero", year: 1993, genre: "Action/Comedy" },
  { name: "Total Recall", year: 1990, genre: "Sci-Fi/Action" },
  { name: "Face/Off", year: 1997, genre: "Action" },
  { name: "Con Air", year: 1997, genre: "Action" },
  { name: "The Rock", year: 1996, genre: "Action" },
  { name: "Executive Decision", year: 1996, genre: "Action/Thriller" },
  { name: "Tombstone", year: 1993, genre: "Western" },
  { name: "Leon: The Professional", year: 1994, genre: "Crime/Drama" },
  { name: "Seven", year: 1995, genre: "Thriller" },
  { name: "Fight Club", year: 1999, genre: "Drama" },
  { name: "The Matrix", year: 1999, genre: "Sci-Fi" },
  { name: "Hackers", year: 1995, genre: "Cyberpunk" },
  { name: "Johnny Mnemonic", year: 1995, genre: "Cyberpunk" },
  { name: "Strange Days", year: 1995, genre: "Sci-Fi/Thriller" },
  { name: "12 Monkeys", year: 1995, genre: "Sci-Fi" },
  { name: "Gattaca", year: 1997, genre: "Sci-Fi" },
  { name: "The Fifth Element", year: 1997, genre: "Sci-Fi" },
  { name: "Boogie Nights", year: 1997, genre: "Drama" },
  { name: "Donnie Brasco", year: 1997, genre: "Crime" },
  { name: "A Bronx Tale", year: 1993, genre: "Crime/Drama" },
  { name: "Natural Born Killers", year: 1994, genre: "Crime" },
  { name: "Sleepers", year: 1996, genre: "Drama/Crime" },
  { name: "The Basketball Diaries", year: 1995, genre: "Drama" },
  { name: "American History X", year: 1998, genre: "Drama" },
  { name: "Rounders", year: 1998, genre: "Drama" },
  { name: "Payback", year: 1999, genre: "Crime/Action" },
  { name: "The Negotiator", year: 1998, genre: "Thriller" },
  { name: "The Saint", year: 1997, genre: "Action" },
  { name: "Cop Land", year: 1997, genre: "Crime" },
  { name: "Judgment Night", year: 1993, genre: "Thriller" },
];

async function importMovies() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  for (const movie of movies) {
    const existing = await TVVideo.findOne({ title: `${movie.name} (${movie.year})` });
    if (existing) {
      console.log(`Skipping ${movie.name} - already exists`);
      continue;
    }

    await TVVideo.create({
      title: `${movie.name} (${movie.year})`,
      description: `${movie.genre} classic from ${movie.year}`,
      youtubeUrl: '',
      youtubeId: '',
      thumbnail: `https://via.placeholder.com/480x270/1a1a1a/D4873A?text=${encodeURIComponent(movie.name)}`,
      category: 'Movies',
      duration: '',
      featured: movie.name === 'The Matrix',
      active: false, // Set to false until YouTube ID is added
    });
    console.log(`Added: ${movie.name}`);
  }

  console.log('Done!');
  await mongoose.disconnect();
}

importMovies().catch(console.error);
