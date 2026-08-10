import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SongRequest from '@/models/SongRequest';

// Deezer API - get album cover by searching artist + song (free, no auth needed)
async function getAlbumCover(band: string, song: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${band} ${song}`);
    const res = await fetch(`https://api.deezer.com/search?q=${query}&limit=1`);
    const data = await res.json();
    const track = data.data?.[0];
    if (track?.album?.cover_medium) {
      return track.album.cover_medium; // 250x250
    }
  } catch (e) {
    console.error('Deezer cover error:', e);
  }
  return null;
}

// POST - Backfill covers for existing songs
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Find all songs without cover
    const songs = await SongRequest.find({
      $or: [
        { coverImage: { $exists: false } },
        { coverImage: null },
        { coverImage: '' },
      ],
    }).limit(50); // Process in batches
    
    let updated = 0;
    const results: { song: string; band: string; cover: string | null }[] = [];
    
    for (const song of songs) {
      const cover = await getAlbumCover(song.band, song.song);
      if (cover) {
        await SongRequest.findByIdAndUpdate(song._id, { coverImage: cover });
        updated++;
      }
      results.push({ song: song.song, band: song.band, cover });
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    }
    
    return NextResponse.json({ 
      success: true, 
      found: songs.length, 
      updated,
      results,
    });
  } catch (error: any) {
    console.error('Backfill error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
