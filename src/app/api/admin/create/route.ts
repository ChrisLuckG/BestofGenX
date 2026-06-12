import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

// One-time route to create admin user
// DELETE THIS FILE AFTER USE!
export async function GET() {
  try {
    await dbConnect();
    
    const adminEmail = 'admin@sporttock.com';
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (existingAdmin) {
      // Update existing
      const hashedPassword = await bcrypt.hash('admin1977', 10);
      await User.updateOne(
        { email: adminEmail },
        { $set: { password: hashedPassword, isAdmin: true } }
      );
      return NextResponse.json({ message: 'Admin user updated!', email: adminEmail });
    }
    
    // Create new admin
    const hashedPassword = await bcrypt.hash('admin1977', 10);
    await User.create({
      username: 'admin',
      email: adminEmail,
      password: hashedPassword,
      avatar: '',
      country: 'Germany',
      countryFlag: '🇩🇪',
      points: 100.00, // Admin gets 100 BOGX
      wins: 0,
      gamesPlayed: 0,
      isAdmin: true,
    });
    
    return NextResponse.json({ 
      message: 'Admin user created!',
      email: adminEmail,
      password: 'admin1977'
    });
  } catch (error) {
    console.error('Create admin error:', error);
    return NextResponse.json({ error: 'Failed to create admin' }, { status: 500 });
  }
}
