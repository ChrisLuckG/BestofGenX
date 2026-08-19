import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import path from 'path';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

const AVATAR_DIR = path.join(process.cwd(), 'public', 'images', 'Profil');
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'];

// POST - Update all bot avatars to use images from /public/images/Profil
export async function POST() {
  try {
    await dbConnect();

    // Read available avatars from the Profil folder
    const files = await readdir(AVATAR_DIR);
    const avatars = files
      .filter((f) => IMAGE_EXT.includes(path.extname(f).toLowerCase()))
      .sort(() => Math.random() - 0.5) // shuffle
      .map((f) => `/images/Profil/${encodeURIComponent(f)}`);

    if (avatars.length === 0) {
      return NextResponse.json({ success: false, error: 'No avatars found in /public/images/Profil' }, { status: 400 });
    }

    // Get all bots
    const bots = await User.find({ isBot: true }).select('_id username avatar');

    let updated = 0;
    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      // Cycle through avatars (wrap around if more bots than avatars)
      const newAvatar = avatars[i % avatars.length];
      
      // Only update if avatar is different (or was using old pravatar/dicebear)
      const oldAvatar = bot.avatar || '';
      const needsUpdate = oldAvatar.includes('pravatar.cc') || 
                          oldAvatar.includes('dicebear.com') || 
                          !oldAvatar.startsWith('/images/Profil/');
      
      if (needsUpdate) {
        await User.findByIdAndUpdate(bot._id, { avatar: newAvatar });
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      totalBots: bots.length,
      updated,
      availableAvatars: avatars.length,
      message: `Updated ${updated} bot avatars using ${avatars.length} images from /images/Profil/`
    });
  } catch (error: any) {
    console.error('Failed to update bot avatars:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
