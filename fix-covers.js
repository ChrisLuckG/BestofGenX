const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function getAlbumCover(band, song) {
  const query = encodeURIComponent(`${band} ${song}`);
  const res = await fetch(`https://api.deezer.com/search?q=${query}&limit=1`);
  const data = await res.json();
  return data.data?.[0]?.album?.cover_medium || null;
}

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const SR = mongoose.model('SongRequest', new mongoose.Schema({}, { strict: false }));
  
  // Find songs without covers
  const songs = await SR.find({ 
    $or: [{ coverImage: null }, { coverImage: '' }, { coverImage: { $exists: false } }]
  });
  
  console.log('Found', songs.length, 'songs without covers');
  
  for (const song of songs) {
    const cover = await getAlbumCover(song.band, song.song);
    if (cover) {
      await SR.findByIdAndUpdate(song._id, { coverImage: cover });
      console.log('✓', song.song, '-', song.band);
    } else {
      console.log('✗', song.song, '-', song.band, '(not found)');
    }
  }
  
  process.exit(0);
});
