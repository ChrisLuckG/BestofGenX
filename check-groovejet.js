const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const SR = mongoose.model('SongRequest', new mongoose.Schema({}, { strict: false }));
  const songs = await SR.find({ song: /Groovejet|Get Another Plan/i }).lean();
  songs.forEach(s => console.log(s.song, '| status:', s.status, '| cover:', s.coverImage ? s.coverImage.substring(0,60) + '...' : 'NONE'));
  process.exit(0);
});
