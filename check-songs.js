const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const SongRequest = mongoose.model('SongRequest', new mongoose.Schema({}, { strict: false }));
  const songs = await SongRequest.find({}).limit(10).lean();
  songs.forEach(s => console.log(s.song, '|', s.band, '| link:', s.link ? s.link.substring(0, 50) + '...' : 'NONE'));
  process.exit(0);
});
