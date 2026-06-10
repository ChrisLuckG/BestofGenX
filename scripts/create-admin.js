// Script to create admin user
// Run with: node scripts/create-admin.js

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI;

async function createAdmin() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not set. Run with: MONGODB_URI="your-uri" node scripts/create-admin.js');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const users = db.collection('users');
    
    // Check if admin already exists
    const existing = await users.findOne({ username: 'admin' });
    if (existing) {
      // Update existing admin
      const hashedPassword = await bcrypt.hash('admin1977', 10);
      await users.updateOne(
        { username: 'admin' },
        { $set: { password: hashedPassword, isAdmin: true } }
      );
      console.log('✅ Admin user updated!');
    } else {
      // Create new admin
      const hashedPassword = await bcrypt.hash('admin1977', 10);
      await users.insertOne({
        username: 'admin',
        email: 'admin@sporttock.com',
        password: hashedPassword,
        avatar: '',
        country: 'Germany',
        countryFlag: '🇩🇪',
        points: 10000,
        wins: 0,
        gamesPlayed: 0,
        isAdmin: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('✅ Admin user created!');
    }
    
    console.log('Username: admin');
    console.log('Password: admin1977');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

createAdmin();
