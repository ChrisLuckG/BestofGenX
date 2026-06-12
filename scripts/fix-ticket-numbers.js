const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function fixTicketNumbers() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const MikeTask = mongoose.model('MikeTask', new mongoose.Schema({ 
    ticketNumber: Number, 
    title: String,
    createdAt: Date
  }, { strict: false }));
  
  // Find all tasks without ticketNumber
  const tasks = await MikeTask.find({ 
    $or: [
      { ticketNumber: { $exists: false } },
      { ticketNumber: null }
    ]
  }).sort({ createdAt: 1 });
  
  console.log('Found', tasks.length, 'tickets without number');
  
  // Get highest existing number
  const highest = await MikeTask.findOne({ ticketNumber: { $exists: true, $ne: null } })
    .sort({ ticketNumber: -1 })
    .select('ticketNumber');
  
  let num = (highest?.ticketNumber || 0) + 1;
  
  for (const t of tasks) {
    await MikeTask.updateOne({ _id: t._id }, { ticketNumber: num });
    console.log('Updated:', t.title, '-> #' + num);
    num++;
  }
  
  console.log('Done!');
  process.exit(0);
}

fixTicketNumbers().catch(e => {
  console.error(e);
  process.exit(1);
});
