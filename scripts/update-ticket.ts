import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function update() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  await mongoose.connection.collection('miketasks').updateOne(
    { ticketNumber: 5 },
    { 
      $set: { 
        status: 'Completed',
        notes: `FIXED by Cascade:
- User points migrated to BOGX (divided by 100)
- Daily snapshots migrated  
- Auto-conversion disabled

Result: 5 points now shows as 0.05 BOGX
ShadowHunter: 24824 → 248.24 BOGX
Bacon77: 5 → 0.05 BOGX`,
        updatedAt: new Date()
      } 
    }
  );
  
  console.log('Ticket #5 updated to Completed!');
  await mongoose.disconnect();
}
update();
