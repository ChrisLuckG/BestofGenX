import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import path from 'path';

const AVATAR_DIR = path.join(process.cwd(), 'public', 'images', 'Profil');
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'];

// GET - List all avatar images in /public/images/Profil (auto-updates when files are added)
export async function GET() {
  try {
    const files = await readdir(AVATAR_DIR);
    const avatars = files
      .filter((f) => IMAGE_EXT.includes(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .map((f) => `/images/Profil/${encodeURIComponent(f)}`);

    return NextResponse.json(
      { success: true, avatars },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }
    );
  } catch (error) {
    console.error('Failed to list avatars:', error);
    return NextResponse.json({ success: true, avatars: [] });
  }
}
